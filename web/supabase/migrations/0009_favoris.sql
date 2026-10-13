-- Étudium · migration 0009 : favoris, formations archivées commencées, date de première ouverture (tâche 1.9).
-- À appliquer dans Supabase, après la 0008 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancé sur une base qui l'a déjà, il ne change rien et ne casse rien.

begin;

-- ─── Favoris : des formations (CDC §24), mises de côté depuis leur fiche ───────────────────────────
create table if not exists public.favoris (
  profil_id uuid not null default auth.uid() references public.profils (id) on delete cascade,
  formation_id uuid not null references public.formations (id) on delete cascade,
  ajoute_le timestamptz not null default now(),
  primary key (profil_id, formation_id)
);
create index if not exists favoris_formation_idx on public.favoris (formation_id);

alter table public.favoris enable row level security;
revoke all on public.favoris from anon;
revoke update, truncate on public.favoris from authenticated;

drop policy if exists "ses favoris : lecture" on public.favoris;
create policy "ses favoris : lecture" on public.favoris
  for select to authenticated
  using (profil_id = (select auth.uid()));

-- On n'ajoute qu'une formation publiée ; un favori reste en place si la formation est archivée ensuite.
drop policy if exists "ses favoris : ajout" on public.favoris;
create policy "ses favoris : ajout" on public.favoris
  for insert to authenticated
  with check (
    profil_id = (select auth.uid())
    and exists (select 1 from public.formations f where f.id = formation_id and f.statut = 'publiee')
  );

drop policy if exists "ses favoris : suppression" on public.favoris;
create policy "ses favoris : suppression" on public.favoris
  for delete to authenticated
  using (profil_id = (select auth.uid()));

-- ─── Une formation archivée reste visible pour qui l'a commencée (spec §3, R24) ─────────────────────
-- « Mes formations » la montre verrouillée, avec la progression intacte. Ses leçons restent fermées : acces_lecon
-- exige une formation publiée. Fonction security definer : lire la progression depuis la règle des formations, sans
-- repasser par les règles des leçons et des modules (qui renvoient elles-mêmes aux formations).
create or replace function public.formation_commencee(p_formation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.progression_lecons p
    join public.lecons l on l.id = p.lecon_id
    join public.modules m on m.id = l.module_id
    where m.formation_id = p_formation and p.profil_id = (select auth.uid())
  );
$$;
revoke execute on function public.formation_commencee(uuid) from public;
grant execute on function public.formation_commencee(uuid) to anon, authenticated;

drop policy if exists "formations publiées visibles" on public.formations;
create policy "formations publiées visibles" on public.formations
  for select to anon, authenticated
  using (statut = 'publiee' or (select public.equipe_contenus()) or public.formation_commencee(id));

-- ─── Date de première ouverture (0008) : jamais après la dernière visite ─────────────────────────────
-- Les lignes antérieures à la 0008 ont reçu la date de la migration ; on reprend la dernière visite connue.
update public.progression_lecons set ouverte_le = vue_le where ouverte_le > vue_le;

commit;
