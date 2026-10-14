-- Faux Supabase pour le banc d'essai (PGlite) : juste ce dont les migrations ont besoin.
-- Rôles de l'API, schéma auth (comptes, auth.uid()), schéma storage (espaces et fichiers).

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

grant usage on schema public to anon, authenticated, service_role;
-- Comme Supabase : tout nouvel objet de public est accordé aux rôles de l'API ; les règles d'accès (RLS) font le tri.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- ─── auth ───────────────────────────────────────────────────────────────────
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now()
);

-- Le compte de la requête : le banc le pose dans request.jwt.claim.sub (vide pour un visiteur).
create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- ─── storage ────────────────────────────────────────────────────────────────
create schema storage;
grant usage on schema storage to anon, authenticated, service_role;

create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null,
  owner uuid,
  created_at timestamptz not null default now(),
  metadata jsonb,
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;
grant select on storage.buckets to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;

-- Dossiers d'un chemin : « a/b/c.jpg » donne {a,b}.
create function storage.foldername(name text) returns text[]
language sql immutable
as $$
  select coalesce((string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)], '{}')
$$;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;
