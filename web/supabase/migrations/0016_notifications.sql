-- Étudium · migration 0016 : centre de notifications (spec des notifications, 14 octobre 2026).
-- À appliquer dans Supabase, après la 0015 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancé sur une base qui l'a déjà, il ne change rien et ne casse rien. Si une migration plus ancienne
-- est rejouée un jour (0004, 0010, 0013, 0014…), rejouer celle-ci ensuite.

begin;

-- ─── Notifications ──────────────────────────────────────────────────────────────────────────────────
-- Une ligne par destinataire. Seule la base les écrit (notifier, plus bas) ; chacun lit les siennes et les marque lues.
-- Catégories : les 8 de l'onglet Notifications du profil, plus « service » (compte et travail : toujours envoyée).
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  destinataire uuid not null references public.profils (id) on delete cascade,
  categorie text not null,
  titre text not null,
  texte text not null default '',
  -- Toujours une adresse du site.
  lien text,
  cree_le timestamptz not null default now(),
  lue_le timestamptz,
  constraint notifications_categorie check (categorie in (
    'nouveaux_contenus', 'sessions_live', 'expiration_renouvellement', 'exercices', 'rappels_apprentissage',
    'communaute', 'recommandations', 'annonces', 'service'
  )),
  constraint notifications_titre_longueur check (char_length(titre) between 1 and 200),
  constraint notifications_texte_longueur check (char_length(texte) <= 400),
  constraint notifications_lien check (lien is null or (lien ~ '^/' and lien !~ '^//'))
);
-- La cloche et la page lisent les plus récentes d'un compte ; l'identifiant croissant sert aussi de curseur.
create index if not exists notifications_destinataire_idx on public.notifications (destinataire, id desc);

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (lue_le) on public.notifications to authenticated;

drop policy if exists "ses notifications : lecture" on public.notifications;
create policy "ses notifications : lecture" on public.notifications
  for select to authenticated
  using (destinataire = (select auth.uid()));

drop policy if exists "ses notifications : marquées lues" on public.notifications;
create policy "ses notifications : marquées lues" on public.notifications
  for update to authenticated
  using (destinataire = (select auth.uid()))
  with check (destinataire = (select auth.uid()));

-- Comme les autres tables du compte (0013) : plus rien pour un compte suspendu.
drop policy if exists "compte suspendu : rien" on public.notifications;
create policy "compte suspendu : rien" on public.notifications
  as restrictive for all to authenticated
  using (not (select public.compte_suspendu())) with check (not (select public.compte_suspendu()));

-- ─── Envoyer ────────────────────────────────────────────────────────────────────────────────────────
-- Interne : appelée par les déclencheurs et les fonctions de cette migration, jamais par un compte.
-- - Jamais pour l'auteur de l'action (le compte de la requête).
-- - « Notifications dans l’appli » coupé : rien, service compris ; une catégorie coupée : rien de cette catégorie.
--   Une clé absente des préférences vaut « activée », comme dans l'appli.
-- - Efface au passage les notifications de plus de 6 mois de ces destinataires.
-- Rend le nombre de notifications enregistrées.
create or replace function public.notifier(p_destinataires uuid[], p_categorie text, p_titre text, p_texte text, p_lien text)
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
    and p.id is distinct from (select auth.uid())
    and (p.preferences_notifications ->> 'canal_appli') is distinct from 'false'
    and (p_categorie = 'service' or (p.preferences_notifications ->> p_categorie) is distinct from 'false');
  get diagnostics v_nombre = row_count;
  return v_nombre;
end;
$$;

-- ─── Lire et marquer lues ───────────────────────────────────────────────────────────────────────────
-- Les plus récentes d'abord ; « Voir plus » repart de la dernière lue (p_avant). Les règles d'accès filtrent.
create or replace function public.mes_notifications(p_non_lues boolean default false, p_avant bigint default null, p_nombre integer default 20)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with taille as (
    select least(greatest(coalesce(p_nombre, 20), 1), 50) as n
  ),
  lot as (
    select n.id, n.categorie, n.titre, n.texte, n.lien, n.cree_le, n.lue_le is not null as lue
    from public.notifications n
    where n.destinataire = (select auth.uid())
      and (not coalesce(p_non_lues, false) or n.lue_le is null)
      and (p_avant is null or n.id < p_avant)
    order by n.id desc
    limit (select n + 1 from taille)
  )
  select jsonb_build_object(
    'lignes', coalesce(
      (select jsonb_agg(to_jsonb(l) order by l.id desc)
       from (select * from lot order by id desc limit (select n from taille)) l),
      '[]'::jsonb
    ),
    'suite', (select count(*) from lot) > (select n from taille),
    'non_lues', (
      select count(*)::integer from public.notifications
      where destinataire = (select auth.uid()) and lue_le is null
    )
  );
$$;

-- Toutes les siennes (p_ids nul), ou seulement celles-ci.
create or replace function public.marquer_lues(p_ids bigint[] default null)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.notifications set lue_le = now()
  where destinataire = (select auth.uid()) and lue_le is null and (p_ids is null or id = any (p_ids));
$$;

revoke execute on function public.notifier(uuid[], text, text, text, text) from public, anon, authenticated;
revoke execute on function public.mes_notifications(boolean, bigint, integer) from public, anon;
revoke execute on function public.marquer_lues(bigint[]) from public, anon;
grant execute on function public.mes_notifications(boolean, bigint, integer) to authenticated;
grant execute on function public.marquer_lues(bigint[]) to authenticated;

commit;
