-- Migration 0058 : les notifications push et les e-mails importants (lot 5, étape B ; spec du 15 octobre 2026, mise à
-- jour le 1er novembre). Une file d'envoi en base :
--   - le push suit les notifications de l'appli, pour qui a enregistré un appareil et n'a pas coupé « Notifications
--     push » ;
--   - l'e-mail part pour ce qui est important (abonnement, paiement, compte), même si l'appli est coupée ;
--   - le serveur de l'appli prend la file avec un jeton (la base n'en garde que l'empreinte), envoie, puis termine
--     chaque envoi : 4 essais au plus (1, 5, 15 minutes d'écart), abandon après 24 heures.
-- Un paiement en ligne confirmé crée maintenant la notification « Paiement reçu ». Rejouable : le jeton n'est créé
-- qu'une fois (affiché à la fin) ; select public.nouveau_jeton_envois(); en crée un autre.

begin;

-- ─── Les appareils (push) ───────────────────────────────────────────────────────────────────────────
create table if not exists public.appareils_push (
  id uuid primary key default gen_random_uuid(),
  profil_id uuid not null references public.profils (id) on delete cascade,
  adresse text not null unique,
  cle_p256dh text not null,
  cle_auth text not null,
  cree_le timestamptz not null default now(),
  vu_le timestamptz not null default now(),
  constraint appareils_push_adresse check (adresse ~ '^https://' and char_length(adresse) <= 1000),
  constraint appareils_push_cles check (char_length(cle_p256dh) between 1 and 200 and char_length(cle_auth) between 1 and 100)
);
create index if not exists appareils_push_profil on public.appareils_push (profil_id, vu_le desc);
alter table public.appareils_push enable row level security;
revoke all on public.appareils_push from anon, authenticated;
grant select on public.appareils_push to authenticated;
drop policy if exists "appareils_push : chacun les siens" on public.appareils_push;
create policy "appareils_push : chacun les siens" on public.appareils_push
  for select to authenticated using (profil_id = (select auth.uid()));

-- ─── La file d'envoi ────────────────────────────────────────────────────────────────────────────────
create table if not exists public.envois (
  id bigint generated always as identity primary key,
  canal text not null,
  destinataire uuid not null references public.profils (id) on delete cascade,
  titre text not null,
  texte text not null default '',
  lien text,
  statut text not null default 'a_envoyer',
  essais integer not null default 0,
  prochain_essai timestamptz not null default now(),
  pris_le timestamptz,
  erreur text,
  cree_le timestamptz not null default now(),
  constraint envois_canal check (canal in ('push', 'email')),
  constraint envois_statut check (statut in ('a_envoyer', 'envoye', 'abandonne'))
);
create index if not exists envois_a_envoyer on public.envois (prochain_essai) where statut = 'a_envoyer';
alter table public.envois enable row level security;
revoke all on public.envois from anon, authenticated;

-- ─── Le jeton du serveur (empreinte seulement) ──────────────────────────────────────────────────────
create table if not exists public.reglages_envois (
  id boolean primary key default true check (id),
  empreinte text
);
insert into public.reglages_envois (id) values (true) on conflict (id) do nothing;
alter table public.reglages_envois enable row level security;
revoke all on public.reglages_envois from anon, authenticated;

create or replace function public.nouveau_jeton_envois()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jeton text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  update public.reglages_envois set empreinte = encode(sha256(convert_to(v_jeton, 'UTF8')), 'hex') where id;
  return v_jeton;
end;
$$;

create or replace function public.exiger_jeton_envois(p_jeton text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_jeton is null or char_length(p_jeton) < 32
     or encode(sha256(convert_to(p_jeton, 'UTF8')), 'hex') is distinct from (select r.empreinte from public.reglages_envois r where r.id) then
    raise exception 'Jeton d’envoi non reconnu.' using errcode = '42501';
  end if;
end;
$$;

-- ─── Enregistrer ou retirer un appareil ─────────────────────────────────────────────────────────────
create or replace function public.enregistrer_appareil(p_adresse text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
begin
  if v_moi is null or public.compte_suspendu() then
    raise exception 'Connectez-vous pour recevoir les notifications push.' using errcode = '42501';
  end if;
  insert into public.appareils_push (profil_id, adresse, cle_p256dh, cle_auth)
  values (v_moi, p_adresse, p_p256dh, p_auth)
  on conflict (adresse) do update
    set profil_id = excluded.profil_id, cle_p256dh = excluded.cle_p256dh, cle_auth = excluded.cle_auth, vu_le = now();
  -- 10 appareils au plus par compte : les plus anciens partent.
  delete from public.appareils_push a
  where a.profil_id = v_moi
    and a.id not in (select b.id from public.appareils_push b where b.profil_id = v_moi order by b.vu_le desc, b.cree_le desc limit 10);
end;
$$;

create or replace function public.retirer_appareil(p_adresse text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.appareils_push where adresse = p_adresse and profil_id = (select auth.uid());
$$;

-- ─── Ce qui part par e-mail ─────────────────────────────────────────────────────────────────────────
-- L'abonnement et le paiement : les rappels d'expiration, et les notifications de service qui mènent à l'abonnement.
create or replace function public.notification_importante(p_categorie text, p_lien text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_categorie = 'expiration_renouvellement' or (p_categorie = 'service' and coalesce(p_lien, '') like '/abonnement%');
$$;

-- notifier : même définition qu'en 0036, plus l'e-mail d'une notification importante, mis dans la file avant les
-- filtres de préférences (« Toujours actif »).
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

  if public.notification_importante(p_categorie, p_lien) then
    insert into public.envois (canal, destinataire, titre, texte, lien)
    select 'email', p.id, left(p_titre, 200), left(coalesce(p_texte, ''), 400), p_lien
    from public.profils p
    where p.id = any (p_destinataires)
      and (coalesce(p_auteur_inclus, false) or p.id is distinct from (select auth.uid()));
  end if;

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

-- ─── Le push : chaque notification écrite, pour qui a un appareil ───────────────────────────────────
create or replace function public.pousser_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.envois (canal, destinataire, titre, texte, lien)
  select 'push', n.destinataire, n.titre, n.texte, n.lien
  from lignes n
  join public.profils p on p.id = n.destinataire
  where (p.preferences_notifications ->> 'canal_push') is distinct from 'false'
    and exists (select 1 from public.appareils_push a where a.profil_id = n.destinataire);
  return null;
end;
$$;
drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push
  after insert on public.notifications
  referencing new table as lignes
  for each statement execute function public.pousser_notifications();

-- ─── « Paiement reçu » : un abonnement payé en ligne (ou offert par un code) ────────────────────────
-- Un abonnement attribué à la main a déjà sa notification (0054).
create or replace function public.notifier_paiement_recu()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paiement public.paiements;
  v_formule text;
begin
  select * into v_paiement from public.paiements p where p.id = new.paiement_id;
  if not found or v_paiement.source = 'manuel' then
    return null;
  end if;
  select f.nom into v_formule from public.formules f where f.id = new.formule_id;
  perform public.notifier(
    array[new.profil_id],
    'service',
    case when v_paiement.montant > 0
      then format('Paiement reçu : votre abonnement %s est actif', v_formule)
      else format('Votre abonnement %s est actif', v_formule) end,
    case when v_paiement.montant > 0
      then format('Jusqu’au %s.', public.date_longue(new.fin)) || coalesce(format(' Votre reçu : %s.', v_paiement.numero_recu), '')
      else format('Offert par votre code promo, jusqu’au %s.', public.date_longue(new.fin)) end,
    case when v_paiement.numero_recu is not null then '/abonnement/recus/' || v_paiement.numero_recu else '/abonnement' end,
    true
  );
  return null;
end;
$$;
drop trigger if exists abonnements_paiement_recu on public.abonnements;
create trigger abonnements_paiement_recu
  after insert on public.abonnements
  for each row when (new.paiement_id is not null)
  execute function public.notifier_paiement_recu();

-- ─── Le compte suspendu ou réactivé : un e-mail (un compte suspendu ne voit plus l'appli) ───────────
create or replace function public.email_suspension()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.envois (canal, destinataire, titre, texte, lien)
    values ('email', new.profil_id, 'Votre compte Étudium est suspendu', 'Pour en savoir plus, écrivez à l’équipe Étudium depuis la page Aide.', '/aide');
  else
    insert into public.envois (canal, destinataire, titre, texte, lien)
    values ('email', old.profil_id, 'Votre compte Étudium est réactivé', 'Vous retrouvez tous vos accès.', '/accueil');
  end if;
  return null;
end;
$$;
drop trigger if exists suspensions_email on public.suspensions;
create trigger suspensions_email
  after insert or delete on public.suspensions
  for each row execute function public.email_suspension();

-- ─── Le serveur prend la file, puis termine chaque envoi ────────────────────────────────────────────
create or replace function public.prendre_envois(p_jeton text, p_canaux text[], p_limite integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resultat jsonb;
begin
  perform public.exiger_jeton_envois(p_jeton);
  -- Plus de 24 heures : trop tard pour prévenir.
  update public.envois set statut = 'abandonne', erreur = coalesce(erreur, 'Trop ancien'), pris_le = null
  where statut = 'a_envoyer' and cree_le < now() - interval '24 hours';

  with pris as (
    select e.id from public.envois e
    where e.statut = 'a_envoyer'
      and e.canal = any (coalesce(p_canaux, '{}'))
      and e.prochain_essai <= now()
      and (e.pris_le is null or e.pris_le < now() - interval '2 minutes')
    order by e.id
    limit greatest(1, least(coalesce(p_limite, 20), 50))
    for update skip locked
  ),
  reserves as (
    update public.envois e set pris_le = now(), essais = e.essais + 1
    from pris where e.id = pris.id
    returning e.*
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'canal', r.canal,
      'titre', r.titre,
      'texte', r.texte,
      'lien', r.lien,
      'email', case when r.canal = 'email' then (select u.email from auth.users u where u.id = r.destinataire) end,
      'prenom', (select nullif(btrim(p.prenom), '') from public.profils p where p.id = r.destinataire),
      'appareils', case when r.canal = 'push' then coalesce((
        select jsonb_agg(jsonb_build_object('adresse', a.adresse, 'p256dh', a.cle_p256dh, 'auth', a.cle_auth))
        from public.appareils_push a where a.profil_id = r.destinataire
      ), '[]'::jsonb) else '[]'::jsonb end
    )
    order by r.id
  ), '[]'::jsonb) into v_resultat
  from reserves r;
  return v_resultat;
end;
$$;

create or replace function public.terminer_envoi(p_jeton text, p_id bigint, p_reussi boolean, p_erreur text, p_disparus text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_jeton_envois(p_jeton);
  delete from public.appareils_push where adresse = any (coalesce(p_disparus, '{}'));
  if p_reussi then
    update public.envois set statut = 'envoye', pris_le = null, erreur = null where id = p_id;
    return;
  end if;
  -- 4 essais au plus : un nouvel essai 1, 5 puis 15 minutes plus tard, puis abandon.
  update public.envois
  set statut = case when essais >= 4 then 'abandonne' else 'a_envoyer' end,
      pris_le = null,
      erreur = left(coalesce(p_erreur, 'Échec'), 500),
      prochain_essai = now() + case essais when 1 then interval '1 minute' when 2 then interval '5 minutes' else interval '15 minutes' end
  where id = p_id;
end;
$$;

create or replace function public.purger_envois()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.envois where cree_le < now() - interval '7 days';
$$;

-- ─── Droits ─────────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public.nouveau_jeton_envois() from public, anon, authenticated;
revoke execute on function public.exiger_jeton_envois(text) from public, anon, authenticated;
revoke execute on function public.notification_importante(text, text) from public, anon, authenticated;
revoke execute on function public.pousser_notifications() from public, anon, authenticated;
revoke execute on function public.notifier_paiement_recu() from public, anon, authenticated;
revoke execute on function public.email_suspension() from public, anon, authenticated;
revoke execute on function public.purger_envois() from public, anon, authenticated;
revoke execute on function public.notifier(uuid[], text, text, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.enregistrer_appareil(text, text, text) from public, anon;
revoke execute on function public.retirer_appareil(text) from public, anon;
revoke execute on function public.prendre_envois(text, text[], integer) from public;
revoke execute on function public.terminer_envoi(text, bigint, boolean, text, text[]) from public;
grant execute on function public.enregistrer_appareil(text, text, text) to authenticated;
grant execute on function public.retirer_appareil(text) to authenticated;
-- Le serveur appelle avec ou sans session : le jeton fait foi.
grant execute on function public.prendre_envois(text, text[], integer) to anon, authenticated;
grant execute on function public.terminer_envoi(text, bigint, boolean, text, text[]) to anon, authenticated;

commit;

-- ─── La purge, chaque jour à 4 h 10 ─────────────────────────────────────────────────────────────────
do $cron$
begin
  begin
    create extension if not exists pg_cron with schema pg_catalog;
  exception when others then
    raise notice 'pg_cron indisponible (%) : activez Cron dans Supabase, puis relancez ce bloc.', sqlerrm;
    return;
  end;
  begin
    perform cron.schedule('etudium-envois-purge', '10 4 * * *', 'select public.purger_envois()');
  exception when others then
    raise notice 'Tâche planifiée non créée (%) : voir le guide « Ce qui te revient », section 59.', sqlerrm;
  end;
end
$cron$;

-- ─── Le jeton : affiché une seule fois. Recopie-le dans web/.env.local (ENVOIS_JETON=…). ────────────
select case
  when (select empreinte from public.reglages_envois where id) is null then public.nouveau_jeton_envois()
  else 'Jeton déjà créé. Pour en créer un autre : select public.nouveau_jeton_envois();'
end as jeton_envois;
