-- Étudium · migration 0013 : page Utilisateurs du back-office (spec des utilisateurs et des rôles, 13 octobre 2026).
-- À appliquer dans Supabase, après la 0012 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancé sur une base qui l'a déjà, il ne change rien et ne casse rien.

begin;

-- ─── Suspension d'un compte ─────────────────────────────────────────────────────────────────────────
-- Une ligne par compte suspendu : depuis quand, par qui, pourquoi (motif visible de l'équipe seulement).
-- Aucune règle d'accès : la table n'est lue et écrite que par les fonctions ci-dessous.
create table if not exists public.suspensions (
  profil_id uuid primary key references public.profils (id) on delete cascade,
  depuis timestamptz not null default now(),
  par uuid references public.profils (id) on delete set null,
  motif text not null default '',
  constraint suspensions_motif_longueur check (char_length(motif) <= 500)
);
alter table public.suspensions enable row level security;
revoke all on public.suspensions from anon, authenticated;

-- Le compte qui fait la requête est-il suspendu ? (Un visiteur ne l'est jamais.)
create or replace function public.compte_suspendu()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.suspensions where profil_id = (select auth.uid()));
$$;
grant execute on function public.compte_suspendu() to anon, authenticated;

-- ─── Un compte suspendu perd tous ses droits ────────────────────────────────────────────────────────
-- Les fonctions de droits sont redéfinies à l'identique, avec la condition « pas suspendu » en tête.

-- Rôles (0001) : un compte suspendu n'en a plus aucun.
create or replace function public.a_role(r public.role_etudium)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not public.compte_suspendu() and exists (
    select 1 from public.roles
    where profil_id = (select auth.uid()) and role = r
  );
$$;

-- Équipe des contenus (0004) : back-office, contenus, couvertures, ressources.
create or replace function public.equipe_contenus()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not public.compte_suspendu() and exists (
    select 1 from public.roles
    where profil_id = (select auth.uid()) and role in ('admin', 'moderateur', 'super_admin')
  );
$$;

-- Accès à une leçon (0004) : aucune pour un compte suspendu, pas même les aperçus. La progression et le visionnage
-- (0007, 0008) passent par cette fonction : ils sont refusés eux aussi.
create or replace function public.acces_lecon(p_lecon uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not public.compte_suspendu() and (
    public.equipe_contenus() or exists (
      select 1
      from public.lecons l
      join public.modules m on m.id = l.module_id
      join public.formations f on f.id = m.formation_id
      where l.id = p_lecon
        and f.statut = 'publiee'
        and (l.apercu or (f.gratuite and (select auth.uid()) is not null))
    )
  );
$$;

-- Avis (0010) : ni en donner, ni en supprimer.
create or replace function public.peut_donner_avis(p_formation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and not public.compte_suspendu()
    and exists (select 1 from public.formations f where f.id = p_formation and f.statut = 'publiee')
    and (
      select count(*) > 0 and count(p.terminee_le) * 2 >= count(*)
      from public.lecons l
      join public.modules m on m.id = l.module_id
      left join public.progression_lecons p on p.lecon_id = l.id and p.profil_id = (select auth.uid())
      where m.formation_id = p_formation
    );
$$;

create or replace function public.supprimer_avis(p_formation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.compte_suspendu() then
    raise exception 'Ce compte est suspendu.' using errcode = '42501';
  end if;
  delete from public.avis where profil_id = (select auth.uid()) and formation_id = p_formation;
end;
$$;

-- Ses propres données : ni lecture ni écriture. Ces règles « restrictives » s'ajoutent aux règles existantes
-- (elles doivent toutes deux être vraies) sans les réécrire. Elles ne visent que le compte qui demande :
-- l'équipe lit toujours le profil d'un compte suspendu.
do $$
declare
  t text;
begin
  foreach t in array array['profils', 'notes_lecons', 'favoris', 'avis', 'progression_lecons'] loop
    execute format('drop policy if exists %I on public.%I', 'compte suspendu : rien', t);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated
         using (not (select public.compte_suspendu())) with check (not (select public.compte_suspendu()))',
      'compte suspendu : rien', t
    );
  end loop;
end;
$$;

-- ─── Suspendre et réactiver ─────────────────────────────────────────────────────────────────────────
-- Un admin ou le super admin, pour un étudiant ou un formateur ; le super admin seul pour un membre de l'équipe.
-- Personne ne se suspend soi-même ; un compte super admin ne se suspend pas (retirer d'abord son rôle).
-- Suspendre un compte déjà suspendu ne change rien (date, auteur et motif d'origine gardés).
create or replace function public.suspendre_compte(p_compte uuid, p_motif text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.a_role('admin') or public.a_role('super_admin')) then
    raise exception 'Seuls un admin ou le super admin suspendent un compte.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profils where id = p_compte) then
    raise exception 'Compte introuvable.';
  end if;
  if p_compte = (select auth.uid()) then
    raise exception 'Vous ne pouvez pas suspendre votre propre compte.';
  end if;
  if exists (select 1 from public.roles where profil_id = p_compte and role = 'super_admin') then
    raise exception 'Retirez d’abord le rôle super admin de ce compte.';
  end if;
  if exists (select 1 from public.roles where profil_id = p_compte and role in ('moderateur', 'admin'))
     and not public.a_role('super_admin') then
    raise exception 'Seul le super admin suspend un membre de l’équipe.';
  end if;
  insert into public.suspensions (profil_id, par, motif)
  values (p_compte, (select auth.uid()), left(regexp_replace(coalesce(p_motif, ''), '^\s+|\s+$', '', 'g'), 500))
  on conflict (profil_id) do nothing;
end;
$$;

create or replace function public.reactiver_compte(p_compte uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.a_role('admin') or public.a_role('super_admin')) then
    raise exception 'Seuls un admin ou le super admin réactivent un compte.' using errcode = '42501';
  end if;
  if exists (select 1 from public.roles where profil_id = p_compte and role in ('moderateur', 'admin', 'super_admin'))
     and not public.a_role('super_admin') then
    raise exception 'Seul le super admin réactive un membre de l’équipe.';
  end if;
  delete from public.suspensions where profil_id = p_compte;
end;
$$;

revoke execute on function public.suspendre_compte(uuid, text) from public, anon;
revoke execute on function public.reactiver_compte(uuid) from public, anon;
grant execute on function public.suspendre_compte(uuid, text) to authenticated;
grant execute on function public.reactiver_compte(uuid) to authenticated;

commit;
