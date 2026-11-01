-- Migration 0052 : les rappels d'expiration des abonnements (lot 2, spec du 1er novembre 2026, §8). Des notifications
-- dans l'appli (catégorie « Expiration et renouvellement ») 7 jours avant la fin, la veille et le jour de l'expiration,
-- chacune une seule fois, sur la fin réelle de l'accès (un abonnement suivi d'un autre n'en reçoit pas). Elles partent
-- par la tâche planifiée et à l'ouverture de la cloche, comme les rappels des lives. Au passage, une préparation jamais
-- envoyée à Payiz est notée expirée après une heure ; un paiement envoyé attend la réponse de Payiz (relecture,
-- notification). Les e-mails de rappel viendront avec le lot 5 B. Rejouable.

begin;

-- « 14 mars 2027 », « 1er mai 2027 », à l'heure du Bénin.
create or replace function public.date_longue(p timestamptz)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when extract(day from l) = 1 then '1er' else extract(day from l)::integer::text end
    || ' '
    || (array['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'])[extract(month from l)::integer]
    || ' '
    || extract(year from l)::integer::text
  from (select p at time zone 'Africa/Porto-Novo' as l) x;
$$;

create or replace function public.traiter_abonnements()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_total integer := 0;
  v_jours integer;
  v_prolonger constant text := 'Prolongez-le pour garder l’accès à tout.';
begin
  -- Le compte qui ouvre sa cloche reçoit aussi ses propres rappels (notifier exclut sinon l'auteur de l'appel).
  -- Une seule exécution à la fois (tâche planifiée et cloches ouvertes en même temps).
  if not pg_try_advisory_xact_lock(hashtext('etudium.traiter_abonnements')) then
    return 0;
  end if;

  -- Les préparations jamais envoyées à Payiz n'aboutiront plus. Un paiement envoyé garde son état : seul Payiz sait
  -- s'il a été payé (relecture de « Mon abonnement », notification).
  update public.paiements
  set statut = 'expire'
  where statut = 'en_attente' and payiz_id is null and cree_le < now() - interval '1 hour';

  -- Le jour de l'expiration (et les 3 jours suivants, si la tâche ne passe pas) : les deux autres rappels sont notés
  -- envoyés, pour ne jamais les recevoir après coup.
  for r in
    update public.abonnements a
    set rappel_fin_le = now(), rappel_veille_le = coalesce(a.rappel_veille_le, now()), rappel_7j_le = coalesce(a.rappel_7j_le, now())
    where a.rappel_fin_le is null and a.annule_le is null
      and a.fin <= now() and now() < a.fin + interval '3 days'
      and not exists (select 1 from public.abonnements b where b.profil_id = a.profil_id and b.annule_le is null and b.fin > a.fin)
    returning a.profil_id, a.formule_id
  loop
    perform public.notifier(
      array[r.profil_id], 'expiration_renouvellement',
      'Votre abonnement ' || (select f.nom from public.formules f where f.id = r.formule_id) || ' a expiré',
      'Vos formations payantes sont verrouillées. Votre progression et vos certificats restent sur votre compte.',
      '/abonnement/souscrire',
      true
    );
    v_total := v_total + 1;
  end loop;

  -- La veille.
  for r in
    update public.abonnements a
    set rappel_veille_le = now(), rappel_7j_le = coalesce(a.rappel_7j_le, now())
    where a.rappel_veille_le is null and a.annule_le is null
      and a.fin - interval '1 day' <= now() and now() < a.fin
      and not exists (select 1 from public.abonnements b where b.profil_id = a.profil_id and b.annule_le is null and b.fin > a.fin)
    returning a.profil_id, a.formule_id, a.fin
  loop
    perform public.notifier(
      array[r.profil_id], 'expiration_renouvellement',
      'Votre abonnement ' || (select f.nom from public.formules f where f.id = r.formule_id) || ' se termine demain',
      'Il prend fin le ' || public.date_longue(r.fin) || '. ' || v_prolonger,
      '/abonnement/souscrire',
      true
    );
    v_total := v_total + 1;
  end loop;

  -- 7 jours avant (ou plus tard si la tâche n'est pas passée : le titre dit le vrai nombre de jours).
  for r in
    update public.abonnements a
    set rappel_7j_le = now()
    where a.rappel_7j_le is null and a.annule_le is null
      and a.fin - interval '7 days' <= now() and now() < a.fin - interval '1 day'
      and not exists (select 1 from public.abonnements b where b.profil_id = a.profil_id and b.annule_le is null and b.fin > a.fin)
    returning a.profil_id, a.formule_id, a.fin
  loop
    v_jours := ceil(extract(epoch from (r.fin - now())) / 86400)::integer;
    perform public.notifier(
      array[r.profil_id], 'expiration_renouvellement',
      'Votre abonnement ' || (select f.nom from public.formules f where f.id = r.formule_id) || ' se termine dans ' || v_jours || ' jours',
      'Il prend fin le ' || public.date_longue(r.fin) || '. ' || v_prolonger,
      '/abonnement/souscrire',
      true
    );
    v_total := v_total + 1;
  end loop;

  return v_total;
end;
$$;

-- La cloche (dernière définition : 0041) : les publications programmées, les rappels d'abonnement, puis les lives.
create or replace function public.rappels_sessions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  -- Les publications programmées qui viennent de paraître (0041), les rappels d'abonnement (0052), puis les sessions live.
  perform public.traiter_publications_programmees();
  perform public.traiter_abonnements();
  return public.traiter_sessions_live();
end;
$$;

revoke execute on function public.date_longue(timestamptz) from public, anon, authenticated;
revoke execute on function public.traiter_abonnements() from public, anon, authenticated;

commit;

-- ─── La tâche planifiée, toutes les 15 minutes ──────────────────────────────────────────────────────
-- Sans pg_cron, la cloche suffit (rappels_sessions) : le rappel part au prochain chargement d'une cloche.
do $cron$
begin
  begin
    create extension if not exists pg_cron with schema pg_catalog;
  exception when others then
    raise notice 'pg_cron indisponible (%) : activez Cron dans Supabase, puis relancez ce bloc.', sqlerrm;
    return;
  end;
  begin
    perform cron.schedule('etudium-abonnements', '*/15 * * * *', 'select public.traiter_abonnements()');
  exception when others then
    raise notice 'Tâche planifiée non créée (%) : voir le guide « Ce qui te revient », section 56.', sqlerrm;
  end;
end
$cron$;
