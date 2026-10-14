-- Étudium · migration 0023 : rappel 10 min avant et annonce du début du live à tous (spec Formations et Événements, §3.2).
-- À appliquer dans Supabase, après la 0022 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancée, elle ne change rien et ne casse rien. Si la 0018 est rejouée un jour, rejouer celle-ci ensuite.
-- Avant, un rappel n'était créé que lorsque l'inscrit lui-même chargeait une page. Désormais, traiter_sessions_live()
-- traite toutes les sessions et tous les inscrits : toutes les minutes par la base (pg_cron), et à chaque chargement de
-- la cloche par n'importe quel compte (filet si la tâche planifiée manque).

begin;

-- ─── Suivi des nouveaux envois ──────────────────────────────────────────────────────────────────────
alter table public.inscriptions_sessions add column if not exists rappel_dix_le timestamptz;
-- À la première application seulement, les sessions déjà commencées ne sont pas annoncées après coup (rejouée plus
-- tard, la migration ne retire pas l'annonce d'un live en cours).
do $colonne$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sessions_live' and column_name = 'debut_annonce_le'
  ) then
    alter table public.sessions_live add column debut_annonce_le timestamptz;
    update public.sessions_live set debut_annonce_le = now() where debut <= now();
  end if;
end
$colonne$;

-- ─── Le traitement de toutes les sessions ───────────────────────────────────────────────────────────
-- Chaque envoi est d'abord réservé (update … where … is null returning), puis envoyé : deux traitements simultanés
-- (tâche planifiée et cloche) n'envoient jamais deux fois la même notification.
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

-- La cloche le demande en se chargeant : le traitement de toutes les sessions, pas seulement celles du compte.
create or replace function public.rappels_sessions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  return public.traiter_sessions_live();
end;
$$;

-- ─── S'inscrire : le rappel 10 min est marqué envoyé s'il est déjà passé ─────────────────────────────
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
  insert into public.inscriptions_sessions (session_id, profil_id, rappel_veille_le, rappel_heure_le, rappel_dix_le)
  values (
    p_session,
    (select auth.uid()),
    case when now() >= v.debut - interval '24 hours' then now() end,
    case when now() >= v.debut - interval '1 hour' then now() end,
    case when now() >= v.debut - interval '10 minutes' then now() end
  )
  on conflict do nothing;
end;
$$;

-- ─── Une session déplacée : ses rappels et son annonce repartent de zéro ─────────────────────────────
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
    update public.inscriptions_sessions set rappel_veille_le = null, rappel_heure_le = null, rappel_dix_le = null where session_id = p_session;
    update public.sessions_live set debut_annonce_le = null where id = p_session;
  end if;
  if v_heure_changee or p_duree is distinct from v.duree_minutes or v_lien is distinct from v.lien then
    perform public.notifier(
      array(select profil_id from public.inscriptions_sessions where session_id = p_session), 'sessions_live',
      'Session live modifiée', v_titre || ' : ' || public.quand_session(p_debut) || '.', '/evenements'
    );
  end if;
end;
$$;

-- ─── Droits d'exécution ─────────────────────────────────────────────────────────────────────────────
revoke execute on function public.traiter_sessions_live() from public, anon, authenticated;
revoke execute on function public.rappels_sessions() from public, anon;
grant execute on function public.rappels_sessions() to authenticated;
revoke execute on function public.sinscrire_session(uuid) from public, anon;
grant execute on function public.sinscrire_session(uuid) to authenticated;
revoke execute on function public.modifier_session(uuid, text, text, timestamptz, integer, text, uuid, uuid) from public, anon;
grant execute on function public.modifier_session(uuid, text, text, timestamptz, integer, text, uuid, uuid) to authenticated;

commit;

-- ─── La tâche planifiée (pg_cron) : toutes les minutes ──────────────────────────────────────────────
-- Hors de la transaction : sans pg_cron (extension indisponible), un simple avertissement, la migration reste appliquée.
-- Dans ce cas : Supabase → Integrations → Cron → Enable, puis relancer ce seul bloc.
do $cron$
begin
  begin
    create extension if not exists pg_cron with schema pg_catalog;
  exception when others then
    raise notice 'pg_cron indisponible (%) : activez Cron dans Supabase, puis relancez ce bloc.', sqlerrm;
    return;
  end;
  -- Même nom : la tâche est remplacée, jamais doublée. L'historique des passages (1 440 par jour) est purgé chaque
  -- nuit au-delà de 7 jours. Un refus (droits sur le schéma cron) reste un avertissement : la migration est appliquée.
  begin
    perform cron.schedule('etudium-sessions-live', '* * * * *', 'select public.traiter_sessions_live()');
    perform cron.schedule('etudium-purge-cron', '30 3 * * *', $purge$delete from cron.job_run_details where end_time < now() - interval '7 days'$purge$);
  exception when others then
    raise notice 'Tâche planifiée non créée (%) : voir le guide « Ce qui te revient », section 28.', sqlerrm;
  end;
end
$cron$;
