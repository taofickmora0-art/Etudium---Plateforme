-- Migration 0048 : le lien compétence → monétisation (restructuration validée le 20 octobre 2026, §5.3 ; liste du 31
-- octobre 2026, tâche 14). Une formation du parcours Business indique la ou les formations de Compétences digitales
-- qu'elle apprend à vendre (« Trouver des clients en design graphique » → « Maîtriser Canva ») ; sans lien, elle vaut
-- « pour toutes les compétences ». Le formateur de la formation Business ou l'équipe le règle, au même endroit que ses
-- parcours ; tout le monde le lit, pour des formations qu'il peut voir. Rejouable.

begin;

create table if not exists public.formations_monetisation (
  business_id uuid not null references public.formations (id) on delete cascade,
  competence_id uuid not null references public.formations (id) on delete cascade,
  cree_le timestamptz not null default now(),
  primary key (business_id, competence_id),
  constraint formations_monetisation_distinctes check (business_id <> competence_id)
);
create index if not exists formations_monetisation_competence_idx on public.formations_monetisation (competence_id);
alter table public.formations_monetisation enable row level security;

-- ─── Ce qui se lie : une formation Business vers une compétence publiée de Compétences digitales ────
create or replace function public.verifier_monetisation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.formations_parcours fp
    join public.parcours pa on pa.id = fp.parcours_id
    where fp.formation_id = new.business_id and pa.couleur = 'business'
  ) then
    raise exception 'Seule une formation du parcours Business se lie à une compétence.';
  end if;
  if not exists (
    select 1 from public.formations f
    join public.formations_parcours fp on fp.formation_id = f.id
    join public.parcours pa on pa.id = fp.parcours_id
    where f.id = new.competence_id and f.statut = 'publiee' and pa.couleur = 'digital'
  ) then
    raise exception 'Choisissez une formation publiée du parcours Compétences digitales.';
  end if;
  return new;
end;
$$;

drop trigger if exists formations_monetisation_verifier on public.formations_monetisation;
create trigger formations_monetisation_verifier
  before insert or update on public.formations_monetisation
  for each row execute function public.verifier_monetisation();

-- ─── Qui lit, qui écrit ─────────────────────────────────────────────────────────────────────────────
-- Lire : les deux formations doivent être visibles du lecteur (publiées, ou l'équipe, ou le formateur de la sienne).
drop policy if exists "lien visible avec ses formations" on public.formations_monetisation;
create policy "lien visible avec ses formations" on public.formations_monetisation
  for select to anon, authenticated
  using (
    exists (select 1 from public.formations f where f.id = formations_monetisation.business_id)
    and exists (select 1 from public.formations f where f.id = formations_monetisation.competence_id)
  );

-- Écrire : l'équipe, ou le formateur de la formation Business.
drop policy if exists "l'équipe ou le formateur lie" on public.formations_monetisation;
create policy "l'équipe ou le formateur lie" on public.formations_monetisation
  for insert to authenticated
  with check ((select public.equipe_contenus()) or public.formateur_de(business_id));

drop policy if exists "l'équipe ou le formateur délie" on public.formations_monetisation;
create policy "l'équipe ou le formateur délie" on public.formations_monetisation
  for delete to authenticated
  using ((select public.equipe_contenus()) or public.formateur_de(business_id));

revoke execute on function public.verifier_monetisation() from public, anon, authenticated;

commit;
