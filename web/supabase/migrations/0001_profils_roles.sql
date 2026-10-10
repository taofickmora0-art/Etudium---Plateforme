-- Étudium · migration 0001 : profils, rôles et règles d'accès (spec du lot 0, §6).
-- À appliquer dans Supabase : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancé sur une base qui l'a déjà, il ne change rien et ne casse rien.

-- ─── Rôles ──────────────────────────────────────────────────────────────────
do $$
begin
  create type public.role_etudium as enum ('etudiant', 'formateur', 'moderateur', 'admin', 'super_admin');
exception
  when duplicate_object then null;
end
$$;

-- ─── Profils : une ligne par compte, créée à l'inscription ─────────────────
create table if not exists public.profils (
  id uuid primary key references auth.users (id) on delete cascade,
  prenom text not null default '' check (char_length(prenom) <= 50),
  nom text not null default '' check (char_length(nom) <= 50),
  telephone text,
  pays text,
  niveau_etudes text,
  etablissement text,
  filiere text,
  objectifs text,
  photo_url text,
  -- Les 8 catégories de l'onglet Notifications du profil (NdProfil), toutes activées au départ.
  preferences_notifications jsonb not null default '{
    "nouveaux_contenus": true,
    "sessions_live": true,
    "expiration_renouvellement": true,
    "exercices": true,
    "rappels_apprentissage": true,
    "communaute": true,
    "recommandations": true,
    "annonces": true
  }'::jsonb,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

-- ─── Rôles des comptes (un formateur est aussi étudiant) ────────────────────
create table if not exists public.roles (
  profil_id uuid not null references public.profils (id) on delete cascade,
  role public.role_etudium not null,
  attribue_le timestamptz not null default now(),
  primary key (profil_id, role)
);

-- ─── Le compte connecté a-t-il ce rôle ? (utilisé par les règles d'accès) ──
create or replace function public.a_role(r public.role_etudium)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.roles
    where profil_id = (select auth.uid()) and role = r
  );
$$;

-- ─── Mise à jour automatique de modifie_le ─────────────────────────────────
create or replace function public.toucher_modifie_le()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.modifie_le := now();
  return new;
end;
$$;

drop trigger if exists profils_modifie_le on public.profils;
create trigger profils_modifie_le
  before update on public.profils
  for each row execute function public.toucher_modifie_le();

-- ─── Création du profil et du rôle « etudiant » à chaque inscription ───────
-- Prénom et nom viennent du formulaire d'inscription (prenom, nom) ou de Google
-- (given_name, family_name, sinon full_name découpé au premier espace).
create or replace function public.creer_profil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb;
  complet text;
  v_prenom text;
  v_nom text;
begin
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  complet := coalesce(meta ->> 'full_name', meta ->> 'name', '');
  v_prenom := coalesce(nullif(meta ->> 'prenom', ''), nullif(meta ->> 'given_name', ''), split_part(complet, ' ', 1));
  v_nom := coalesce(
    nullif(meta ->> 'nom', ''),
    nullif(meta ->> 'family_name', ''),
    nullif(substr(complet, char_length(split_part(complet, ' ', 1)) + 2), '')
  );

  insert into public.profils (id, prenom, nom)
  values (new.id, left(coalesce(v_prenom, ''), 50), left(coalesce(v_nom, ''), 50))
  on conflict (id) do nothing;

  insert into public.roles (profil_id, role)
  values (new.id, 'etudiant')
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists apres_inscription on auth.users;
create trigger apres_inscription
  after insert on auth.users
  for each row execute function public.creer_profil();

-- ─── Règles d'accès (appliquées par la base, pas seulement par l'interface) ─
alter table public.profils enable row level security;
alter table public.roles enable row level security;

drop policy if exists "chacun lit son profil" on public.profils;
create policy "chacun lit son profil" on public.profils
  for select to authenticated
  using (id = (select auth.uid()) or public.a_role('admin') or public.a_role('super_admin'));

drop policy if exists "chacun modifie son profil" on public.profils;
create policy "chacun modifie son profil" on public.profils
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "chacun lit ses rôles" on public.roles;
create policy "chacun lit ses rôles" on public.roles
  for select to authenticated
  using (profil_id = (select auth.uid()) or public.a_role('super_admin'));

drop policy if exists "seul le super admin attribue un rôle" on public.roles;
create policy "seul le super admin attribue un rôle" on public.roles
  for insert to authenticated
  with check (public.a_role('super_admin'));

drop policy if exists "seul le super admin retire un rôle" on public.roles;
create policy "seul le super admin retire un rôle" on public.roles
  for delete to authenticated
  using (public.a_role('super_admin'));

-- ─── Photos de profil : JPG ou PNG, 2 Mo maximum, chacun son dossier <id>/ ─
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos-profil', 'photos-profil', false, 2097152, array['image/jpeg', 'image/png'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "chacun lit sa photo" on storage.objects;
create policy "chacun lit sa photo" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos-profil' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "chacun dépose sa photo" on storage.objects;
create policy "chacun dépose sa photo" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos-profil' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "chacun remplace sa photo" on storage.objects;
create policy "chacun remplace sa photo" on storage.objects
  for update to authenticated
  using (bucket_id = 'photos-profil' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "chacun supprime sa photo" on storage.objects;
create policy "chacun supprime sa photo" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos-profil' and (storage.foldername(name))[1] = (select auth.uid())::text);
