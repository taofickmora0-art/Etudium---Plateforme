-- Étudium · migration 0018 : événements et sessions live (spec des sessions live, 14 octobre 2026).
-- À appliquer dans Supabase, après la 0017 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancé sur une base qui l'a déjà, il ne change rien et ne casse rien. Si une migration plus ancienne
-- est rejouée un jour (0016 surtout), rejouer celle-ci ensuite.
-- Aucune fonction n'accepte l'heure du client : la fenêtre du lien, les rappels et les limites de date suivent now().

begin;

-- ─── Les sessions et leurs inscriptions ─────────────────────────────────────────────────────────────
-- Fermées aux comptes : tout passe par les fonctions plus bas, qui ne livrent le lien que dans sa fenêtre.
create table if not exists public.sessions_live (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  description text not null default '',
  debut timestamptz not null,
  duree_minutes integer not null default 60,
  lien text not null,
  parcours_id uuid references public.parcours (id) on delete set null,
  -- La fiche de l'animateur ; nulle : « Équipe Étudium ».
  formateur_id uuid references public.formateurs (id) on delete set null,
  statut text not null default 'programmee',
  annulee_le timestamptz,
  cree_par uuid references public.profils (id) on delete set null,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  constraint sessions_titre_longueur check (char_length(titre) between 1 and 120),
  constraint sessions_description_longueur check (char_length(description) <= 1000),
  constraint sessions_duree check (duree_minutes between 30 and 240 and duree_minutes % 15 = 0),
  constraint sessions_lien check (lien ~ '^https://' and char_length(lien) <= 500),
  constraint sessions_statut check (statut in ('programmee', 'annulee'))
);
create index if not exists sessions_live_debut_idx on public.sessions_live (debut);
create index if not exists sessions_live_formateur_idx on public.sessions_live (formateur_id);
create index if not exists sessions_live_parcours_idx on public.sessions_live (parcours_id);
create index if not exists sessions_live_cree_par_idx on public.sessions_live (cree_par);

drop trigger if exists sessions_live_modifie_le on public.sessions_live;
create trigger sessions_live_modifie_le before update on public.sessions_live
  for each row execute function public.toucher_modifie_le();

create table if not exists public.inscriptions_sessions (
  session_id uuid not null references public.sessions_live (id) on delete cascade,
  profil_id uuid not null references public.profils (id) on delete cascade,
  inscrit_le timestamptz not null default now(),
  -- Rappels déjà créés (la veille, 1 h avant) : chacun une seule fois.
  rappel_veille_le timestamptz,
  rappel_heure_le timestamptz,
  primary key (session_id, profil_id)
);
create index if not exists inscriptions_sessions_profil_idx on public.inscriptions_sessions (profil_id);

alter table public.sessions_live enable row level security;
alter table public.inscriptions_sessions enable row level security;
revoke all on public.sessions_live from anon, authenticated;
revoke all on public.inscriptions_sessions from anon, authenticated;

-- ─── Outils ─────────────────────────────────────────────────────────────────────────────────────────
-- La plateforme, déduite du lien (qui peut être caché) : « Google Meet », « Zoom », sinon « En ligne ».
create or replace function public.plateforme_session(p_lien text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_lien ~* '^https://meet\.google\.com(/|$)' then 'Google Meet'
    when p_lien ~* '^https://([a-z0-9-]+\.)*zoom\.us(/|$)' then 'Zoom'
    else 'En ligne'
  end;
$$;

-- « samedi 24 octobre à 15 h 00 », à l'heure du Bénin (UTC+1 toute l'année). Les noms viennent de tableaux en français,
-- jamais de la langue du serveur.
create or replace function public.quand_session(p_debut timestamptz)
returns text
language sql
immutable
set search_path = ''
as $$
  with b as (select (p_debut at time zone 'UTC') + interval '1 hour' as t)
  select (array['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'])[extract(dow from t)::int + 1]
    || ' ' || extract(day from t)::int
    || ' ' || (array['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'])[extract(month from t)::int]
    || ' à ' || extract(hour from t)::int || ' h ' || to_char(t, 'MI')
  from b;
$$;

create or replace function public.majuscule(p_texte text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(left(p_texte, 1)) || substr(p_texte, 2);
$$;

-- Le nom affiché de l'animateur : sa fiche, sinon « Équipe Étudium ».
create or replace function public.animateur_session(p_formateur uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select nom from public.formateurs where id = p_formateur), 'Équipe Étudium');
$$;

-- Le droit d'agir sur une session : l'équipe, ou le formateur dont la fiche anime la session.
create or replace function public.droit_session(p_formateur uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- coalesce : sans fiche (étudiant), la comparaison est « inconnue », jamais « vraie » ni ignorée.
  select public.equipe_contenus() or coalesce(p_formateur = public.ma_fiche_formateur(), false);
$$;

-- ─── notifier : une option pour les rappels ─────────────────────────────────────────────────────────
-- Un rappel est créé quand l'inscrit ouvre l'application : celui qui « agit » est alors le destinataire. Avec
-- p_auteur_inclus, il n'est pas écarté ; partout ailleurs (version à 5 paramètres), l'auteur l'est toujours.
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
    and (p_categorie = 'service' or (p.preferences_notifications ->> p_categorie) is distinct from 'false');
  get diagnostics v_nombre = row_count;
  return v_nombre;
end;
$$;

create or replace function public.notifier(p_destinataires uuid[], p_categorie text, p_titre text, p_texte text, p_lien text)
returns integer
language sql
security definer
set search_path = ''
as $$
  select public.notifier(p_destinataires, p_categorie, p_titre, p_texte, p_lien, false);
$$;

-- ─── Vérifier une session ───────────────────────────────────────────────────────────────────────────
-- Le début n'est revérifié que s'il change (une session en cours se modifie encore, pour corriger son lien).
create or replace function public.verifier_session(
  p_titre text,
  p_description text,
  p_debut timestamptz,
  p_duree integer,
  p_lien text,
  p_verifier_debut boolean
)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if char_length(p_titre) not between 1 and 120 then
    raise exception 'Écrivez un titre (120 caractères au plus).';
  end if;
  if char_length(p_description) > 1000 then
    raise exception 'La description dépasse 1 000 caractères.';
  end if;
  if p_debut is null or (p_verifier_debut and p_debut < now() + interval '10 minutes') then
    raise exception 'Choisissez une date au moins 10 minutes dans le futur.';
  end if;
  if p_verifier_debut and p_debut > now() + interval '1 year' then
    raise exception 'Choisissez une date dans l’année qui vient.';
  end if;
  if p_duree is null or p_duree not between 30 and 240 or p_duree % 15 <> 0 then
    raise exception 'Choisissez une durée de 30 minutes à 4 heures, par quarts d’heure.';
  end if;
  if p_lien !~ '^https://' or char_length(p_lien) > 500 or p_lien ~ '\s' then
    raise exception 'Le lien doit commencer par https://';
  end if;
end;
$$;

-- ─── Programmer, modifier, annuler ──────────────────────────────────────────────────────────────────
-- Le formateur anime toujours ses sessions ; l'équipe choisit l'animateur (une fiche, ou personne : Équipe Étudium).
create or replace function public.creer_session(
  p_titre text,
  p_description text,
  p_debut timestamptz,
  p_duree integer,
  p_lien text,
  p_parcours uuid,
  p_formateur uuid
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
begin
  if not v_equipe and v_fiche is null then
    raise exception 'Accès réservé aux formateurs et à l’équipe.' using errcode = '42501';
  end if;
  v_formateur := case when v_equipe then p_formateur else v_fiche end;
  if v_formateur is not null and not exists (select 1 from public.formateurs where id = v_formateur) then
    raise exception 'Cette fiche formateur n’existe plus.';
  end if;
  perform public.verifier_session(v_titre, v_description, p_debut, p_duree, v_lien, true);

  insert into public.sessions_live (titre, description, debut, duree_minutes, lien, parcours_id, formateur_id, cree_par)
  values (v_titre, v_description, p_debut, p_duree, v_lien, p_parcours, v_formateur, (select auth.uid()))
  returning id into v_id;

  perform public.notifier(
    array(select id from public.profils), 'sessions_live', 'Nouvelle session live : ' || v_titre,
    public.majuscule(public.quand_session(p_debut)) || ', avec ' || public.animateur_session(v_formateur) || '.', '/evenements'
  );
  return v_id;
end;
$$;

create or replace function public.modifier_session(
  p_session uuid,
  p_titre text,
  p_description text,
  p_debut timestamptz,
  p_duree integer,
  p_lien text,
  p_parcours uuid,
  p_formateur uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.sessions_live%rowtype;
  v_titre text := regexp_replace(coalesce(p_titre, ''), '^\s+|\s+$', '', 'g');
  v_description text := regexp_replace(coalesce(p_description, ''), '^\s+|\s+$', '', 'g');
  v_lien text := regexp_replace(coalesce(p_lien, ''), '^\s+|\s+$', '', 'g');
  v_equipe boolean := public.equipe_contenus();
  v_heure_changee boolean;
begin
  if not v_equipe and public.ma_fiche_formateur() is null then
    raise exception 'Accès réservé aux formateurs et à l’équipe.' using errcode = '42501';
  end if;
  select * into v from public.sessions_live where id = p_session for update;
  if not found then
    raise exception 'Session introuvable.';
  end if;
  if not public.droit_session(v.formateur_id) then
    raise exception 'Cette session n’est pas la vôtre.' using errcode = '42501';
  end if;
  if v.statut = 'annulee' then
    raise exception 'Cette session est annulée.';
  end if;
  if v.debut + make_interval(mins => v.duree_minutes) <= now() then
    raise exception 'Une session terminée ne se modifie plus.';
  end if;
  v_heure_changee := p_debut is distinct from v.debut;
  perform public.verifier_session(v_titre, v_description, p_debut, p_duree, v_lien, v_heure_changee);
  if v_equipe and p_formateur is not null and not exists (select 1 from public.formateurs where id = p_formateur) then
    raise exception 'Cette fiche formateur n’existe plus.';
  end if;

  update public.sessions_live
  set titre = v_titre, description = v_description, debut = p_debut, duree_minutes = p_duree, lien = v_lien,
      parcours_id = p_parcours, formateur_id = case when v_equipe then p_formateur else v.formateur_id end
  where id = p_session;

  if v_heure_changee then
    update public.inscriptions_sessions set rappel_veille_le = null, rappel_heure_le = null where session_id = p_session;
  end if;
  if v_heure_changee or p_duree is distinct from v.duree_minutes or v_lien is distinct from v.lien then
    perform public.notifier(
      array(select profil_id from public.inscriptions_sessions where session_id = p_session), 'sessions_live',
      'Session live modifiée', v_titre || ' : ' || public.quand_session(p_debut) || '.', '/evenements'
    );
  end if;
end;
$$;

-- Annulée plutôt que supprimée : ses inscrits sont prévenus et la retrouvent, marquée annulée.
create or replace function public.annuler_session(p_session uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.sessions_live%rowtype;
begin
  if not public.equipe_contenus() and public.ma_fiche_formateur() is null then
    raise exception 'Accès réservé aux formateurs et à l’équipe.' using errcode = '42501';
  end if;
  select * into v from public.sessions_live where id = p_session for update;
  if not found then
    raise exception 'Session introuvable.';
  end if;
  if not public.droit_session(v.formateur_id) then
    raise exception 'Cette session n’est pas la vôtre.' using errcode = '42501';
  end if;
  if v.statut = 'annulee' then
    raise exception 'Cette session est annulée.';
  end if;
  if v.debut + make_interval(mins => v.duree_minutes) <= now() then
    raise exception 'Une session terminée ne se modifie plus.';
  end if;
  update public.sessions_live set statut = 'annulee', annulee_le = now() where id = p_session;
  perform public.notifier(
    array(select profil_id from public.inscriptions_sessions where session_id = p_session), 'sessions_live',
    'Session live annulée', v.titre || ', prévue ' || public.quand_session(v.debut) || '.', '/evenements'
  );
end;
$$;

-- ─── Listes et fiche, pour l'animateur et l'équipe ──────────────────────────────────────────────────
-- p_fiche nulle : toutes les sessions (équipe). À venir : pas terminées, annulées comprises ; passées : 50 au plus.
create or replace function public.liste_sessions_edition(p_fiche uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with lignes as (
    select
      s.debut,
      s.debut + make_interval(mins => s.duree_minutes) > now() as a_venir,
      jsonb_build_object(
        'id', s.id,
        'titre', s.titre,
        'debut', s.debut,
        'duree_minutes', s.duree_minutes,
        'plateforme', public.plateforme_session(s.lien),
        'statut', s.statut,
        'inscriptions', (select count(*)::int from public.inscriptions_sessions i where i.session_id = s.id),
        'parcours', (select jsonb_build_object('nom_court', p.nom_court, 'couleur', p.couleur) from public.parcours p where p.id = s.parcours_id),
        'animateur', public.animateur_session(s.formateur_id)
      ) as ligne
    from public.sessions_live s
    where p_fiche is null or s.formateur_id = p_fiche
  )
  select jsonb_build_object(
    'a_venir', coalesce((select jsonb_agg(ligne order by debut) from lignes where a_venir), '[]'::jsonb),
    'passees', coalesce(
      (select jsonb_agg(ligne order by debut desc) from (select * from lignes where not a_venir order by debut desc limit 50) passees),
      '[]'::jsonb
    )
  );
$$;

create or replace function public.sessions_animees()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_fiche uuid := public.ma_fiche_formateur();
begin
  if v_fiche is null then
    raise exception 'Accès réservé aux formateurs et à l’équipe.' using errcode = '42501';
  end if;
  return public.liste_sessions_edition(v_fiche);
end;
$$;

create or replace function public.sessions_equipe()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.equipe_contenus() then
    raise exception 'Accès réservé à l’équipe.' using errcode = '42501';
  end if;
  return public.liste_sessions_edition(null);
end;
$$;

-- La fiche d'une session : son lien et ses inscrits (prénom et nom, jamais l'adresse e-mail). Null pour qui n'est ni
-- son animateur ni l'équipe, ou pour une session inconnue.
create or replace function public.session_detail(p_session uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.sessions_live%rowtype;
begin
  select * into v from public.sessions_live where id = p_session;
  if not found or not public.droit_session(v.formateur_id) then
    return null;
  end if;
  return jsonb_build_object(
    'id', v.id,
    'titre', v.titre,
    'description', v.description,
    'debut', v.debut,
    'duree_minutes', v.duree_minutes,
    'lien', v.lien,
    'plateforme', public.plateforme_session(v.lien),
    'parcours', (select jsonb_build_object('id', p.id, 'nom_court', p.nom_court, 'couleur', p.couleur) from public.parcours p where p.id = v.parcours_id),
    'formateur_id', v.formateur_id,
    'animateur', public.animateur_session(v.formateur_id),
    'statut', v.statut,
    'annulee_le', v.annulee_le,
    'inscrits', coalesce((
      select jsonb_agg(jsonb_build_object('prenom', coalesce(p.prenom, ''), 'nom', coalesce(p.nom, '')) order by i.inscrit_le)
      from public.inscriptions_sessions i
      join public.profils p on p.id = i.profil_id
      where i.session_id = v.id
    ), '[]'::jsonb)
  );
end;
$$;

-- ─── Pour tout compte connecté ──────────────────────────────────────────────────────────────────────
-- Un visiteur n'a aucun droit d'exécution ; un compte suspendu est refusé.
create or replace function public.exiger_compte_actif()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.compte_suspendu() then
    raise exception 'Accès réservé aux comptes connectés.' using errcode = '42501';
  end if;
end;
$$;

-- « 15 h 00 », à l'heure du Bénin.
create or replace function public.heure_session(p_debut timestamptz)
returns text
language sql
immutable
set search_path = ''
as $$
  with b as (select (p_debut at time zone 'UTC') + interval '1 hour' as t)
  select extract(hour from t)::int || ' h ' || to_char(t, 'MI') from b;
$$;

-- Une carte de la page Événements. Le lien n'y est que de 10 min avant le début jusqu'à la fin, pour une session
-- programmée ; l'animateur et l'équipe l'ont toujours.
create or replace function public.carte_session(s public.sessions_live)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id,
    'titre', s.titre,
    'description', s.description,
    'debut', s.debut,
    'duree_minutes', s.duree_minutes,
    'plateforme', public.plateforme_session(s.lien),
    'lien', case
      when public.droit_session(s.formateur_id)
        or (s.statut = 'programmee'
            and now() >= s.debut - interval '10 minutes'
            and now() < s.debut + make_interval(mins => s.duree_minutes))
      then s.lien
    end,
    'parcours', (select jsonb_build_object('nom_court', p.nom_court, 'couleur', p.couleur) from public.parcours p where p.id = s.parcours_id),
    'animateur', public.animateur_session(s.formateur_id),
    'inscriptions', (select count(*)::int from public.inscriptions_sessions i where i.session_id = s.id),
    'inscrit', exists (select 1 from public.inscriptions_sessions i where i.session_id = s.id and i.profil_id = (select auth.uid())),
    'statut', s.statut
  );
$$;

-- Les trois onglets : à venir (programmées pas terminées), mes inscriptions (pas terminées, annulées comprises),
-- passées (mes inscriptions terminées et programmées, 50 au plus). Une autre vue vaut « à venir ».
create or replace function public.sessions_live(p_vue text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
begin
  perform public.exiger_compte_actif();
  if p_vue = 'inscriptions' then
    return coalesce((
      select jsonb_agg(public.carte_session(s) order by s.debut)
      from public.sessions_live s
      join public.inscriptions_sessions i on i.session_id = s.id and i.profil_id = v_moi
      where s.debut + make_interval(mins => s.duree_minutes) > now()
    ), '[]'::jsonb);
  elsif p_vue = 'passees' then
    return coalesce((
      select jsonb_agg(public.carte_session(x) order by x.debut desc)
      from (
        select s.* from public.sessions_live s
        join public.inscriptions_sessions i on i.session_id = s.id and i.profil_id = v_moi
        where s.statut = 'programmee' and s.debut + make_interval(mins => s.duree_minutes) <= now()
        order by s.debut desc
        limit 50
      ) x
    ), '[]'::jsonb);
  end if;
  return coalesce((
    select jsonb_agg(public.carte_session(x) order by x.debut)
    from (
      select s.* from public.sessions_live s
      where s.statut = 'programmee' and s.debut + make_interval(mins => s.duree_minutes) > now()
      order by s.debut
      limit 100
    ) x
  ), '[]'::jsonb);
end;
$$;

-- La carte de l'accueil : la plus proche de mes inscriptions, sinon la prochaine session ; avec les initiales des
-- 3 premiers inscrits. Null sans session à venir.
create or replace function public.prochaine_session()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.sessions_live%rowtype;
begin
  perform public.exiger_compte_actif();
  select s.* into v
  from public.sessions_live s
  join public.inscriptions_sessions i on i.session_id = s.id and i.profil_id = (select auth.uid())
  where s.statut = 'programmee' and s.debut + make_interval(mins => s.duree_minutes) > now()
  order by s.debut
  limit 1;
  if not found then
    select * into v from public.sessions_live s
    where s.statut = 'programmee' and s.debut + make_interval(mins => s.duree_minutes) > now()
    order by s.debut
    limit 1;
  end if;
  if not found then
    return null;
  end if;
  return public.carte_session(v) || jsonb_build_object('initiales', coalesce((
    select jsonb_agg(x.initiales order by x.inscrit_le)
    from (
      select upper(left(coalesce(nullif(btrim(p.prenom), ''), '?'), 1)) || upper(left(btrim(coalesce(p.nom, '')), 1)) as initiales, i.inscrit_le
      from public.inscriptions_sessions i
      join public.profils p on p.id = i.profil_id
      where i.session_id = v.id
      order by i.inscrit_le
      limit 3
    ) x
  ), '[]'::jsonb));
end;
$$;

-- S'inscrire : un rappel dont le moment est déjà passé est marqué comme envoyé (pas de rappel aussitôt).
create or replace function public.sinscrire_session(p_session uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.sessions_live%rowtype;
begin
  perform public.exiger_compte_actif();
  select * into v from public.sessions_live where id = p_session;
  if not found or v.statut <> 'programmee' or v.debut + make_interval(mins => v.duree_minutes) <= now() then
    raise exception 'Les inscriptions à cette session sont closes.';
  end if;
  insert into public.inscriptions_sessions (session_id, profil_id, rappel_veille_le, rappel_heure_le)
  values (
    p_session,
    (select auth.uid()),
    case when now() >= v.debut - interval '24 hours' then now() end,
    case when now() >= v.debut - interval '1 hour' then now() end
  )
  on conflict do nothing;
end;
$$;

create or replace function public.se_desinscrire_session(p_session uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  if exists (select 1 from public.sessions_live where id = p_session and debut <= now()) then
    raise exception 'La session a commencé.';
  end if;
  delete from public.inscriptions_sessions where session_id = p_session and profil_id = (select auth.uid());
end;
$$;

-- Les rappels dus au compte qui demande (la cloche les demande en se chargeant) : 1 h avant, puis la veille pour
-- celles qui sont encore à plus d'1 h. Chacun une seule fois ; celui de la veille n'a plus lieu après celui d'1 h.
create or replace function public.rappels_sessions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
  v_nombre integer := 0;
  r record;
begin
  perform public.exiger_compte_actif();

  for r in
    select s.id, s.titre, s.debut
    from public.inscriptions_sessions i
    join public.sessions_live s on s.id = i.session_id
    where i.profil_id = v_moi and s.statut = 'programmee' and i.rappel_heure_le is null
      and s.debut > now() and s.debut <= now() + interval '1 hour'
  loop
    v_nombre := v_nombre + public.notifier(
      array[v_moi], 'sessions_live', 'Session live dans moins d’une heure',
      r.titre || ', à ' || public.heure_session(r.debut) || '. Le lien s’ouvre 10 min avant.', '/evenements', true
    );
    update public.inscriptions_sessions
    set rappel_heure_le = now(), rappel_veille_le = coalesce(rappel_veille_le, now())
    where session_id = r.id and profil_id = v_moi;
  end loop;

  for r in
    select s.id, s.titre, s.debut
    from public.inscriptions_sessions i
    join public.sessions_live s on s.id = i.session_id
    where i.profil_id = v_moi and s.statut = 'programmee' and i.rappel_veille_le is null and i.rappel_heure_le is null
      and s.debut > now() + interval '1 hour' and s.debut <= now() + interval '24 hours'
  loop
    v_nombre := v_nombre + public.notifier(
      array[v_moi], 'sessions_live',
      case
        when ((r.debut at time zone 'UTC') + interval '1 hour')::date = ((now() at time zone 'UTC') + interval '1 hour')::date
        then 'Session live aujourd’hui'
        else 'Session live demain'
      end,
      r.titre || ', à ' || public.heure_session(r.debut) || '.', '/evenements', true
    );
    update public.inscriptions_sessions set rappel_veille_le = now() where session_id = r.id and profil_id = v_moi;
  end loop;

  return v_nombre;
end;
$$;

-- ─── Droits d'exécution ─────────────────────────────────────────────────────────────────────────────
revoke execute on function public.exiger_compte_actif() from public, anon, authenticated;
revoke execute on function public.carte_session(public.sessions_live) from public, anon, authenticated;
revoke execute on function public.sessions_live(text) from public, anon;
revoke execute on function public.prochaine_session() from public, anon;
revoke execute on function public.sinscrire_session(uuid) from public, anon;
revoke execute on function public.se_desinscrire_session(uuid) from public, anon;
revoke execute on function public.rappels_sessions() from public, anon;
grant execute on function public.sessions_live(text) to authenticated;
grant execute on function public.prochaine_session() to authenticated;
grant execute on function public.sinscrire_session(uuid) to authenticated;
grant execute on function public.se_desinscrire_session(uuid) to authenticated;
grant execute on function public.rappels_sessions() to authenticated;
revoke execute on function public.notifier(uuid[], text, text, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.notifier(uuid[], text, text, text, text) from public, anon, authenticated;
revoke execute on function public.animateur_session(uuid) from public, anon, authenticated;
revoke execute on function public.droit_session(uuid) from public, anon, authenticated;
revoke execute on function public.verifier_session(text, text, timestamptz, integer, text, boolean) from public, anon, authenticated;
revoke execute on function public.liste_sessions_edition(uuid) from public, anon, authenticated;
revoke execute on function public.creer_session(text, text, timestamptz, integer, text, uuid, uuid) from public, anon;
revoke execute on function public.modifier_session(uuid, text, text, timestamptz, integer, text, uuid, uuid) from public, anon;
revoke execute on function public.annuler_session(uuid) from public, anon;
revoke execute on function public.sessions_animees() from public, anon;
revoke execute on function public.sessions_equipe() from public, anon;
revoke execute on function public.session_detail(uuid) from public, anon;
grant execute on function public.creer_session(text, text, timestamptz, integer, text, uuid, uuid) to authenticated;
grant execute on function public.modifier_session(uuid, text, text, timestamptz, integer, text, uuid, uuid) to authenticated;
grant execute on function public.annuler_session(uuid) to authenticated;
grant execute on function public.sessions_animees() to authenticated;
grant execute on function public.sessions_equipe() to authenticated;
grant execute on function public.session_detail(uuid) to authenticated;

commit;
