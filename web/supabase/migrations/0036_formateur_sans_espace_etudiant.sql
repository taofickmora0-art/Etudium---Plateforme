-- Migration 0036 : le formateur n'est plus étudiant (restructuration du 20 octobre 2026, R1 ;
-- spec docs/superpowers/specs/2026-10-20-restructuration-design.md, §4.3).
-- Un formateur n'ouvre que le contenu de ses formations ; la base refuse toute action d'étudiant de sa part (progression,
-- favoris, avis, inscriptions aux sessions, quiz, rendus, conversation côté étudiant) ; les notifications
-- d'apprentissage ne lui sont plus envoyées. Repasser étudiant (changer_role) lui rend tout.
-- Rejouable. L'équipe n'est jamais formateur (0017) : rien ne change pour elle, ni pour l'étudiant.

begin;

-- ─── L'accès d'un étudiant : une leçon publiée, jamais pour un formateur ───────────────────────────
-- Même définition qu'en 0027, la branche « leçon publiée » exclut le formateur : il n'ouvre que ses formations.
create or replace function public.acces_lecon(p_lecon uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not public.compte_suspendu() and (
    public.equipe_contenus()
    or public.formateur_de(public.formation_de_la_lecon(p_lecon))
    or (
      not public.a_role('formateur')
      and exists (
        select 1
        from public.lecons l
        join public.modules m on m.id = l.module_id
        join public.formations f on f.id = m.formation_id
        where l.id = p_lecon
          and f.statut = 'publiee'
          and l.publiee
          and (l.apercu or (f.gratuite and (select auth.uid()) is not null))
      )
    )
  );
$$;

-- ─── Aucune action d'étudiant pour un formateur ────────────────────────────────────────────────────
-- Un déclencheur par table d'étudiant : il refuse la ligne d'un compte formateur, même écrite par une fonction. Une
-- mise à jour n'est refusée que si elle vient de lui : l'équipe, un autre formateur ou la tâche planifiée mettent encore
-- à jour les lignes d'un ancien étudiant devenu formateur (rappels des sessions, correction d'un rendu, avis masqué,
-- correcteur supprimé).
create or replace function public.refuser_compte_formateur()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.profil_id is distinct from (select auth.uid()) then
    return new;
  end if;
  if exists (select 1 from public.roles r where r.profil_id = new.profil_id and r.role = 'formateur') then
    raise exception 'Un compte formateur ne suit pas de formation.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists progression_lecons_pas_de_formateur on public.progression_lecons;
create trigger progression_lecons_pas_de_formateur
  before insert or update on public.progression_lecons
  for each row execute function public.refuser_compte_formateur();

drop trigger if exists favoris_pas_de_formateur on public.favoris;
create trigger favoris_pas_de_formateur
  before insert or update on public.favoris
  for each row execute function public.refuser_compte_formateur();

drop trigger if exists avis_pas_de_formateur on public.avis;
create trigger avis_pas_de_formateur
  before insert or update on public.avis
  for each row execute function public.refuser_compte_formateur();

drop trigger if exists inscriptions_sessions_pas_de_formateur on public.inscriptions_sessions;
create trigger inscriptions_sessions_pas_de_formateur
  before insert or update on public.inscriptions_sessions
  for each row execute function public.refuser_compte_formateur();

drop trigger if exists tentatives_quiz_pas_de_formateur on public.tentatives_quiz;
create trigger tentatives_quiz_pas_de_formateur
  before insert or update on public.tentatives_quiz
  for each row execute function public.refuser_compte_formateur();

drop trigger if exists rendus_exercices_pas_de_formateur on public.rendus_exercices;
create trigger rendus_exercices_pas_de_formateur
  before insert or update on public.rendus_exercices
  for each row execute function public.refuser_compte_formateur();

-- La messagerie côté étudiant : ni nouvelle conversation, ni message écrit comme étudiant.
create or replace function public.refuser_formateur_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_compte uuid;
begin
  if tg_table_name = 'conversations' then
    v_compte := new.etudiant_id;
  elsif new.de_etudiant then
    v_compte := new.auteur_id;
  end if;
  if v_compte is not null and exists (select 1 from public.roles r where r.profil_id = v_compte and r.role = 'formateur') then
    raise exception 'Un compte formateur ne suit pas de formation.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists conversations_pas_de_formateur on public.conversations;
create trigger conversations_pas_de_formateur
  before insert on public.conversations
  for each row execute function public.refuser_formateur_conversation();

drop trigger if exists messages_pas_de_formateur on public.messages;
create trigger messages_pas_de_formateur
  before insert on public.messages
  for each row execute function public.refuser_formateur_conversation();

-- ─── notifier : pas de notification d'apprentissage pour un formateur ──────────────────────────────
-- Même définition qu'en 0018 ; un formateur ne reçoit plus les sessions live, les nouveaux contenus, les rappels
-- d'apprentissage, les recommandations ni l'expiration (il ne suit pas de formation). Le reste lui parvient.
create or replace function public.notifier(
  p_destinataires uuid[],
  p_categorie text,
  p_titre text,
  p_texte text,
  p_lien text,
  p_auteur_inclus boolean
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre integer;
begin
  delete from public.notifications
  where destinataire = any (p_destinataires) and cree_le < now() - interval '6 months';

  insert into public.notifications (destinataire, categorie, titre, texte, lien)
  select p.id, p_categorie, left(p_titre, 200), left(coalesce(p_texte, ''), 400), p_lien
  from public.profils p
  where p.id = any (p_destinataires)
    and (coalesce(p_auteur_inclus, false) or p.id is distinct from (select auth.uid()))
    and (p.preferences_notifications ->> 'canal_appli') is distinct from 'false'
    and (p_categorie = 'service' or (p.preferences_notifications ->> p_categorie) is distinct from 'false')
    and not (
      p_categorie in ('sessions_live', 'nouveaux_contenus', 'rappels_apprentissage', 'recommandations', 'expiration_renouvellement')
      and exists (select 1 from public.roles r where r.profil_id = p.id and r.role = 'formateur')
    );
  get diagnostics v_nombre = row_count;
  return v_nombre;
end;
$$;

-- ─── L'animateur garde les notifications de ses sessions ───────────────────────────────────────────
-- Les annonces de session partent à tous les comptes, sauf aux formateurs (notifier) : l'animateur reçoit les siennes à
-- part, en « service », vers ses Sessions live. Mêmes définitions qu'en 0024 (creer_session) et 0023
-- (traiter_sessions_live), plus cet envoi.
create or replace function public.creer_session(
  p_titre text,
  p_description text,
  p_debut timestamptz,
  p_duree integer,
  p_lien text,
  p_parcours uuid,
  p_formateur uuid,
  p_image jsonb default null,
  p_video jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_titre text := regexp_replace(coalesce(p_titre, ''), '^\s+|\s+$', '', 'g');
  v_description text := regexp_replace(coalesce(p_description, ''), '^\s+|\s+$', '', 'g');
  v_lien text := regexp_replace(coalesce(p_lien, ''), '^\s+|\s+$', '', 'g');
  v_equipe boolean := public.equipe_contenus();
  v_fiche uuid := public.ma_fiche_formateur();
  v_formateur uuid;
  v_id uuid;
  v_promo jsonb;
  v_publication uuid;
begin
  if not v_equipe and v_fiche is null then
    raise exception 'Accès réservé aux formateurs et à l’équipe.' using errcode = '42501';
  end if;
  v_formateur := case when v_equipe then p_formateur else v_fiche end;
  if v_formateur is not null and not exists (select 1 from public.formateurs where id = v_formateur) then
    raise exception 'Cette fiche formateur n’existe plus.';
  end if;
  perform public.verifier_session(v_titre, v_description, p_debut, p_duree, v_lien, true);
  v_promo := public.verifier_promotion(p_image, p_video, null);
  perform public.verifier_espace_session(p_parcours);

  insert into public.sessions_live (titre, description, debut, duree_minutes, lien, parcours_id, formateur_id, cree_par, promo_image, promo_video)
  values (v_titre, v_description, p_debut, p_duree, v_lien, p_parcours, v_formateur, (select auth.uid()),
          nullif(v_promo -> 'image', 'null'::jsonb), nullif(v_promo -> 'video', 'null'::jsonb))
  returning id into v_id;

  -- La session paraît aussitôt dans la communauté (espace de son parcours, Général pour tous les parcours).
  insert into public.publications (auteur, parcours_id, titre, texte, piece_jointe, video, statut, session_id)
  values ((select auth.uid()), p_parcours, v_titre, coalesce(nullif(v_description, ''), 'Session live programmée.'),
          nullif(v_promo -> 'image', 'null'::jsonb), nullif(v_promo -> 'video', 'null'::jsonb), 'publiee', v_id)
  returning id into v_publication;
  update public.sessions_live set publication_id = v_publication where id = v_id;

  perform public.notifier(
    array(select id from public.profils), 'sessions_live', 'Nouvelle session live : ' || v_titre,
    public.majuscule(public.quand_session(p_debut)) || ', avec ' || public.animateur_session(v_formateur) || '.', '/evenements'
  );
  -- L'animateur (un formateur, qui ne reçoit plus les sessions live) est prévenu dans son espace ; pas s'il l'a créée.
  perform public.notifier(
    array(select fo.compte_id from public.formateurs fo where fo.id = v_formateur and fo.compte_id is not null), 'service',
    'Session live programmée : ' || v_titre, public.majuscule(public.quand_session(p_debut)) || '.', '/formateur/sessions'
  );
  return v_id;
end;
$$;

create or replace function public.traiter_sessions_live()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre integer := 0;
  r record;
begin
  -- Un traitement à la fois : un appel qui en trouve un en cours repart aussitôt (la tâche planifiée repasse dans la
  -- minute), sans attendre ni rien perdre.
  if not pg_try_advisory_xact_lock(hashtext('etudium.traiter_sessions_live')) then
    return 0;
  end if;
  -- Les sessions proches sont figées le temps du traitement : un report ou une annulation en cours est d'abord validé
  -- (les envois qui suivent voient la nouvelle heure), ou attend la fin du traitement.
  perform 1 from public.sessions_live
  where statut = 'programmee' and debut > now() - interval '4 hours' and debut <= now() + interval '24 hours'
  for share;

  -- Le début du live : tous les comptes (équipe et non-inscrits compris), une fois, tant que la session est en cours
  -- (4 h au plus : la durée maximale d'une session).
  for r in
    update public.sessions_live s
    set debut_annonce_le = now()
    where s.statut = 'programmee' and s.debut_annonce_le is null
      and s.debut > now() - interval '4 hours'
      and s.debut <= now() and s.debut + make_interval(mins => s.duree_minutes) > now()
    returning s.titre, s.formateur_id
  loop
    v_nombre := v_nombre + public.notifier(
      array(select id from public.profils), 'sessions_live', 'C’est l’heure du live : ' || r.titre,
      'La session vient de commencer avec ' || public.animateur_session(r.formateur_id) || '. Rejoignez-la depuis la page Événements.',
      '/evenements', true
    );
    -- L'animateur, dans son espace (un formateur ne reçoit plus les sessions live).
    v_nombre := v_nombre + public.notifier(
      array(select fo.compte_id from public.formateurs fo where fo.id = r.formateur_id and fo.compte_id is not null), 'service',
      'C’est l’heure de votre live : ' || r.titre, 'Votre session vient de commencer. Ouvrez-la depuis Sessions live.',
      '/formateur/sessions', true
    );
  end loop;

  -- 10 min avant : les inscrits (le lien vient de s'ouvrir). Les rappels plus anciens qui n'ont pas pu partir sont clos.
  for r in
    update public.inscriptions_sessions i
    set rappel_dix_le = now(), rappel_heure_le = coalesce(i.rappel_heure_le, now()), rappel_veille_le = coalesce(i.rappel_veille_le, now())
    from public.sessions_live s
    where s.id = i.session_id and s.statut = 'programmee' and i.rappel_dix_le is null
      and s.debut > now() and s.debut <= now() + interval '10 minutes'
    returning i.profil_id, s.titre, s.debut
  loop
    v_nombre := v_nombre + public.notifier(
      array[r.profil_id], 'sessions_live', 'Session live dans 10 minutes',
      r.titre || ', à ' || public.heure_session(r.debut) || '. Le lien est ouvert : rejoignez la session depuis la page Événements.',
      '/evenements', true
    );
  end loop;

  -- 1 h avant (entre 10 min et 1 h).
  for r in
    update public.inscriptions_sessions i
    set rappel_heure_le = now(), rappel_veille_le = coalesce(i.rappel_veille_le, now())
    from public.sessions_live s
    where s.id = i.session_id and s.statut = 'programmee' and i.rappel_heure_le is null and i.rappel_dix_le is null
      and s.debut > now() + interval '10 minutes' and s.debut <= now() + interval '1 hour'
    returning i.profil_id, s.titre, s.debut
  loop
    v_nombre := v_nombre + public.notifier(
      array[r.profil_id], 'sessions_live', 'Session live dans moins d’une heure',
      r.titre || ', à ' || public.heure_session(r.debut) || '. Le lien s’ouvre 10 min avant.', '/evenements', true
    );
  end loop;

  -- La veille (entre 1 h et 24 h) : « aujourd’hui » ou « demain » selon le jour au Bénin.
  for r in
    update public.inscriptions_sessions i
    set rappel_veille_le = now()
    from public.sessions_live s
    where s.id = i.session_id and s.statut = 'programmee'
      and i.rappel_veille_le is null and i.rappel_heure_le is null and i.rappel_dix_le is null
      and s.debut > now() + interval '1 hour' and s.debut <= now() + interval '24 hours'
    returning i.profil_id, s.titre, s.debut
  loop
    v_nombre := v_nombre + public.notifier(
      array[r.profil_id], 'sessions_live',
      case
        when ((r.debut at time zone 'UTC') + interval '1 hour')::date = ((now() at time zone 'UTC') + interval '1 hour')::date
        then 'Session live aujourd’hui'
        else 'Session live demain'
      end,
      r.titre || ', à ' || public.heure_session(r.debut) || '.', '/evenements', true
    );
  end loop;

  return v_nombre;
end;
$$;

-- ─── Droits ─────────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public.refuser_compte_formateur() from public, anon, authenticated;
revoke execute on function public.refuser_formateur_conversation() from public, anon, authenticated;
revoke execute on function public.notifier(uuid[], text, text, text, text, boolean) from public, anon, authenticated;

commit;
