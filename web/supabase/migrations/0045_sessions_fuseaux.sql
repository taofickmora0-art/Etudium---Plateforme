-- Migration 0045 : les heures des lives et leur fuseau (liste du 31 octobre 2026, tâche 10).
-- L'appli affiche désormais les heures des sessions à l'heure de l'appareil de chacun, avec son décalage (« 14 h 00 (GMT) »
-- au Togo). Les notifications, elles, sont écrites une fois par la base, à l'heure du Bénin : elles le disent, « (GMT+1) ».
-- Et « Rejoindre » n'ouvrant le lien qu'à l'heure du début, les rappels ne disent plus que le lien est ouvert 10 min
-- avant. Mêmes définitions qu'en 0018 (quand_session, heure_session) et 0036 (traiter_sessions_live), avec ces textes.
-- Rejouable.

begin;

-- « samedi 24 octobre à 15 h 00 (GMT+1) ».
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
    || ' à ' || extract(hour from t)::int || ' h ' || to_char(t, 'MI') || ' (GMT+1)'
  from b;
$$;

-- « 15 h 00 (GMT+1) ».
create or replace function public.heure_session(p_debut timestamptz)
returns text
language sql
immutable
set search_path = ''
as $$
  with b as (select (p_debut at time zone 'UTC') + interval '1 hour' as t)
  select extract(hour from t)::int || ' h ' || to_char(t, 'MI') || ' (GMT+1)' from b;
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
      r.titre || ', à ' || public.heure_session(r.debut) || '. Rejoignez-la depuis la page Événements, à l’heure du début.',
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
      r.titre || ', à ' || public.heure_session(r.debut) || '. « Rejoindre » s’ouvre à l’heure du début.', '/evenements', true
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

commit;
