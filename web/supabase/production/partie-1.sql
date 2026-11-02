-- Étudium · base de production · partie 1 sur 5 (migrations 0001 à 0020).
-- Fichier produit par scripts/assembler-migrations.mjs : ne pas le modifier à la main.
-- Supabase › SQL Editor › New query : colle tout ce fichier, puis Run. Attends « Success » avant la partie suivante.
-- Ensuite : partie 2.

-- ═══ 0001_profils_roles.sql ═══
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

-- ═══ 0002_profil.sql ═══
-- Étudium · migration 0002 : profil (tâche 0.5) — droits d'écriture, longueurs, photos, suppression du compte.
-- À appliquer dans Supabase, après la 0001 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancé sur une base qui l'a déjà, il ne change rien et ne casse rien.

-- ─── Chacun ne modifie que les champs de son profil (ni id, ni dates) ───────
revoke update on public.profils from authenticated, anon;
grant update (prenom, nom, telephone, pays, niveau_etudes, etablissement, filiere, objectifs, photo_url, preferences_notifications)
  on public.profils to authenticated;

-- ─── Longueurs maximales (les mêmes que les formulaires) ────────────────────
do $$ begin
  alter table public.profils add constraint profils_telephone_longueur check (telephone is null or char_length(telephone) <= 30);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profils add constraint profils_pays_longueur check (pays is null or char_length(pays) <= 60);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profils add constraint profils_niveau_etudes_longueur check (niveau_etudes is null or char_length(niveau_etudes) <= 60);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profils add constraint profils_etablissement_longueur check (etablissement is null or char_length(etablissement) <= 120);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profils add constraint profils_filiere_longueur check (filiere is null or char_length(filiere) <= 120);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profils add constraint profils_objectifs_longueur check (objectifs is null or char_length(objectifs) <= 500);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profils add constraint profils_photo_url_longueur check (photo_url is null or char_length(photo_url) <= 500);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profils add constraint profils_preferences_objet check (jsonb_typeof(preferences_notifications) = 'object');
exception when duplicate_object then null; end $$;

-- ─── Photos lisibles par leur adresse (noms de fichier aléatoires) ──────────
-- La liste du dossier reste réservée à son propriétaire (règles de la 0001).
update storage.buckets set public = true where id = 'photos-profil';

-- ─── Supprimer son propre compte (profil et rôles suivent par cascade) ──────
create or replace function public.supprimer_mon_compte()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'non connecté';
  end if;
  delete from auth.users where id = (select auth.uid());
end;
$$;

revoke execute on function public.supprimer_mon_compte() from public, anon;
grant execute on function public.supprimer_mon_compte() to authenticated;

-- ═══ 0003_finitions.sql ═══
-- Étudium · migration 0003 : finitions du lot 0 — photos enregistrées par chemin vérifié, règles d'accès plus rapides.
-- À appliquer dans Supabase, après la 0002 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancé sur une base qui l'a déjà, il ne change rien et ne casse rien.

begin;

-- ─── Photo de profil : la base garde le chemin, plus l'adresse complète ─────
-- Chacun peut écrire sa colonne photo_url : sans contrôle, on pourrait y mettre l'adresse de n'importe quelle image.
-- Désormais seul un fichier de son propre dossier est accepté (<id>/<nom aléatoire>.jpg ou .png) ;
-- l'application construit l'adresse publique à l'affichage.

-- 1. Les photos déjà envoyées : l'adresse complète devient le chemin dans le dossier photos-profil.
update public.profils
  set photo_url = regexp_replace(photo_url, '^.*/photos-profil/', '')
  where photo_url like '%/photos-profil/%';

-- 2. Une valeur qui n'est pas une photo Étudium est effacée (la personne retrouve ses initiales).
update public.profils
  set photo_url = null
  where photo_url is not null and photo_url !~ ('^' || id::text || '/[0-9a-f-]{36}\.(jpg|png)$');

-- 3. La règle, vérifiée par la base à chaque écriture.
alter table public.profils drop constraint if exists profils_photo_chemin;
alter table public.profils add constraint profils_photo_chemin
  check (photo_url is null or photo_url ~ ('^' || id::text || '/[0-9a-f-]{36}\.(jpg|png)$'));

-- ─── Règles d'accès : le rôle est lu une fois par requête, pas une fois par ligne ─
-- Conseil de Supabase (« auth_rls_initplan ») : la fonction entourée d'un select n'est évaluée qu'une seule fois.

drop policy if exists "chacun lit son profil" on public.profils;
create policy "chacun lit son profil" on public.profils
  for select to authenticated
  using (id = (select auth.uid()) or (select public.a_role('admin')) or (select public.a_role('super_admin')));

drop policy if exists "chacun lit ses rôles" on public.roles;
create policy "chacun lit ses rôles" on public.roles
  for select to authenticated
  using (profil_id = (select auth.uid()) or (select public.a_role('super_admin')));

drop policy if exists "seul le super admin attribue un rôle" on public.roles;
create policy "seul le super admin attribue un rôle" on public.roles
  for insert to authenticated
  with check ((select public.a_role('super_admin')));

drop policy if exists "seul le super admin retire un rôle" on public.roles;
create policy "seul le super admin retire un rôle" on public.roles
  for delete to authenticated
  using ((select public.a_role('super_admin')));

commit;

-- ═══ 0004_contenus.sql ═══
-- Étudium · migration 0004 : contenus du lot 1 (tâche 1.1) — parcours, formateurs, formations, modules, leçons, ressources,
-- et la règle d'accès aux leçons (spec du lot 1, §3 et §4), écrite une seule fois, ici.
-- À appliquer dans Supabase, après la 0003 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancé sur une base qui l'a déjà, il ne change rien et ne casse rien.

-- ─── Types ──────────────────────────────────────────────────────────────────
do $$ begin
  create type public.couleur_parcours as enum ('academique', 'digital', 'business');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.niveau_formation as enum ('debutant', 'intermediaire', 'avance');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.statut_formation as enum ('brouillon', 'publiee', 'archivee');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.badge_formation as enum ('populaire', 'nouveau');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.fournisseur_video as enum ('youtube', 'vimeo');
exception when duplicate_object then null; end $$;

-- ─── Parcours (Réussite académique, Compétences digitales, Business…) ──────
create table if not exists public.parcours (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  nom text not null,
  nom_court text not null,
  description text not null default '',
  couleur public.couleur_parcours not null,
  ordre integer not null default 0,
  actif boolean not null default true,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  constraint parcours_slug_unique unique (slug),
  -- Adresse : minuscules sans accents, chiffres et tirets, jamais de point (spec §2).
  constraint parcours_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint parcours_nom_longueur check (char_length(nom) between 1 and 80),
  constraint parcours_nom_court_longueur check (char_length(nom_court) between 1 and 30),
  constraint parcours_description_longueur check (char_length(description) <= 500)
);

-- ─── Formateurs (fiche publique ; reliée à un compte au lot 4) ──────────────
create table if not exists public.formateurs (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  titre text not null default '',
  domaine text not null default '',
  presentation text not null default '',
  photo text,
  compte_id uuid references public.profils (id) on delete set null,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  constraint formateurs_nom_longueur check (char_length(nom) between 1 and 80),
  constraint formateurs_titre_longueur check (char_length(titre) <= 120),
  constraint formateurs_domaine_longueur check (char_length(domaine) <= 120),
  constraint formateurs_presentation_longueur check (char_length(presentation) <= 600)
);

-- ─── Formations ─────────────────────────────────────────────────────────────
create table if not exists public.formations (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  titre text not null,
  -- Deux lignes sous le titre, sur les cartes du catalogue.
  resume text not null default '',
  description text not null default '',
  -- « Ce que vous allez apprendre » et « Compétences acquises ».
  objectifs text[] not null default '{}',
  competences text[] not null default '{}',
  niveau public.niveau_formation not null default 'debutant',
  formateur_id uuid references public.formateurs (id) on delete set null,
  gratuite boolean not null default false,
  -- Disponible seule, en formation complémentaire (achat au lot 2, au prix ci-dessous).
  achat_separe boolean not null default false,
  prix_fcfa integer,
  badge public.badge_formation,
  -- Part de la vidéo réellement regardée pour terminer une leçon (spec Q4).
  seuil_video smallint not null default 90,
  statut public.statut_formation not null default 'brouillon',
  publiee_le timestamptz,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  constraint formations_slug_unique unique (slug),
  constraint formations_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint formations_titre_longueur check (char_length(titre) between 1 and 120),
  constraint formations_resume_longueur check (char_length(resume) <= 160),
  constraint formations_description_longueur check (char_length(description) <= 2000),
  constraint formations_prix_positif check (prix_fcfa is null or prix_fcfa >= 0),
  constraint formations_seuil check (seuil_video between 50 and 100)
);

-- Une formation peut appartenir à plusieurs parcours (CDC §7).
create table if not exists public.formations_parcours (
  formation_id uuid not null references public.formations (id) on delete cascade,
  parcours_id uuid not null references public.parcours (id) on delete cascade,
  ordre integer not null default 0,
  primary key (formation_id, parcours_id)
);

-- ─── Programme : modules et leçons ──────────────────────────────────────────
create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  formation_id uuid not null references public.formations (id) on delete cascade,
  titre text not null,
  ordre integer not null default 0,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  constraint modules_titre_longueur check (char_length(titre) between 1 and 120)
);

create table if not exists public.lecons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  titre text not null,
  -- Titre raccourci du programme de gauche (le titre complet reste en info-bulle).
  titre_court text,
  duree_secondes integer not null default 0,
  -- Leçon d'aperçu gratuit : visible même sans compte (spec Q1).
  apercu boolean not null default false,
  -- « Dans cette leçon » : un texte et quelques points clés.
  resume text not null default '',
  points_cles text[] not null default '{}',
  ordre integer not null default 0,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  constraint lecons_titre_longueur check (char_length(titre) between 1 and 120),
  constraint lecons_titre_court_longueur check (titre_court is null or char_length(titre_court) between 1 and 40),
  constraint lecons_duree_positive check (duree_secondes >= 0),
  constraint lecons_resume_longueur check (char_length(resume) <= 1000)
);

-- Ce qui ne se montre qu'avec l'accès à la leçon : la vidéo (CDC §55, ne pas exposer la source) et le texte.
create table if not exists public.lecons_contenus (
  lecon_id uuid primary key references public.lecons (id) on delete cascade,
  video_fournisseur public.fournisseur_video,
  video_id text,
  texte text not null default '',
  modifie_le timestamptz not null default now(),
  -- Les deux vides, ou les deux remplis et cohérents. (Une vérification qui vaut « inconnu » passerait : d'où les « is not null ».)
  constraint lecons_contenus_video check (
    (video_fournisseur is null and video_id is null)
    or (
      video_fournisseur is not null and video_id is not null and (
        (video_fournisseur = 'youtube' and video_id ~ '^[A-Za-z0-9_-]{11}$')
        -- Vimeo : l'identifiant, suivi du code d'une vidéo « non répertoriée » comme dans son lien (76979871/abcdef0123).
        or (video_fournisseur = 'vimeo' and video_id ~ '^[0-9]{6,12}(/[0-9a-f]{6,20})?$')
      )
    )
  ),
  constraint lecons_contenus_texte_longueur check (char_length(texte) <= 20000)
);

-- ─── Ressources des leçons (fichiers de l'espace « ressources ») ────────────
create table if not exists public.ressources (
  id uuid primary key default gen_random_uuid(),
  lecon_id uuid not null references public.lecons (id) on delete cascade,
  titre text not null,
  -- Chemin du fichier dans l'espace de stockage « ressources ».
  fichier text not null,
  format text not null,
  taille_octets bigint not null default 0,
  telechargeable boolean not null default true,
  ordre integer not null default 0,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  constraint ressources_fichier_unique unique (fichier),
  constraint ressources_titre_longueur check (char_length(titre) between 1 and 120),
  constraint ressources_taille_positive check (taille_octets >= 0),
  -- Consultation seule : seulement ce que le visualiseur intégré sait afficher (spec §6).
  constraint ressources_consultation_format check (
    telechargeable or format in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
  )
);

-- ─── Index des liens entre tables ───────────────────────────────────────────
create index if not exists formations_statut_idx on public.formations (statut);
create index if not exists formations_formateur_idx on public.formations (formateur_id);
create index if not exists formateurs_compte_idx on public.formateurs (compte_id);
create index if not exists formations_parcours_parcours_idx on public.formations_parcours (parcours_id);
create index if not exists modules_formation_idx on public.modules (formation_id);
create index if not exists lecons_module_idx on public.lecons (module_id);
create index if not exists ressources_lecon_idx on public.ressources (lecon_id);

-- ─── modifie_le tenu à jour (fonction de la 0001) ───────────────────────────
drop trigger if exists parcours_modifie_le on public.parcours;
create trigger parcours_modifie_le before update on public.parcours
  for each row execute function public.toucher_modifie_le();
drop trigger if exists formateurs_modifie_le on public.formateurs;
create trigger formateurs_modifie_le before update on public.formateurs
  for each row execute function public.toucher_modifie_le();
drop trigger if exists formations_modifie_le on public.formations;
create trigger formations_modifie_le before update on public.formations
  for each row execute function public.toucher_modifie_le();
drop trigger if exists modules_modifie_le on public.modules;
create trigger modules_modifie_le before update on public.modules
  for each row execute function public.toucher_modifie_le();
drop trigger if exists lecons_modifie_le on public.lecons;
create trigger lecons_modifie_le before update on public.lecons
  for each row execute function public.toucher_modifie_le();
drop trigger if exists lecons_contenus_modifie_le on public.lecons_contenus;
create trigger lecons_contenus_modifie_le before update on public.lecons_contenus
  for each row execute function public.toucher_modifie_le();
drop trigger if exists ressources_modifie_le on public.ressources;
create trigger ressources_modifie_le before update on public.ressources
  for each row execute function public.toucher_modifie_le();

-- ─── Une formation publiée garde son adresse et s'archive au lieu de s'effacer ─
-- Les liens partagés (WhatsApp…) continuent de marcher, et l'historique des étudiants est conservé (CDC §39).
create or replace function public.formations_regles()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.publiee_le is not null then
      raise exception 'Une formation publiée s''archive, elle ne s''efface pas.';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.publiee_le is not null then
    if new.slug is distinct from old.slug then
      raise exception 'L''adresse d''une formation publiée ne change plus.';
    end if;
    -- La date de première publication ne s'efface pas (elle protège l'adresse).
    new.publiee_le := old.publiee_le;
  elsif new.statut <> 'publiee' then
    -- Jamais publiée : pas de date de publication (elle figerait l'adresse d'un simple brouillon).
    new.publiee_le := null;
  end if;
  if new.statut = 'publiee' and new.publiee_le is null then
    new.publiee_le := now();
  end if;
  return new;
end;
$$;

drop trigger if exists formations_regles on public.formations;
create trigger formations_regles
  before insert or update or delete on public.formations
  for each row execute function public.formations_regles();

-- ─── La règle d'accès (spec §3) ─────────────────────────────────────────────
-- L'équipe qui saisit et vérifie les contenus (CDC §47).
create or replace function public.equipe_contenus()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.roles
    where profil_id = (select auth.uid()) and role in ('admin', 'moderateur', 'super_admin')
  );
$$;

-- Cette leçon peut-elle être suivie par la personne qui demande ?
-- Gratuite (avec un compte), aperçu (même sans compte), équipe. Le lot 2 ajoutera : parcours de l'abonnement actif,
-- formation complémentaire achetée. Une formation en brouillon ou archivée ferme ses leçons (R24).
create or replace function public.acces_lecon(p_lecon uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.equipe_contenus() or exists (
    select 1
    from public.lecons l
    join public.modules m on m.id = l.module_id
    join public.formations f on f.id = m.formation_id
    where l.id = p_lecon
      and f.statut = 'publiee'
      and (l.apercu or (f.gratuite and (select auth.uid()) is not null))
  );
$$;

-- Champ calculé pour l'API : « lecons?select=id,titre,accessible » (cadenas du programme).
create or replace function public.accessible(l public.lecons)
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.acces_lecon(l.id);
$$;

grant execute on function public.equipe_contenus() to anon, authenticated;
grant execute on function public.acces_lecon(uuid) to anon, authenticated;
grant execute on function public.accessible(public.lecons) to anon, authenticated;

-- ─── Règles d'accès des tables ──────────────────────────────────────────────
alter table public.parcours enable row level security;
alter table public.formateurs enable row level security;
alter table public.formations enable row level security;
alter table public.formations_parcours enable row level security;
alter table public.modules enable row level security;
alter table public.lecons enable row level security;
alter table public.lecons_contenus enable row level security;
alter table public.ressources enable row level security;

-- Un visiteur n'écrit jamais rien ici. Et personne ne vide une table d'un coup par l'API (TRUNCATE ignore les règles
-- d'accès et contournerait « une formation publiée s'archive »).
revoke insert, update, delete, truncate on
  public.parcours, public.formateurs, public.formations, public.formations_parcours,
  public.modules, public.lecons, public.lecons_contenus, public.ressources
from anon;
revoke truncate on
  public.parcours, public.formateurs, public.formations, public.formations_parcours,
  public.modules, public.lecons, public.lecons_contenus, public.ressources
from authenticated;

-- Lecture : le catalogue publié pour tous ; le programme suit sa formation ; le contenu suit la règle d'accès.
drop policy if exists "parcours visibles" on public.parcours;
create policy "parcours visibles" on public.parcours
  for select to anon, authenticated
  using (actif or (select public.equipe_contenus()));

drop policy if exists "formateurs visibles" on public.formateurs;
create policy "formateurs visibles" on public.formateurs
  for select to anon, authenticated
  using (true);

drop policy if exists "formations publiées visibles" on public.formations;
create policy "formations publiées visibles" on public.formations
  for select to anon, authenticated
  using (statut = 'publiee' or (select public.equipe_contenus()));

drop policy if exists "parcours d'une formation visible" on public.formations_parcours;
create policy "parcours d'une formation visible" on public.formations_parcours
  for select to anon, authenticated
  using (exists (select 1 from public.formations f where f.id = formations_parcours.formation_id));

drop policy if exists "modules d'une formation visible" on public.modules;
create policy "modules d'une formation visible" on public.modules
  for select to anon, authenticated
  using (exists (select 1 from public.formations f where f.id = modules.formation_id));

drop policy if exists "leçons d'un module visible" on public.lecons;
create policy "leçons d'un module visible" on public.lecons
  for select to anon, authenticated
  using (exists (select 1 from public.modules m where m.id = lecons.module_id));

drop policy if exists "contenu avec l'accès à la leçon" on public.lecons_contenus;
create policy "contenu avec l'accès à la leçon" on public.lecons_contenus
  for select to anon, authenticated
  using (public.acces_lecon(lecon_id));

drop policy if exists "ressources avec l'accès à la leçon" on public.ressources;
create policy "ressources avec l'accès à la leçon" on public.ressources
  for select to anon, authenticated
  using (public.acces_lecon(lecon_id));

-- Écriture : l'équipe seulement (admin, moderateur, super_admin). Les formateurs saisiront au lot 4.
-- Une règle par action (ajout, modification, suppression) plutôt qu'une règle « for all » : la lecture garde ainsi
-- une seule règle par table (conseil « multiple_permissive_policies » de Supabase).
do $$
declare
  t text;
begin
  foreach t in array array[
    'parcours', 'formateurs', 'formations', 'formations_parcours', 'modules', 'lecons', 'lecons_contenus', 'ressources'
  ] loop
    execute format('drop policy if exists %I on public.%I', 'l''équipe ajoute', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select public.equipe_contenus()))',
      'l''équipe ajoute', t
    );
    execute format('drop policy if exists %I on public.%I', 'l''équipe modifie', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select public.equipe_contenus())) with check ((select public.equipe_contenus()))',
      'l''équipe modifie', t
    );
    execute format('drop policy if exists %I on public.%I', 'l''équipe supprime', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select public.equipe_contenus()))',
      'l''équipe supprime', t
    );
  end loop;
end
$$;

-- ─── Fichiers des ressources : espace privé, 50 Mo par fichier ─────────────
-- Jamais d'adresse publique : chaque ouverture passe par un lien temporaire, accordé selon la règle d'accès.
insert into storage.buckets (id, name, public, file_size_limit)
values ('ressources', 'ressources', false, 52428800)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit;

drop policy if exists "ressources : lecture avec l'accès à la leçon" on storage.objects;
create policy "ressources : lecture avec l'accès à la leçon" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'ressources'
    and (
      (select public.equipe_contenus())
      or exists (select 1 from public.ressources r where r.fichier = objects.name and public.acces_lecon(r.lecon_id))
    )
  );

drop policy if exists "ressources : l'équipe dépose" on storage.objects;
create policy "ressources : l'équipe dépose" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ressources' and (select public.equipe_contenus()));

drop policy if exists "ressources : l'équipe remplace" on storage.objects;
create policy "ressources : l'équipe remplace" on storage.objects
  for update to authenticated
  using (bucket_id = 'ressources' and (select public.equipe_contenus()))
  with check (bucket_id = 'ressources' and (select public.equipe_contenus()));

drop policy if exists "ressources : l'équipe supprime" on storage.objects;
create policy "ressources : l'équipe supprime" on storage.objects
  for delete to authenticated
  using (bucket_id = 'ressources' and (select public.equipe_contenus()));

-- ═══ 0005_back_office.sql ═══
-- Étudium · migration 0005 : outils du back-office (tâche 1.2) — ordre des éléments, formats des fichiers de ressources.
-- À appliquer dans Supabase, après la 0004 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancé sur une base qui l'a déjà, il ne change rien et ne casse rien.

-- ─── Monter / descendre un élément dans sa liste ────────────────────────────
-- Parcours (entre eux), modules (dans leur formation), leçons (dans leur module), ressources (dans leur leçon).
-- La liste est d'abord renumérotée 1, 2, 3… (des ordres en double ou des trous ne gênent plus), puis l'élément échange
-- sa place avec son voisin. Au bord de la liste, rien ne change.
-- Les règles d'accès s'appliquent (security invoker) : hors de l'équipe, rien ne bouge.
create or replace function public.deplacer(p_table text, p_id uuid, p_sens integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_groupe text;
  v_valeur uuid;
  v_filtre text;
  v_ordre integer;
  v_voisin uuid;
begin
  if p_sens is null or p_sens not in (-1, 1) then
    raise exception 'Sens de déplacement inconnu : %', p_sens;
  end if;
  if p_table is null or p_table not in ('parcours', 'modules', 'lecons', 'ressources') then
    raise exception 'Table non prévue pour un déplacement : %', p_table;
  end if;

  v_groupe := case p_table
    when 'modules' then 'formation_id'
    when 'lecons' then 'module_id'
    when 'ressources' then 'lecon_id'
  end;

  if v_groupe is null then
    v_filtre := 'true';
  else
    execute format('select %I from public.%I where id = $1', v_groupe, p_table) into v_valeur using p_id;
    if v_valeur is null then
      return;
    end if;
    v_filtre := format('%I = %L', v_groupe, v_valeur);
  end if;

  execute format(
    'update public.%I as t set ordre = n.rang
       from (select id, row_number() over (order by ordre, cree_le, id) as rang from public.%I where %s) as n
      where t.id = n.id and t.ordre is distinct from n.rang',
    p_table, p_table, v_filtre
  );

  execute format('select ordre from public.%I where id = $1', p_table) into v_ordre using p_id;
  if v_ordre is null then
    return;
  end if;
  execute format('select id from public.%I where %s and ordre = $1', p_table, v_filtre) into v_voisin using v_ordre + p_sens;
  if v_voisin is null then
    return;
  end if;

  execute format('update public.%I set ordre = $2 where id = $1', p_table) using p_id, v_ordre + p_sens;
  execute format('update public.%I set ordre = $2 where id = $1', p_table) using v_voisin, v_ordre;
end;
$$;

revoke execute on function public.deplacer(text, uuid, integer) from public, anon;
grant execute on function public.deplacer(text, uuid, integer) to authenticated;

-- ─── Fichiers acceptés par l'espace « ressources » ─────────────────────────
-- La même liste que l'application (web/src/lib/admin/fichiers.ts) : PDF et images (consultables), puis Excel, Word,
-- PowerPoint, ZIP, CSV et texte (en téléchargement seulement).
update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'application/zip',
  'text/csv',
  'text/plain'
]
where id = 'ressources';

-- ═══ 0006_notes.sql ═══
-- Étudium · migration 0006 : notes privées des leçons (tâche 1.5).
-- À appliquer dans Supabase, après la 0005 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancé sur une base qui l'a déjà, il ne change rien et ne casse rien.

begin;

-- Une note par compte et par leçon (onglet « Notes » de la page leçon). Personne d'autre ne la lit, pas même l'équipe.
create table if not exists public.notes_lecons (
  profil_id uuid not null default auth.uid() references public.profils (id) on delete cascade,
  lecon_id uuid not null references public.lecons (id) on delete cascade,
  -- Une note vide n'est pas gardée : l'application l'efface.
  texte text not null,
  modifie_le timestamptz not null default now(),
  primary key (profil_id, lecon_id),
  constraint notes_lecons_texte_longueur check (char_length(texte) between 1 and 5000)
);
create index if not exists notes_lecons_lecon_idx on public.notes_lecons (lecon_id);

drop trigger if exists notes_lecons_modifie_le on public.notes_lecons;
create trigger notes_lecons_modifie_le before update on public.notes_lecons
  for each row execute function public.toucher_modifie_le();

alter table public.notes_lecons enable row level security;

-- Un visiteur n'y touche pas ; personne ne vide la table d'un coup par l'API.
revoke all on public.notes_lecons from anon;
revoke truncate on public.notes_lecons from authenticated;

-- Chacun ses notes. On n'écrit que sur une leçon qu'on peut suivre ; une note reste lisible et effaçable si l'accès
-- se perd ensuite (formation archivée).
drop policy if exists "ses notes : lecture" on public.notes_lecons;
create policy "ses notes : lecture" on public.notes_lecons
  for select to authenticated
  using (profil_id = (select auth.uid()));

drop policy if exists "ses notes : ajout" on public.notes_lecons;
create policy "ses notes : ajout" on public.notes_lecons
  for insert to authenticated
  with check (profil_id = (select auth.uid()) and public.acces_lecon(lecon_id));

drop policy if exists "ses notes : modification" on public.notes_lecons;
create policy "ses notes : modification" on public.notes_lecons
  for update to authenticated
  using (profil_id = (select auth.uid()))
  with check (profil_id = (select auth.uid()) and public.acces_lecon(lecon_id));

drop policy if exists "ses notes : suppression" on public.notes_lecons;
create policy "ses notes : suppression" on public.notes_lecons
  for delete to authenticated
  using (profil_id = (select auth.uid()));

commit;

-- ═══ 0007_visionnage.sql ═══
-- Étudium · migration 0007 : temps réellement regardé des vidéos (tâche 1.6).
-- À appliquer dans Supabase, après la 0006 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancé sur une base qui l'a déjà, il ne change rien et ne casse rien.

begin;

-- Une ligne par compte et par leçon. On garde les passages réellement lus (de 2:10 à 4:35…), en secondes, et non la
-- position atteinte : un passage lu deux fois ne compte qu'une fois, un saut dans la barre ne compte pas (spec §5).
create table if not exists public.progression_lecons (
  profil_id uuid not null default auth.uid() references public.profils (id) on delete cascade,
  lecon_id uuid not null references public.lecons (id) on delete cascade,
  passages int4multirange not null default '{}',
  -- Où reprendre la vidéo (tâche 1.7).
  position_secondes integer not null default 0,
  -- Garde-fou : un envoi ne peut couvrir plus de secondes nouvelles que la réserve de temps, qui grandit avec le
  -- temps réellement écoulé (2,2 secondes par seconde, vitesse 2× comprise) et plafonne à 60 secondes.
  dernier_envoi timestamptz,
  reserve_secondes real not null default 0,
  vue_le timestamptz not null default now(),
  terminee_le timestamptz,
  primary key (profil_id, lecon_id),
  constraint progression_position_positive check (position_secondes >= 0)
);
create index if not exists progression_lecons_lecon_idx on public.progression_lecons (lecon_id);
-- Pour une base qui aurait la première version de ce fichier.
alter table public.progression_lecons add column if not exists reserve_secondes real not null default 0;

alter table public.progression_lecons enable row level security;

-- Lecture : chacun la sienne. Écriture : seulement par les deux fonctions ci-dessous, qui vérifient tout.
revoke all on public.progression_lecons from anon;
revoke insert, update, delete, truncate on public.progression_lecons from authenticated;

drop policy if exists "sa progression : lecture" on public.progression_lecons;
create policy "sa progression : lecture" on public.progression_lecons
  for select to authenticated
  using (profil_id = (select auth.uid()));

-- Secondes couvertes par des passages.
create or replace function public.secondes_couvertes(p_passages int4multirange)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(sum(upper(r) - lower(r)), 0)::integer from unnest(p_passages) as r;
$$;

-- Début d'un visionnage (lecture) : crée la ligne si besoin. La réserve de temps part de zéro et n'est jamais remise à
-- zéro ni regonflée par un nouvel appel : rappeler « commencer » ne donne aucun temps en plus.
create or replace function public.commencer_visionnage(p_lecon uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.acces_lecon(p_lecon) then
    raise exception 'Leçon inaccessible.' using errcode = '42501';
  end if;
  insert into public.progression_lecons (profil_id, lecon_id, dernier_envoi, vue_le)
  values ((select auth.uid()), p_lecon, now(), now())
  on conflict (profil_id, lecon_id) do update
    set vue_le = now(),
        dernier_envoi = coalesce(public.progression_lecons.dernier_envoi, now());
end;
$$;

-- Première version de ce fichier : la durée venait aussi du lecteur. On la retire (la durée de référence est celle de
-- la leçon, saisie au back-office : le navigateur ne la choisit pas).
drop function if exists public.enregistrer_visionnage(uuid, int4multirange, integer, integer);

-- Envoi des passages regardés depuis le dernier envoi. Rend les secondes vues, les passages, la durée de référence et
-- l'état. Seules les secondes pas encore enregistrées puisent dans la réserve : renvoyer un passage déjà connu
-- (réponse perdue, deuxième onglet) ne coûte rien.
create or replace function public.enregistrer_visionnage(p_lecon uuid, p_passages int4multirange, p_position integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_reference integer;
  v_seuil smallint;
  v_ligne public.progression_lecons;
  v_passages int4multirange;
  v_nouvelles integer;
  v_reserve real;
  v_vues integer;
begin
  if v_uid is null or not public.acces_lecon(p_lecon) then
    raise exception 'Leçon inaccessible.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.lecons_contenus c where c.lecon_id = p_lecon and c.video_id is not null) then
    raise exception 'Cette leçon n''a pas de vidéo.' using errcode = '22023';
  end if;

  select l.duree_secondes, f.seuil_video into v_reference, v_seuil
  from public.lecons l
  join public.modules m on m.id = l.module_id
  join public.formations f on f.id = m.formation_id
  where l.id = p_lecon;
  if coalesce(v_reference, 0) <= 0 then
    raise exception 'La durée de la leçon n''est pas saisie.' using errcode = '22023';
  end if;

  select * into v_ligne from public.progression_lecons where profil_id = v_uid and lecon_id = p_lecon for update;
  if not found or v_ligne.dernier_envoi is null then
    raise exception 'Visionnage non commencé.' using errcode = '55000';
  end if;

  -- Rien au-delà de la vidéo ; pas plus de secondes nouvelles que la réserve.
  v_passages := p_passages * int4multirange(int4range(0, v_reference));
  v_nouvelles := public.secondes_couvertes(v_passages - v_ligne.passages);
  v_reserve := least(60, v_ligne.reserve_secondes + extract(epoch from now() - v_ligne.dernier_envoi) * 2.2);
  if v_nouvelles > v_reserve then
    raise exception 'Passage plus long que le temps écoulé.' using errcode = '22023';
  end if;

  update public.progression_lecons
  set passages = passages + v_passages,
      reserve_secondes = v_reserve - v_nouvelles,
      position_secondes = least(greatest(coalesce(p_position, 0), 0), v_reference),
      dernier_envoi = now(),
      vue_le = now()
  where profil_id = v_uid and lecon_id = p_lecon
  returning * into v_ligne;

  v_vues := public.secondes_couvertes(v_ligne.passages);
  if v_ligne.terminee_le is null and v_vues * 100 >= v_seuil * v_reference then
    update public.progression_lecons set terminee_le = now()
    where profil_id = v_uid and lecon_id = p_lecon
    returning * into v_ligne;
  end if;

  return jsonb_build_object(
    'secondes_vues', v_vues,
    'reference', v_reference,
    'terminee', v_ligne.terminee_le is not null,
    'passages', v_ligne.passages::text
  );
end;
$$;

revoke execute on function public.commencer_visionnage(uuid) from public, anon;
revoke execute on function public.enregistrer_visionnage(uuid, int4multirange, integer) from public, anon;
grant execute on function public.commencer_visionnage(uuid) to authenticated;
grant execute on function public.enregistrer_visionnage(uuid, int4multirange, integer) to authenticated;

commit;

-- ═══ 0008_progression.sql ═══
-- Étudium · migration 0008 : visite et fin d'une leçon (tâche 1.7).
-- À appliquer dans Supabase, après la 0007 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancé sur une base qui l'a déjà, il ne change rien et ne casse rien.
--
-- Le suivi d'une formation (commencée le, dernière leçon ouverte, terminée le : spec §4) se déduit des lignes de
-- progression_lecons (0007) : la première ouverture, la dernière visite et la date de fin de chaque leçon.

begin;

-- Première ouverture de la leçon (vue_le garde la dernière visite).
alter table public.progression_lecons add column if not exists ouverte_le timestamptz not null default now();

-- Visite d'une leçon : sert à « Continuer » (dernière leçon ouverte) et à « Mes formations » (formations commencées).
create or replace function public.ouvrir_lecon(p_lecon uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.acces_lecon(p_lecon) then
    raise exception 'Leçon inaccessible.' using errcode = '42501';
  end if;
  insert into public.progression_lecons (profil_id, lecon_id)
  values ((select auth.uid()), p_lecon)
  on conflict (profil_id, lecon_id) do update set vue_le = now();
end;
$$;

-- « Marquer comme terminée » : seulement pour une leçon sans vidéo (spec Q3). Une leçon vidéo se termine quand le temps
-- réellement regardé atteint le seuil (enregistrer_visionnage, 0007).
create or replace function public.terminer_lecon(p_lecon uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.acces_lecon(p_lecon) then
    raise exception 'Leçon inaccessible.' using errcode = '42501';
  end if;
  if exists (select 1 from public.lecons_contenus c where c.lecon_id = p_lecon and c.video_id is not null) then
    raise exception 'Une leçon vidéo se termine en la regardant.' using errcode = '22023';
  end if;
  insert into public.progression_lecons (profil_id, lecon_id, terminee_le)
  values ((select auth.uid()), p_lecon, now())
  on conflict (profil_id, lecon_id) do update
    set terminee_le = coalesce(public.progression_lecons.terminee_le, now()),
        vue_le = now();
end;
$$;

revoke execute on function public.ouvrir_lecon(uuid) from public, anon;
revoke execute on function public.terminer_lecon(uuid) from public, anon;
grant execute on function public.ouvrir_lecon(uuid) to authenticated;
grant execute on function public.terminer_lecon(uuid) to authenticated;

commit;

-- ═══ 0009_favoris.sql ═══
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

-- ═══ 0010_avis.sql ═══
-- Étudium · migration 0010 : avis des étudiants, note moyenne des formations, masquage par l’équipe (tâche 1.11).
-- À appliquer dans Supabase, après la 0009 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancé sur une base qui l'a déjà, il ne change rien et ne casse rien.

begin;

-- ─── Avis : une note de 1 à 5 et un commentaire facultatif, un par compte et par formation (spec Q8) ───
create table if not exists public.avis (
  id uuid primary key default gen_random_uuid(),
  profil_id uuid not null default auth.uid() references public.profils (id) on delete cascade,
  formation_id uuid not null references public.formations (id) on delete cascade,
  note smallint not null,
  commentaire text not null default '',
  -- Masqué par l’équipe : invisible pour les autres, hors moyenne ; son auteur le voit encore.
  masque boolean not null default false,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  constraint avis_un_par_formation unique (profil_id, formation_id),
  constraint avis_note check (note between 1 and 5),
  constraint avis_commentaire_longueur check (char_length(commentaire) <= 1000)
);
create index if not exists avis_formation_idx on public.avis (formation_id, modifie_le desc);

-- Aucune écriture directe : tout passe par les fonctions ci-dessous, qui vérifient la règle des 50 %. La lecture
-- publique passe aussi par des fonctions, qui ne livrent jamais l’identifiant de l’auteur.
alter table public.avis enable row level security;
revoke all on public.avis from anon;
revoke insert, update, delete, truncate on public.avis from authenticated;

drop policy if exists "ses avis : lecture" on public.avis;
create policy "ses avis : lecture" on public.avis
  for select to authenticated
  using (profil_id = (select auth.uid()));

-- ─── Note moyenne et nombre d’avis, tenus à jour par la base (spec §4) ──────────────────────────────
alter table public.formations add column if not exists note_moyenne numeric(2, 1);
alter table public.formations add column if not exists nb_avis integer not null default 0;

-- Les avis masqués ne comptent pas. La date de modification de la formation avance avec sa note (déclencheur de la 0004).
create or replace function public.recalculer_note(p_formation uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.formations f
  set note_moyenne = s.moyenne, nb_avis = s.nombre
  from (
    select round(avg(a.note)::numeric, 1) as moyenne, count(*)::integer as nombre
    from public.avis a
    where a.formation_id = p_formation and not a.masque
  ) s
  where f.id = p_formation and (f.note_moyenne is distinct from s.moyenne or f.nb_avis <> s.nombre);
$$;

create or replace function public.avis_recalculer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' then
    perform public.recalculer_note(old.formation_id);
  end if;
  if tg_op <> 'DELETE' then
    perform public.recalculer_note(new.formation_id);
  end if;
  return null;
end;
$$;

drop trigger if exists avis_recalculer on public.avis;
create trigger avis_recalculer after insert or update or delete on public.avis
  for each row execute function public.avis_recalculer();

-- ─── Nom affiché : « Fifamè A. », le prénom seul sans nom, « Membre d’Étudium » sans prénom ─────────
create or replace function public.nom_avis(p_prenom text, p_nom text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when btrim(coalesce(p_prenom, '')) = '' then 'Membre d’Étudium'
    when btrim(coalesce(p_nom, '')) = '' then btrim(p_prenom)
    else btrim(p_prenom) || ' ' || upper(left(btrim(p_nom), 1)) || '.'
  end;
$$;

create or replace function public.initiales_avis(p_prenom text, p_nom text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(nullif(upper(left(btrim(coalesce(p_prenom, '')), 1)) || upper(left(btrim(coalesce(p_nom, '')), 1)), ''), 'É');
$$;

-- ─── À partir de 50 % : leçons terminées × 2 ≥ leçons de la formation (spec Q2, §7), formation publiée ───
create or replace function public.peut_donner_avis(p_formation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (select 1 from public.formations f where f.id = p_formation and f.statut = 'publiee')
    and (
      select count(*) > 0 and count(p.terminee_le) * 2 >= count(*)
      from public.lecons l
      join public.modules m on m.id = l.module_id
      left join public.progression_lecons p on p.lecon_id = l.id and p.profil_id = (select auth.uid())
      where m.formation_id = p_formation
    );
$$;

-- Écrire ou modifier son avis. Un avis masqué le reste après modification : l’équipe décide.
create or replace function public.enregistrer_avis(p_formation uuid, p_note smallint, p_commentaire text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_commentaire text := regexp_replace(coalesce(p_commentaire, ''), '^\s+|\s+$', '', 'g');
begin
  if p_note is null or p_note not between 1 and 5 then
    raise exception 'La note va de 1 à 5.' using errcode = '22023';
  end if;
  if char_length(v_commentaire) > 1000 then
    raise exception 'Le commentaire dépasse 1 000 caractères.' using errcode = '22023';
  end if;
  if not public.peut_donner_avis(p_formation) then
    raise exception 'Un avis se donne à partir de 50 %% de progression, sur une formation publiée.' using errcode = '42501';
  end if;
  insert into public.avis (profil_id, formation_id, note, commentaire)
  values ((select auth.uid()), p_formation, p_note, v_commentaire)
  on conflict (profil_id, formation_id)
  do update set note = excluded.note, commentaire = excluded.commentaire, modifie_le = now();
end;
$$;

-- Supprimer son avis : toujours permis, même si l’accès à la formation est perdu.
create or replace function public.supprimer_avis(p_formation uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.avis where profil_id = (select auth.uid()) and formation_id = p_formation;
$$;

-- ─── Lecture publique : les avis visibles d’une formation publiée, et le sien même masqué, en premier ───
create or replace function public.avis_formation(p_formation uuid, p_limite integer default 6)
returns table (
  id uuid,
  note smallint,
  commentaire text,
  auteur text,
  initiales text,
  cree_le timestamptz,
  modifie_le timestamptz,
  est_moi boolean,
  masque boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.id,
    a.note,
    a.commentaire,
    public.nom_avis(p.prenom, p.nom),
    public.initiales_avis(p.prenom, p.nom),
    a.cree_le,
    a.modifie_le,
    coalesce(a.profil_id = (select auth.uid()), false),
    a.masque
  from public.avis a
  join public.profils p on p.id = a.profil_id
  join public.formations f on f.id = a.formation_id
  where a.formation_id = p_formation
    and f.statut = 'publiee'
    and (not a.masque or a.profil_id = (select auth.uid()))
  order by coalesce(a.profil_id = (select auth.uid()), false) desc, a.modifie_le desc
  limit greatest(coalesce(p_limite, 6), 0);
$$;

-- Nombre d’avis visibles par note (barres de la fiche).
create or replace function public.repartition_avis(p_formation uuid)
returns table (note smallint, nombre integer)
language sql
stable
security definer
set search_path = ''
as $$
  select a.note, count(*)::integer
  from public.avis a
  join public.formations f on f.id = a.formation_id
  where a.formation_id = p_formation and f.statut = 'publiee' and not a.masque
  group by a.note;
$$;

-- ─── Équipe : tous les avis, et le masquage (back-office, spec §10) ────────────────────────────────
create or replace function public.avis_equipe()
returns table (
  id uuid,
  formation_titre text,
  formation_slug text,
  auteur text,
  note smallint,
  commentaire text,
  masque boolean,
  cree_le timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, f.titre, f.slug, public.nom_avis(p.prenom, p.nom), a.note, a.commentaire, a.masque, a.cree_le
  from public.avis a
  join public.formations f on f.id = a.formation_id
  join public.profils p on p.id = a.profil_id
  where public.equipe_contenus()
  order by a.cree_le desc;
$$;

create or replace function public.masquer_avis(p_avis uuid, p_masque boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.equipe_contenus() then
    raise exception 'Le masquage des avis est réservé à l’équipe.' using errcode = '42501';
  end if;
  update public.avis set masque = coalesce(p_masque, false) where id = p_avis;
end;
$$;

-- ─── Droits : rien pour public ; la lecture pour tous, l’écriture pour les comptes ───────────────────
revoke execute on function public.recalculer_note(uuid) from public, anon, authenticated;
revoke execute on function public.avis_recalculer() from public, anon, authenticated;
revoke execute on function public.nom_avis(text, text) from public, anon, authenticated;
revoke execute on function public.initiales_avis(text, text) from public, anon, authenticated;
revoke execute on function public.peut_donner_avis(uuid) from public, anon;
revoke execute on function public.enregistrer_avis(uuid, smallint, text) from public, anon;
revoke execute on function public.supprimer_avis(uuid) from public, anon;
revoke execute on function public.avis_formation(uuid, integer) from public;
revoke execute on function public.repartition_avis(uuid) from public;
revoke execute on function public.avis_equipe() from public, anon;
revoke execute on function public.masquer_avis(uuid, boolean) from public, anon;

grant execute on function public.avis_formation(uuid, integer) to anon, authenticated;
grant execute on function public.repartition_avis(uuid) to anon, authenticated;
grant execute on function public.peut_donner_avis(uuid) to authenticated;
grant execute on function public.enregistrer_avis(uuid, smallint, text) to authenticated;
grant execute on function public.supprimer_avis(uuid) to authenticated;
grant execute on function public.avis_equipe() to authenticated;
grant execute on function public.masquer_avis(uuid, boolean) to authenticated;

-- ─── Moyennes recalculées (rejouable) ──────────────────────────────────────────────────────────────
do $$
begin
  perform public.recalculer_note(f.id) from public.formations f;
end;
$$;

commit;

-- ═══ 0011_statistiques.sql ═══
-- Étudium · migration 0011 : les chiffres du tableau de bord du back-office (vue globale de la plateforme).
-- À appliquer dans Supabase, après la 0010 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancé sur une base qui l'a déjà, il ne change rien et ne casse rien.

begin;

-- Réservé à l'équipe (admin, moderateur, super_admin) : un étudiant ne lit jamais ces chiffres.
-- `p_maintenant` fixe la date de référence (les tests s'en servent) ; par défaut, maintenant.
-- Les revenus, abonnés et sessions live arrivent avec leurs lots (2 et 5) : la fonction s'enrichira alors.
create or replace function public.statistiques_back_office(p_maintenant timestamptz default now())
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_mois timestamptz := date_trunc('month', p_maintenant);
  v_resultat jsonb;
begin
  if not public.equipe_contenus() then
    raise exception 'Les statistiques sont réservées à l’équipe.' using errcode = '42501';
  end if;

  with
    -- Une ligne par étudiant et par formation commencée : sa part de leçons terminées.
    suivis as (
      select p.profil_id, m.formation_id, count(p.terminee_le) as terminees
      from public.progression_lecons p
      join public.lecons l on l.id = p.lecon_id
      join public.modules m on m.id = l.module_id
      group by p.profil_id, m.formation_id
    ),
    totaux as (
      select m.formation_id, count(*) as lecons
      from public.lecons l
      join public.modules m on m.id = l.module_id
      group by m.formation_id
    ),
    top as (
      select f.titre, f.slug, count(*)::integer as etudiants
      from suivis s
      join public.formations f on f.id = s.formation_id
      where f.statut = 'publiee'
      group by f.id, f.titre, f.slug
      order by count(*) desc, f.titre
      limit 5
    )
  select jsonb_build_object(
    'utilisateurs', (select count(*) from public.profils),
    'inscrits_semaine', (select count(*) from public.profils where cree_le > p_maintenant - interval '7 days' and cree_le <= p_maintenant),
    'inscrits_mois', (select count(*) from public.profils where cree_le >= v_mois and cree_le <= p_maintenant),
    'inscrits_mois_precedent', (select count(*) from public.profils where cree_le >= v_mois - interval '1 month' and cree_le < v_mois),
    'progression_moyenne', (
      select round(avg(100.0 * s.terminees / t.lecons))::integer
      from suivis s
      join totaux t on t.formation_id = s.formation_id
      where t.lecons > 0
    ),
    'formations_suivies', coalesce((select jsonb_agg(jsonb_build_object('titre', titre, 'slug', slug, 'etudiants', etudiants) order by etudiants desc, titre) from top), '[]'::jsonb)
  )
  into v_resultat;

  return v_resultat;
end;
$$;

revoke execute on function public.statistiques_back_office(timestamptz) from public, anon;
grant execute on function public.statistiques_back_office(timestamptz) to authenticated;

commit;

-- ═══ 0012_couvertures.sql ═══
-- Étudium · migration 0012 : image de couverture des formations (spec des couvertures, 13 octobre 2026).
-- À appliquer dans Supabase, après la 0011 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancé sur une base qui l'a déjà, il ne change rien et ne casse rien.

begin;

-- ─── La couverture d'une formation : un fichier de son dossier, en JPG, PNG ou WebP ─────────────────
-- Sans couverture (null), l'application montre une couverture par défaut aux couleurs du parcours.
alter table public.formations add column if not exists couverture text;
alter table public.formations drop constraint if exists formations_couverture_chemin;
alter table public.formations add constraint formations_couverture_chemin
  check (couverture is null or couverture ~ ('^' || id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$'));

-- ─── Espace « couvertures » : public (visiteurs et aperçus WhatsApp), 5 Mo, images seulement ─────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('couvertures', 'couvertures', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Les images se lisent par leur adresse publique (espace public), sans règle. Lister l'espace, en revanche, révélerait
-- les images des formations pas encore publiées : réservé à l'équipe (qui en a besoin pour remplacer et supprimer).
drop policy if exists "couvertures : lecture pour tous" on storage.objects;
drop policy if exists "couvertures : l'équipe liste" on storage.objects;
create policy "couvertures : l'équipe liste" on storage.objects
  for select to authenticated
  using (bucket_id = 'couvertures' and (select public.equipe_contenus()));

-- L'équipe dépose, remplace et supprime, toujours dans le dossier d'une formation existante. Les formateurs, pour
-- leurs propres formations, arriveront avec la création de formation par le formateur.
drop policy if exists "couvertures : l'équipe dépose" on storage.objects;
create policy "couvertures : l'équipe dépose" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'couvertures'
    and (select public.equipe_contenus())
    and exists (select 1 from public.formations f where f.id::text = (storage.foldername(name))[1])
  );

drop policy if exists "couvertures : l'équipe remplace" on storage.objects;
create policy "couvertures : l'équipe remplace" on storage.objects
  for update to authenticated
  using (bucket_id = 'couvertures' and (select public.equipe_contenus()))
  with check (
    bucket_id = 'couvertures'
    and (select public.equipe_contenus())
    and exists (select 1 from public.formations f where f.id::text = (storage.foldername(name))[1])
  );

drop policy if exists "couvertures : l'équipe supprime" on storage.objects;
create policy "couvertures : l'équipe supprime" on storage.objects
  for delete to authenticated
  using (bucket_id = 'couvertures' and (select public.equipe_contenus()));

commit;

-- ═══ 0013_utilisateurs.sql ═══
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

-- Stockage (photos de profil, ressources, couvertures) : plus rien pour un compte suspendu, ni lecture ni dépôt.
-- Règle restrictive elle aussi : elle s'ajoute aux règles de chaque espace sans les réécrire.
drop policy if exists "compte suspendu : rien" on storage.objects;
create policy "compte suspendu : rien" on storage.objects
  as restrictive for all to authenticated
  using (not (select public.compte_suspendu()))
  with check (not (select public.compte_suspendu()));

-- Supprimer son compte (0002) : refusé à un compte suspendu, dont la suspension serait effacée avec lui (il pourrait
-- ensuite se réinscrire avec la même adresse). Ses données sont gardées (spec, §4).
create or replace function public.supprimer_mon_compte()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'non connecté';
  end if;
  if public.compte_suspendu() then
    raise exception 'Ce compte est suspendu.' using errcode = '42501';
  end if;
  delete from auth.users where id = (select auth.uid());
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

-- ─── Lire les comptes (équipe du back-office) ───────────────────────────────────────────────────────
-- L'adresse e-mail et la dernière connexion sont dans l'authentification de Supabase, que l'application ne lit pas :
-- ces fonctions les lisent pour l'équipe seulement.

-- Minuscules et sans accents, pour chercher « Fifamè » en tapant « fifame ».
create or replace function public.sans_accents(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(translate(
    coalesce(t, ''),
    'àâäáãåéèêëíìîïóòôöõúùûüçñÿÀÂÄÁÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÇÑŸ',
    'aaaaaaeeeeiiiiooooouuuucnyAAAAAAEEEEIIIIOOOOOUUUUCNY'
  ));
$$;

-- Une page de 25 comptes, les plus récents d'abord, et le nombre total. Recherche dans le nom (sans accents ni
-- majuscules) ou l'adresse e-mail, par simple inclusion (strpos : « % » ou « _ » ne sont jamais des jokers).
-- Filtres : etudiants (aucun autre rôle), formateurs, equipe, suspendus ; toute autre valeur : tous.
create or replace function public.comptes_equipe(p_recherche text default '', p_filtre text default 'tous', p_page integer default 1)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := public.sans_accents(btrim(coalesce(p_recherche, '')));
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_resultat jsonb;
begin
  if not public.equipe_contenus() then
    raise exception 'Accès réservé à l’équipe.' using errcode = '42501';
  end if;

  with comptes as (
    select
      p.id, p.prenom, p.nom, coalesce(u.email, '') as email, p.cree_le, u.last_sign_in_at,
      coalesce((select array_agg(r.role order by r.role) from public.roles r where r.profil_id = p.id), '{}') as roles,
      exists (select 1 from public.suspensions s where s.profil_id = p.id) as suspendu
    from public.profils p
    left join auth.users u on u.id = p.id
  ),
  retenus as (
    select * from comptes c
    where (v_q = '' or strpos(public.sans_accents(c.prenom || ' ' || c.nom), v_q) > 0 or strpos(lower(c.email), v_q) > 0)
      and case p_filtre
        when 'etudiants' then not (c.roles && array['formateur', 'moderateur', 'admin', 'super_admin']::public.role_etudium[])
        when 'formateurs' then 'formateur' = any (c.roles)
        when 'equipe' then c.roles && array['moderateur', 'admin', 'super_admin']::public.role_etudium[]
        when 'suspendus' then c.suspendu
        else true
      end
  ),
  page as (
    select * from retenus order by cree_le desc, id limit 25 offset (v_page - 1) * 25
  )
  select jsonb_build_object(
    'total', (select count(*) from retenus),
    'comptes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'prenom', g.prenom,
        'nom', g.nom,
        'email', g.email,
        'roles', to_jsonb(g.roles::text[]),
        'inscrit_le', g.cree_le,
        'derniere_connexion', g.last_sign_in_at,
        'suspendu', g.suspendu
      ) order by g.cree_le desc, g.id)
      from page g
    ), '[]'::jsonb)
  ) into v_resultat;
  return v_resultat;
end;
$$;

-- La fiche d'un compte : identité, rôles, suspension, fiche formateur reliée, formations suivies (au moins une
-- leçon ouverte) et avis laissés. Null si le compte n'existe pas.
create or replace function public.compte_equipe(p_compte uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_resultat jsonb;
begin
  if not public.equipe_contenus() then
    raise exception 'Accès réservé à l’équipe.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', p.id,
    'prenom', p.prenom,
    'nom', p.nom,
    'email', coalesce(u.email, ''),
    'inscrit_le', p.cree_le,
    'derniere_connexion', u.last_sign_in_at,
    'roles', to_jsonb(coalesce((select array_agg(r.role order by r.role) from public.roles r where r.profil_id = p.id), '{}')::text[]),
    'suspension', (
      select jsonb_build_object('depuis', s.depuis, 'par_nom', coalesce(btrim(a.prenom || ' ' || a.nom), ''), 'motif', s.motif)
      from public.suspensions s
      left join public.profils a on a.id = s.par
      where s.profil_id = p.id
    ),
    'fiche_formateur', (select jsonb_build_object('id', f.id, 'nom', f.nom) from public.formateurs f where f.compte_id = p.id),
    'formations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'titre', t.titre, 'slug', t.slug, 'terminees', t.terminees, 'total', t.total, 'derniere_activite', t.derniere_activite
      ) order by t.derniere_activite desc)
      from (
        select
          fo.id, fo.titre, fo.slug,
          count(pl.terminee_le) as terminees,
          (select count(*) from public.lecons l2 join public.modules m2 on m2.id = l2.module_id where m2.formation_id = fo.id) as total,
          max(greatest(pl.vue_le, pl.terminee_le, pl.dernier_envoi)) as derniere_activite
        from public.progression_lecons pl
        join public.lecons l on l.id = pl.lecon_id
        join public.modules m on m.id = l.module_id
        join public.formations fo on fo.id = m.formation_id
        where pl.profil_id = p.id
        group by fo.id
      ) t
    ), '[]'::jsonb),
    'avis', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', av.id, 'formation_titre', fo.titre, 'note', av.note, 'commentaire', av.commentaire, 'masque', av.masque, 'cree_le', av.cree_le
      ) order by av.cree_le desc)
      from public.avis av
      join public.formations fo on fo.id = av.formation_id
      where av.profil_id = p.id
    ), '[]'::jsonb)
  ) into v_resultat
  from public.profils p
  left join auth.users u on u.id = p.id
  where p.id = p_compte;
  return v_resultat;
end;
$$;

-- ─── Changer les rôles d'un compte (super admin seul) ───────────────────────────────────────────────
-- Une fiche formateur n'est reliée qu'à un compte.
create unique index if not exists formateurs_compte_unique on public.formateurs (compte_id) where compte_id is not null;

-- Le lien entre une fiche et un compte ne s'écrit que par changer_roles (super admin) : l'équipe garde le droit
-- d'écrire le contenu des fiches (0004), mais plus la colonne compte_id directement.
revoke insert, update on public.formateurs from authenticated;
grant insert (nom, titre, domaine, presentation, photo), update (nom, titre, domaine, presentation, photo) on public.formateurs to authenticated;

-- D'un seul coup : les rôles voulus (Étudiant toujours gardé) et, pour Formateur, la fiche reliée (existante libre,
-- ou créée à son nom). Retirer Formateur détache la fiche, qui reste avec ses formations.
create or replace function public.changer_roles(
  p_compte uuid,
  p_roles public.role_etudium[],
  p_fiche uuid default null,
  p_nouvelle_fiche boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prenom text;
  v_nom text;
  v_roles public.role_etudium[];
  v_actuels public.role_etudium[];
begin
  if not public.a_role('super_admin') then
    raise exception 'Seul le super admin change les rôles.' using errcode = '42501';
  end if;
  select prenom, nom into v_prenom, v_nom from public.profils where id = p_compte;
  if not found then
    raise exception 'Compte introuvable.';
  end if;

  select coalesce(array_agg(distinct r), '{}') into v_roles from unnest(coalesce(p_roles, '{}') || 'etudiant'::public.role_etudium) r;
  select coalesce(array_agg(role), '{}') into v_actuels from public.roles where profil_id = p_compte;

  if p_compte = (select auth.uid()) and not ('super_admin' = any (v_roles)) then
    raise exception 'Vous ne pouvez pas vous retirer le rôle super admin.';
  end if;
  if exists (select 1 from public.suspensions where profil_id = p_compte)
     and not (array_remove(v_roles, 'etudiant') <@ v_actuels) then
    raise exception 'Réactivez le compte avant de lui donner un rôle.';
  end if;

  if 'formateur' = any (v_roles) then
    if not exists (select 1 from public.formateurs where compte_id = p_compte) then
      if p_nouvelle_fiche then
        insert into public.formateurs (nom, compte_id)
        values (left(coalesce(nullif(btrim(v_prenom || ' ' || v_nom), ''), 'Formateur'), 80), p_compte);
      elsif p_fiche is not null then
        update public.formateurs set compte_id = p_compte where id = p_fiche and compte_id is null;
        if not found then
          raise exception 'Cette fiche formateur n’existe plus ou est déjà reliée à un compte.';
        end if;
      else
        raise exception 'Choisissez la fiche formateur de ce compte.';
      end if;
    end if;
  else
    update public.formateurs set compte_id = null where compte_id = p_compte;
  end if;

  delete from public.roles where profil_id = p_compte and not (role = any (v_roles));
  insert into public.roles (profil_id, role) select p_compte, r from unnest(v_roles) r on conflict do nothing;
end;
$$;

revoke execute on function public.comptes_equipe(text, text, integer) from public, anon;
revoke execute on function public.compte_equipe(uuid) from public, anon;
revoke execute on function public.changer_roles(uuid, public.role_etudium[], uuid, boolean) from public, anon;
grant execute on function public.comptes_equipe(text, text, integer) to authenticated;
grant execute on function public.compte_equipe(uuid) to authenticated;
grant execute on function public.changer_roles(uuid, public.role_etudium[], uuid, boolean) to authenticated;

commit;

-- ═══ 0014_espace_formateur.sql ═══
-- Étudium · migration 0014 : espace formateur, « Mes formations » (spec de l'espace formateur, 13 octobre 2026).
-- À appliquer dans Supabase, après la 0013 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancé sur une base qui l'a déjà, il ne change rien et ne casse rien. Si une migration plus ancienne
-- est rejouée un jour (0004, 0009, 0013…), rejouer celle-ci ensuite.

begin;

-- ─── Relecture d'une formation par un admin ─────────────────────────────────────────────────────────
-- Envoyée par son formateur (envoyee_le), renvoyée par l'équipe avec une remarque (renvoyee_le, remarque_relecture),
-- et, une fois en ligne, la dernière modification faite par son formateur (modifiee_par_formateur_le).
alter table public.formations add column if not exists envoyee_le timestamptz;
alter table public.formations add column if not exists renvoyee_le timestamptz;
alter table public.formations add column if not exists remarque_relecture text;
alter table public.formations add column if not exists modifiee_par_formateur_le timestamptz;
alter table public.formations drop constraint if exists formations_remarque_longueur;
alter table public.formations add constraint formations_remarque_longueur check (char_length(remarque_relecture) <= 1000);

-- ─── Qui est le formateur d'une formation ───────────────────────────────────────────────────────────
-- La fiche formateur reliée au compte qui demande (page Utilisateurs, 0013), s'il a le rôle formateur.
-- a_role tient compte de la suspension : un formateur suspendu n'a plus de fiche.
create or replace function public.ma_fiche_formateur()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select f.id from public.formateurs f
  where f.compte_id = (select auth.uid()) and public.a_role('formateur');
$$;

create or replace function public.formateur_de(p_formation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.formations f
    where f.id = p_formation and f.formateur_id is not null and f.formateur_id = public.ma_fiche_formateur()
  );
$$;

create or replace function public.formation_du_module(p_module uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select formation_id from public.modules where id = p_module;
$$;

create or replace function public.formation_de_la_lecon(p_lecon uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.formation_id from public.lecons l join public.modules m on m.id = l.module_id where l.id = p_lecon;
$$;

-- Le premier dossier d'un chemin de fichier (« <formation>/<fichier> ») est-il une formation du formateur ?
create or replace function public.formateur_du_dossier(p_nom text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_dossier text := (storage.foldername(p_nom))[1];
begin
  if v_dossier is null or v_dossier !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.formateur_de(v_dossier::uuid);
end;
$$;

grant execute on function public.ma_fiche_formateur() to anon, authenticated;
grant execute on function public.formateur_de(uuid) to anon, authenticated;
grant execute on function public.formation_du_module(uuid) to anon, authenticated;
grant execute on function public.formation_de_la_lecon(uuid) to anon, authenticated;
grant execute on function public.formateur_du_dossier(text) to anon, authenticated;

-- ─── Lecture : le formateur voit ses formations, et lit leurs leçons ────────────────────────────────
-- Une seule règle de lecture (0009, complétée). La colonne de la ligne, et non formateur_de(id) : une fonction ne voit
-- pas encore la ligne qu'une création est en train d'écrire (« insert … returning » serait refusé).
drop policy if exists "formations publiées visibles" on public.formations;
create policy "formations publiées visibles" on public.formations
  for select to anon, authenticated
  using (
    statut = 'publiee'
    or (select public.equipe_contenus())
    or public.formation_commencee(id)
    or formateur_id = (select public.ma_fiche_formateur())
  );

-- Accès à une leçon (0004, 0013) : celles de ses formations aussi, même en brouillon. La suspension (0013) est gardée.
create or replace function public.acces_lecon(p_lecon uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not public.compte_suspendu() and (
    public.equipe_contenus()
    or public.formateur_de(public.formation_de_la_lecon(p_lecon))
    or exists (
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

-- Avis (0010, 0013) : un formateur ne note pas sa propre formation. Il en lit toutes les leçons (ci-dessus), même
-- payantes : il pourrait sinon atteindre les 50 % et se donner une note. La suspension (0013) est gardée.
create or replace function public.peut_donner_avis(p_formation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and not public.compte_suspendu()
    and not public.formateur_de(p_formation)
    and exists (select 1 from public.formations f where f.id = p_formation and f.statut = 'publiee')
    and (
      select count(*) > 0 and count(p.terminee_le) * 2 >= count(*)
      from public.lecons l
      join public.modules m on m.id = l.module_id
      left join public.progression_lecons p on p.lecon_id = l.id and p.profil_id = (select auth.uid())
      where m.formation_id = p_formation
    );
$$;

-- ─── Écriture : le formateur écrit dans ses formations ──────────────────────────────────────────────
-- Une règle par action, comme celles de l'équipe (0004) ; la condition dépend de la table.
do $$
declare
  t text;
  condition text;
begin
  foreach t in array array['formations', 'formations_parcours', 'modules', 'lecons', 'lecons_contenus', 'ressources'] loop
    condition := case t
      when 'formations' then 'formateur_id = (select public.ma_fiche_formateur())'
      when 'formations_parcours' then 'public.formateur_de(formation_id)'
      when 'modules' then 'public.formateur_de(formation_id)'
      when 'lecons' then 'public.formateur_de(public.formation_du_module(module_id))'
      else 'public.formateur_de(public.formation_de_la_lecon(lecon_id))'
    end;
    execute format('drop policy if exists %I on public.%I', 'le formateur ajoute', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)', 'le formateur ajoute', t, condition);
    execute format('drop policy if exists %I on public.%I', 'le formateur modifie', t);
    execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', 'le formateur modifie', t, condition, condition);
    execute format('drop policy if exists %I on public.%I', 'le formateur supprime', t);
    execute format('create policy %I on public.%I for delete to authenticated using (%s)', 'le formateur supprime', t, condition);
  end loop;
end;
$$;

-- ─── Garde-fous : ce qui revient à l'équipe ─────────────────────────────────────────────────────────
-- Seulement pour les écritures directes d'un formateur par l'API (rôle « authenticated », hors équipe). Les fonctions
-- « security definer » (relecture, note des avis) et l'éditeur SQL passent : elles ont leurs propres vérifications.
create or replace function public.formations_formateur()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_fiche uuid;
begin
  -- Publiée (par l'équipe) : l'envoi en relecture et la remarque n'ont plus lieu d'être.
  if tg_op = 'UPDATE' and new.statut = 'publiee' and old.statut is distinct from 'publiee' then
    new.envoyee_le := null;
    new.renvoyee_le := null;
    new.remarque_relecture := null;
  end if;

  if current_user <> 'authenticated' or public.equipe_contenus() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_fiche := public.ma_fiche_formateur();
    if v_fiche is null then
      raise exception 'Votre compte n’est pas encore relié à une fiche formateur. Contactez l’équipe Étudium.' using errcode = '42501';
    end if;
    -- Un brouillon, à sa fiche, avec les réglages par défaut : le reste est décidé par l'équipe.
    new.formateur_id := v_fiche;
    new.statut := 'brouillon';
    new.gratuite := false;
    new.achat_separe := false;
    new.prix_fcfa := null;
    new.badge := null;
    new.seuil_video := 90;
    new.envoyee_le := null;
    new.renvoyee_le := null;
    new.remarque_relecture := null;
    new.modifiee_par_formateur_le := null;
    new.note_moyenne := null;
    new.nb_avis := 0;
    return new;
  end if;

  if new.statut is distinct from old.statut
     or new.formateur_id is distinct from old.formateur_id
     or new.gratuite is distinct from old.gratuite
     or new.achat_separe is distinct from old.achat_separe
     or new.prix_fcfa is distinct from old.prix_fcfa
     or new.badge is distinct from old.badge
     or new.seuil_video is distinct from old.seuil_video
     or new.envoyee_le is distinct from old.envoyee_le
     or new.renvoyee_le is distinct from old.renvoyee_le
     or new.remarque_relecture is distinct from old.remarque_relecture
     or new.modifiee_par_formateur_le is distinct from old.modifiee_par_formateur_le
     or new.note_moyenne is distinct from old.note_moyenne
     or new.nb_avis is distinct from old.nb_avis then
    raise exception 'Ce réglage revient à l’équipe Étudium.';
  end if;

  -- En ligne : l'équipe voit « Modifiée par le formateur le … ».
  if old.publiee_le is not null then
    new.modifiee_par_formateur_le := now();
  end if;
  return new;
end;
$$;

drop trigger if exists formations_formateur on public.formations;
create trigger formations_formateur
  before insert or update on public.formations
  for each row execute function public.formations_formateur();

-- Une modification du programme d'une formation en ligne par son formateur est datée, comme celle de ses informations.
-- La fonction vérifie elle-même que la formation est bien celle du formateur qui demande.
create or replace function public.marquer_modifiee_par_formateur(p_formation uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.formations set modifiee_par_formateur_le = now()
  where id = p_formation and publiee_le is not null and public.formateur_de(p_formation);
$$;
revoke execute on function public.marquer_modifiee_par_formateur(uuid) from public, anon;
grant execute on function public.marquer_modifiee_par_formateur(uuid) to authenticated;

create or replace function public.apres_modification_formateur()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_ligne jsonb;
  v_formation uuid;
begin
  if current_user <> 'authenticated' or public.equipe_contenus() then
    return null;
  end if;
  v_ligne := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  v_formation := coalesce(
    (v_ligne ->> 'formation_id')::uuid,
    public.formation_du_module((v_ligne ->> 'module_id')::uuid),
    public.formation_de_la_lecon((v_ligne ->> 'lecon_id')::uuid)
  );
  if v_formation is not null then
    perform public.marquer_modifiee_par_formateur(v_formation);
  end if;
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['formations_parcours', 'modules', 'lecons', 'lecons_contenus', 'ressources'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_modification_formateur', t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.apres_modification_formateur()',
      t || '_modification_formateur', t
    );
  end loop;
end;
$$;

-- ─── Fichiers : le formateur gère ceux de ses formations ────────────────────────────────────────────
-- Couvertures (0012) et ressources (0004) : lister, déposer, remplacer et supprimer dans le dossier de ses formations.
do $$
declare
  espace text;
begin
  foreach espace in array array['couvertures', 'ressources'] loop
    execute format('drop policy if exists %I on storage.objects', espace || ' : le formateur liste');
    execute format(
      'create policy %I on storage.objects for select to authenticated using (bucket_id = %L and public.formateur_du_dossier(name))',
      espace || ' : le formateur liste', espace
    );
    execute format('drop policy if exists %I on storage.objects', espace || ' : le formateur dépose');
    execute format(
      'create policy %I on storage.objects for insert to authenticated with check (bucket_id = %L and public.formateur_du_dossier(name))',
      espace || ' : le formateur dépose', espace
    );
    execute format('drop policy if exists %I on storage.objects', espace || ' : le formateur remplace');
    execute format(
      'create policy %I on storage.objects for update to authenticated using (bucket_id = %L and public.formateur_du_dossier(name)) with check (bucket_id = %L and public.formateur_du_dossier(name))',
      espace || ' : le formateur remplace', espace, espace
    );
    execute format('drop policy if exists %I on storage.objects', espace || ' : le formateur supprime');
    execute format(
      'create policy %I on storage.objects for delete to authenticated using (bucket_id = %L and public.formateur_du_dossier(name))',
      espace || ' : le formateur supprime', espace
    );
  end loop;
end;
$$;

-- ─── Relecture ──────────────────────────────────────────────────────────────────────────────────────
-- Le formateur envoie son brouillon (au moins une leçon) ; il peut encore le modifier pendant la relecture.
create or replace function public.envoyer_en_relecture(p_formation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.formateur_de(p_formation) then
    raise exception 'Cette formation n’est pas la vôtre.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.formations where id = p_formation and statut = 'brouillon') then
    raise exception 'Seul un brouillon s’envoie en relecture.';
  end if;
  if not exists (
    select 1 from public.lecons l join public.modules m on m.id = l.module_id where m.formation_id = p_formation
  ) then
    raise exception 'Ajoutez au moins une leçon avant d’envoyer la formation en relecture.';
  end if;
  update public.formations
  set envoyee_le = now(), renvoyee_le = null, remarque_relecture = null
  where id = p_formation;
end;
$$;

-- L'équipe renvoie une formation en attente à son formateur, avec une remarque (obligatoire).
create or replace function public.renvoyer_au_formateur(p_formation uuid, p_remarque text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_remarque text := regexp_replace(coalesce(p_remarque, ''), '^\s+|\s+$', '', 'g');
begin
  if not public.equipe_contenus() then
    raise exception 'Accès réservé à l’équipe.' using errcode = '42501';
  end if;
  if char_length(v_remarque) = 0 or char_length(v_remarque) > 1000 then
    raise exception 'Écrivez une remarque pour le formateur (1 000 caractères au plus).';
  end if;
  if not exists (select 1 from public.formations where id = p_formation and statut = 'brouillon' and envoyee_le is not null) then
    raise exception 'Cette formation n’attend pas de validation.';
  end if;
  update public.formations
  set envoyee_le = null, renvoyee_le = now(), remarque_relecture = v_remarque
  where id = p_formation;
end;
$$;

revoke execute on function public.envoyer_en_relecture(uuid) from public, anon;
revoke execute on function public.renvoyer_au_formateur(uuid, text) from public, anon;
grant execute on function public.envoyer_en_relecture(uuid) to authenticated;
grant execute on function public.renvoyer_au_formateur(uuid, text) to authenticated;

commit;

-- ═══ 0015_suivi_etudiants.sql ═══
-- Étudium · migration 0015 : suivi des étudiants par le formateur et tableau de bord du formateur
-- (spec « Étudiants » et tableau de bord du formateur, 14 octobre 2026).
-- À appliquer dans Supabase, après la 0014 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancé sur une base qui l'a déjà, il ne change rien et ne casse rien.

begin;

-- ─── Définitions (spec, §2) ─────────────────────────────────────────────────────────────────────────
-- État d'un étudiant sur une formation : terminée (toutes les leçons), à risque (rien depuis plus de 10 jours),
-- sinon en cours.
create or replace function public.etat_suivi(p_terminees integer, p_total integer, p_derniere timestamptz, p_maintenant timestamptz)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_total > 0 and p_terminees >= p_total then 'terminee'
    when p_derniere < p_maintenant - interval '10 days' then 'a_risque'
    else 'en_cours'
  end;
$$;

-- Une ligne par étudiant et par formation d'une fiche formateur. Étudiant : un compte qui a ouvert au moins une leçon
-- de la formation (pas encore d'inscription : lot 2). Le compte relié à la fiche et ceux de l'équipe ne comptent pas.
-- Interne : appelée seulement par les fonctions ci-dessous, jamais directement (aucun droit d'exécution).
create or replace function public.suivi_formateur(p_fiche uuid)
returns table (
  etudiant uuid,
  prenom text,
  nom text,
  formation uuid,
  formation_titre text,
  terminees integer,
  total integer,
  secondes integer,
  derniere_activite timestamptz,
  premiere_ouverture timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with mes_formations as (
    select
      f.id, f.titre, fo.compte_id,
      (select count(*) from public.lecons l join public.modules m on m.id = l.module_id where m.formation_id = f.id)::integer as nb_lecons
    from public.formations f
    join public.formateurs fo on fo.id = f.formateur_id
    where f.formateur_id = p_fiche
  )
  select
    p.profil_id, pr.prenom, pr.nom, mf.id, mf.titre,
    count(p.terminee_le)::integer,
    mf.nb_lecons,
    coalesce(sum(public.secondes_couvertes(p.passages)), 0)::integer,
    max(greatest(p.vue_le, p.terminee_le, p.dernier_envoi)),
    min(p.ouverte_le)
  from mes_formations mf
  join public.modules m on m.formation_id = mf.id
  join public.lecons l on l.module_id = m.id
  join public.progression_lecons p on p.lecon_id = l.id
  join public.profils pr on pr.id = p.profil_id
  where p.profil_id is distinct from mf.compte_id
    and not exists (select 1 from public.roles r where r.profil_id = p.profil_id and r.role in ('moderateur', 'admin', 'super_admin'))
  group by p.profil_id, pr.prenom, pr.nom, mf.id, mf.titre, mf.nb_lecons;
$$;
revoke execute on function public.suivi_formateur(uuid) from public, anon, authenticated;

-- ─── Remarques privées du formateur sur un étudiant ─────────────────────────────────────────────────
-- Une par formateur et par étudiant. Lues par leur auteur et par l'équipe, jamais par l'étudiant ; écrites seulement
-- par enregistrer_remarque (plus bas), qui vérifie que l'étudiant suit l'une des formations du formateur.
create table if not exists public.remarques_formateur (
  formateur uuid not null references public.profils (id) on delete cascade,
  etudiant uuid not null references public.profils (id) on delete cascade,
  texte text not null,
  modifiee_le timestamptz not null default now(),
  primary key (formateur, etudiant),
  constraint remarques_formateur_texte_longueur check (char_length(texte) between 1 and 2000)
);
alter table public.remarques_formateur enable row level security;
revoke all on public.remarques_formateur from anon;
revoke insert, update, delete, truncate on public.remarques_formateur from authenticated;

drop policy if exists "remarques : leur auteur et l'équipe" on public.remarques_formateur;
create policy "remarques : leur auteur et l'équipe" on public.remarques_formateur
  for select to authenticated
  using (formateur = (select auth.uid()) or (select public.equipe_contenus()));

-- Un compte suspendu ne lit plus rien (comme ses autres données, 0013).
drop policy if exists "compte suspendu : rien" on public.remarques_formateur;
create policy "compte suspendu : rien" on public.remarques_formateur
  as restrictive for all to authenticated
  using (not (select public.compte_suspendu())) with check (not (select public.compte_suspendu()));

-- ─── Les étudiants du formateur ─────────────────────────────────────────────────────────────────────
-- Une page de 25 lignes (étudiant, formation), les plus récemment actifs d'abord. Filtres : une de ses formations,
-- l'état (a_risque, terminees ; toute autre valeur : tous), le nom (sans accents ni majuscules, jamais de joker).
-- Jamais d'adresse e-mail.
create or replace function public.etudiants_formateur(
  p_recherche text default '',
  p_formation uuid default null,
  p_etat text default 'tous',
  p_page integer default 1,
  p_maintenant timestamptz default now()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_fiche uuid := public.ma_fiche_formateur();
  v_q text := public.sans_accents(btrim(coalesce(p_recherche, '')));
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_resultat jsonb;
begin
  if v_fiche is null then
    raise exception 'Votre compte n’est pas encore relié à une fiche formateur.' using errcode = '42501';
  end if;

  with lignes as (
    select s.*, public.etat_suivi(s.terminees, s.total, s.derniere_activite, p_maintenant) as etat
    from public.suivi_formateur(v_fiche) s
  ),
  retenues as (
    select * from lignes x
    where (p_formation is null or x.formation = p_formation)
      and (v_q = '' or strpos(public.sans_accents(x.prenom || ' ' || x.nom), v_q) > 0)
      and case p_etat
        when 'a_risque' then x.etat = 'a_risque'
        when 'terminees' then x.etat = 'terminee'
        else true
      end
  ),
  page as (
    select * from retenues order by derniere_activite desc, etudiant, formation limit 25 offset (v_page - 1) * 25
  )
  select jsonb_build_object(
    'total', (select count(*) from retenues),
    'lignes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'etudiant_id', g.etudiant,
        'prenom', g.prenom,
        'nom', g.nom,
        'formation_id', g.formation,
        'formation_titre', g.formation_titre,
        'terminees', g.terminees,
        'total', g.total,
        'derniere_activite', g.derniere_activite,
        'etat', g.etat
      ) order by g.derniere_activite desc, g.etudiant, g.formation)
      from page g
    ), '[]'::jsonb)
  ) into v_resultat;
  return v_resultat;
end;
$$;

-- La fiche d'un étudiant : chacune des formations du formateur qu'il suit, leçon par leçon (terminée, ouverte, pas
-- encore ouverte ; temps de vidéo). Null s'il ne suit aucune de ses formations.
create or replace function public.etudiant_formateur(p_etudiant uuid, p_maintenant timestamptz default now())
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_fiche uuid := public.ma_fiche_formateur();
  v_resultat jsonb;
begin
  if v_fiche is null then
    raise exception 'Votre compte n’est pas encore relié à une fiche formateur.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.suivi_formateur(v_fiche) s where s.etudiant = p_etudiant) then
    return null;
  end if;

  select jsonb_build_object(
    'id', pr.id,
    'prenom', pr.prenom,
    'nom', pr.nom,
    'formations', (
      select jsonb_agg(jsonb_build_object(
        'id', s.formation,
        'titre', s.formation_titre,
        'terminees', s.terminees,
        'total', s.total,
        'secondes', s.secondes,
        'derniere_activite', s.derniere_activite,
        'etat', public.etat_suivi(s.terminees, s.total, s.derniere_activite, p_maintenant),
        'modules', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', m.id,
            'titre', m.titre,
            'lecons', (
              select coalesce(jsonb_agg(jsonb_build_object(
                'id', l.id,
                'titre', l.titre,
                'etat', case when p.terminee_le is not null then 'terminee' when p.lecon_id is not null then 'ouverte' else 'non_ouverte' end,
                'terminee_le', p.terminee_le,
                'secondes', coalesce(public.secondes_couvertes(p.passages), 0)
              ) order by l.ordre, l.cree_le), '[]'::jsonb)
              from public.lecons l
              left join public.progression_lecons p on p.lecon_id = l.id and p.profil_id = p_etudiant
              where l.module_id = m.id
            )
          ) order by m.ordre, m.cree_le), '[]'::jsonb)
          from public.modules m
          where m.formation_id = s.formation
        )
      ) order by s.derniere_activite desc)
      from public.suivi_formateur(v_fiche) s
      where s.etudiant = p_etudiant
    ),
    'remarque', (
      select jsonb_build_object('texte', r.texte, 'modifiee_le', r.modifiee_le)
      from public.remarques_formateur r
      where r.formateur = (select auth.uid()) and r.etudiant = p_etudiant
    )
  ) into v_resultat
  from public.profils pr
  where pr.id = p_etudiant;
  return v_resultat;
end;
$$;

revoke execute on function public.etudiants_formateur(text, uuid, text, integer, timestamptz) from public, anon;
revoke execute on function public.etudiant_formateur(uuid, timestamptz) from public, anon;
grant execute on function public.etudiants_formateur(text, uuid, text, integer, timestamptz) to authenticated;
grant execute on function public.etudiant_formateur(uuid, timestamptz) to authenticated;

-- ─── Écrire une remarque ────────────────────────────────────────────────────────────────────────────
-- Sur un étudiant de ses formations seulement. Espaces de début et de fin retirés ; vide : la remarque est supprimée.
create or replace function public.enregistrer_remarque(p_etudiant uuid, p_texte text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fiche uuid := public.ma_fiche_formateur();
  v_texte text := regexp_replace(coalesce(p_texte, ''), '^\s+|\s+$', '', 'g');
begin
  if v_fiche is null then
    raise exception 'Votre compte n’est pas encore relié à une fiche formateur.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.suivi_formateur(v_fiche) s where s.etudiant = p_etudiant) then
    raise exception 'Cet étudiant ne suit aucune de vos formations.';
  end if;
  if char_length(v_texte) = 0 then
    delete from public.remarques_formateur where formateur = (select auth.uid()) and etudiant = p_etudiant;
    return;
  end if;
  if char_length(v_texte) > 2000 then
    raise exception 'La remarque dépasse 2 000 caractères.';
  end if;
  insert into public.remarques_formateur (formateur, etudiant, texte)
  values ((select auth.uid()), p_etudiant, v_texte)
  on conflict (formateur, etudiant) do update set texte = excluded.texte, modifiee_le = now();
end;
$$;

-- Les remarques des formateurs sur un compte, pour l'équipe (fiche du compte au back-office), les plus récentes d'abord.
-- L'auteur est nommé par sa fiche formateur, sinon par son prénom et son nom.
create or replace function public.remarques_compte(p_compte uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.equipe_contenus() then
    raise exception 'Accès réservé à l’équipe.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'formateur_nom', coalesce(
        (select fo.nom from public.formateurs fo where fo.compte_id = r.formateur),
        nullif(btrim(p.prenom || ' ' || p.nom), ''),
        'Formateur'
      ),
      'texte', r.texte,
      'modifiee_le', r.modifiee_le
    ) order by r.modifiee_le desc)
    from public.remarques_formateur r
    left join public.profils p on p.id = r.formateur
    where r.etudiant = p_compte
  ), '[]'::jsonb);
end;
$$;

-- ─── Tableau de bord du formateur (design NdFormateur) ──────────────────────────────────────────────
-- Ses formations (dont brouillons), ses étudiants (dont nouveaux ce mois, heure du Bénin : UTC+1 toute l'année),
-- la progression moyenne, les 5 étudiants les plus inactifs parmi ceux à risque, et le détail par formation.
create or replace function public.tableau_de_bord_formateur(p_maintenant timestamptz default now())
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_fiche uuid := public.ma_fiche_formateur();
  v_debut_mois timestamptz := (date_trunc('month', (p_maintenant at time zone 'UTC') + interval '1 hour') - interval '1 hour') at time zone 'UTC';
  v_resultat jsonb;
begin
  if v_fiche is null then
    raise exception 'Votre compte n’est pas encore relié à une fiche formateur.' using errcode = '42501';
  end if;

  with s as (
    select x.*, public.etat_suivi(x.terminees, x.total, x.derniere_activite, p_maintenant) as etat
    from public.suivi_formateur(v_fiche) x
  ),
  premieres as (
    select etudiant, min(premiere_ouverture) as premiere from s group by etudiant
  )
  select jsonb_build_object(
    'prenom', (select pr.prenom from public.profils pr where pr.id = (select auth.uid())),
    'formations', (
      select jsonb_build_object('total', count(*), 'brouillons', count(*) filter (where f.statut = 'brouillon'))
      from public.formations f where f.formateur_id = v_fiche
    ),
    'etudiants', jsonb_build_object(
      'total', (select count(*) from premieres),
      'ce_mois', (select count(*) from premieres where premiere >= v_debut_mois)
    ),
    'progression_moyenne', (select round(avg(s.terminees::numeric * 100 / s.total))::integer from s where s.total > 0),
    'a_risque', coalesce((
      select jsonb_agg(jsonb_build_object(
        'etudiant_id', r.etudiant,
        'prenom', r.prenom,
        'nom', r.nom,
        'formation_id', r.formation,
        'formation_titre', r.formation_titre,
        'jours', floor(extract(epoch from (p_maintenant - r.derniere_activite)) / 86400)::integer,
        'pourcentage', case when r.total > 0 then round(r.terminees::numeric * 100 / r.total)::integer else 0 end
      ) order by r.derniere_activite, r.etudiant)
      from (select * from s where s.etat = 'a_risque' order by s.derniere_activite, s.etudiant limit 5) r
    ), '[]'::jsonb),
    'formations_detail', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id,
        'titre', f.titre,
        'statut', f.statut,
        'envoyee_le', f.envoyee_le,
        'renvoyee_le', f.renvoyee_le,
        'inscrits', (select count(*) from s where s.formation = f.id),
        'progression_moyenne', (select round(avg(s.terminees::numeric * 100 / s.total))::integer from s where s.formation = f.id and s.total > 0),
        'completion', (
          select case when count(*) = 0 then null else round(count(*) filter (where s.etat = 'terminee')::numeric * 100 / count(*))::integer end
          from s where s.formation = f.id
        ),
        'note_moyenne', f.note_moyenne,
        'nb_avis', f.nb_avis
      ) order by f.modifie_le desc, f.id)
      from public.formations f
      where f.formateur_id = v_fiche
    ), '[]'::jsonb)
  ) into v_resultat;
  return v_resultat;
end;
$$;

revoke execute on function public.enregistrer_remarque(uuid, text) from public, anon;
revoke execute on function public.remarques_compte(uuid) from public, anon;
revoke execute on function public.tableau_de_bord_formateur(timestamptz) from public, anon;
grant execute on function public.enregistrer_remarque(uuid, text) to authenticated;
grant execute on function public.remarques_compte(uuid) to authenticated;
grant execute on function public.tableau_de_bord_formateur(timestamptz) to authenticated;

commit;

-- ═══ 0016_notifications.sql ═══
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

-- ─── Qui notifier ───────────────────────────────────────────────────────────────────────────────────
-- Règle provisoire avant les abonnements (lot 2) : un compte suit une formation dès qu'il en a ouvert une leçon.
create or replace function public.suiveurs_formation(p_formation uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct p.profil_id), '{}')
  from public.progression_lecons p
  join public.lecons l on l.id = p.lecon_id
  join public.modules m on m.id = l.module_id
  where m.formation_id = p_formation;
$$;

-- L'équipe (admin, modérateur, super admin), sans les comptes suspendus.
create or replace function public.membres_equipe()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct r.profil_id), '{}')
  from public.roles r
  where r.role in ('admin', 'moderateur', 'super_admin')
    and not exists (select 1 from public.suspensions s where s.profil_id = r.profil_id);
$$;

-- ─── Formations : publication, archivage, relecture ─────────────────────────────────────────────────
-- Des déclencheurs plutôt que des fonctions réécrites : une action faite ailleurs (éditeur SQL) notifie aussi.
create or replace function public.notifications_formations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_formateur uuid;
  v_deja uuid[] := '{}';
  v_parcours record;
  v_suiveurs uuid[];
  v_remarque text;
begin
  select compte_id into v_formateur from public.formateurs where id = new.formateur_id;

  -- Première publication (republier une formation archivée ne compte pas) : les étudiants de ses parcours, une
  -- seule fois chacun, avec le premier parcours qu'ils suivent ; puis son formateur.
  if new.publiee_le is not null and (tg_op = 'INSERT' or old.publiee_le is null) then
    for v_parcours in
      select pa.id, pa.nom_court
      from public.formations_parcours fp
      join public.parcours pa on pa.id = fp.parcours_id
      where fp.formation_id = new.id
      order by pa.ordre, pa.nom_court
    loop
      select coalesce(array_agg(distinct p.profil_id), '{}') into v_suiveurs
      from public.progression_lecons p
      join public.lecons l on l.id = p.lecon_id
      join public.modules m on m.id = l.module_id
      join public.formations_parcours fp on fp.formation_id = m.formation_id
      where fp.parcours_id = v_parcours.id
        and not (p.profil_id = any (v_deja))
        and p.profil_id is distinct from v_formateur;
      perform public.notifier(
        v_suiveurs, 'nouveaux_contenus', 'Nouvelle formation : ' || new.titre,
        'Dans le parcours ' || v_parcours.nom_court || '.', '/formations/' || new.slug
      );
      v_deja := v_deja || v_suiveurs;
    end loop;
    if v_formateur is not null then
      perform public.notifier(array[v_formateur], 'service', 'Votre formation est en ligne', new.titre, '/formateur/formations/' || new.id);
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.statut = 'archivee' and old.statut <> 'archivee' then
      perform public.notifier(
        public.suiveurs_formation(new.id), 'service', 'Formation archivée',
        new.titre || ' n’est plus disponible. Votre progression est conservée.', '/mes-formations'
      );
    end if;

    if new.envoyee_le is not null and old.envoyee_le is null then
      perform public.notifier(
        public.membres_equipe(), 'service', 'Formation à valider',
        new.titre || ', par ' || coalesce((select nom from public.formateurs where id = new.formateur_id), 'un formateur'),
        '/admin/formations/' || new.id || '?onglet=publication'
      );
    end if;

    if new.renvoyee_le is not null and new.renvoyee_le is distinct from old.renvoyee_le and v_formateur is not null then
      v_remarque := coalesce(new.remarque_relecture, '');
      if char_length(v_remarque) > 120 then
        v_remarque := left(v_remarque, 119) || '…';
      end if;
      perform public.notifier(
        array[v_formateur], 'service', 'Votre formation est à corriger', v_remarque,
        '/formateur/formations/' || new.id || '?onglet=publication'
      );
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists notifications_formations on public.formations;
create trigger notifications_formations
  after insert or update on public.formations
  for each row execute function public.notifications_formations();

-- ─── Une leçon ajoutée à une formation en ligne ─────────────────────────────────────────────────────
create or replace function public.notifications_lecons()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_formation record;
begin
  select f.id, f.titre, f.slug, f.statut into v_formation
  from public.modules m
  join public.formations f on f.id = m.formation_id
  where m.id = new.module_id;
  if found and v_formation.statut = 'publiee' then
    perform public.notifier(
      public.suiveurs_formation(v_formation.id), 'nouveaux_contenus', 'Nouvelle leçon dans ' || v_formation.titre,
      new.titre, '/formations/' || v_formation.slug || '/lecons/' || new.id
    );
  end if;
  return null;
end;
$$;

drop trigger if exists notifications_lecons on public.lecons;
create trigger notifications_lecons
  after insert on public.lecons
  for each row execute function public.notifications_lecons();

-- ─── Un nouvel avis ─────────────────────────────────────────────────────────────────────────────────
-- Une modification passe par « on conflict do update » (0010) : elle ne déclenche rien. Masquer non plus.
create or replace function public.notifications_avis()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_formation record;
  v_auteur record;
begin
  select f.titre, f.slug, fo.compte_id into v_formation
  from public.formations f
  left join public.formateurs fo on fo.id = f.formateur_id
  where f.id = new.formation_id;
  if v_formation.compte_id is null then
    return null;
  end if;
  select prenom, nom into v_auteur from public.profils where id = new.profil_id;
  perform public.notifier(
    array[v_formation.compte_id], 'service', 'Nouvel avis sur ' || v_formation.titre,
    public.nom_avis(v_auteur.prenom, v_auteur.nom) || ' : ' || new.note || '/5', '/formations/' || v_formation.slug
  );
  return null;
end;
$$;

drop trigger if exists notifications_avis on public.avis;
create trigger notifications_avis
  after insert on public.avis
  for each row execute function public.notifications_avis();

-- ─── Un rôle donné ──────────────────────────────────────────────────────────────────────────────────
-- Par requête, pas par ligne : un compte qui reçoit admin et modérateur d'un coup n'est averti qu'une fois, et un
-- membre de l'équipe qui reçoit un rôle d'équipe de plus ne l'est pas.
create or replace function public.notifications_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comptes uuid[];
begin
  v_comptes := array(select distinct profil_id from nouveaux where role = 'formateur');
  if cardinality(v_comptes) > 0 then
    perform public.notifier(v_comptes, 'service', 'Vous êtes formateur', 'Créez et suivez vos formations depuis l’espace formateur.', '/formateur');
  end if;

  v_comptes := array(
    select distinct n.profil_id from nouveaux n
    where n.role in ('moderateur', 'admin', 'super_admin')
      and not exists (
        select 1 from public.roles r
        where r.profil_id = n.profil_id
          and r.role in ('moderateur', 'admin', 'super_admin')
          and not exists (select 1 from nouveaux n2 where n2.profil_id = r.profil_id and n2.role = r.role)
      )
  );
  if cardinality(v_comptes) > 0 then
    perform public.notifier(v_comptes, 'service', 'Vous faites partie de l’équipe', 'Le back-office vous est ouvert.', '/admin');
  end if;
  return null;
end;
$$;

drop trigger if exists notifications_roles on public.roles;
create trigger notifications_roles
  after insert on public.roles
  referencing new table as nouveaux
  for each statement execute function public.notifications_roles();

-- ─── Un compte réactivé ─────────────────────────────────────────────────────────────────────────────
-- Supprimer un compte suspendu efface aussi sa suspension : son profil n'existe plus, personne n'est averti.
create or replace function public.notifications_reactivation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.profils where id = old.profil_id) then
    perform public.notifier(array[old.profil_id], 'service', 'Votre compte est réactivé', 'Vous retrouvez tous vos accès.', '/accueil');
  end if;
  return null;
end;
$$;

drop trigger if exists notifications_reactivation on public.suspensions;
create trigger notifications_reactivation
  after delete on public.suspensions
  for each row execute function public.notifications_reactivation();

-- ─── Annonces de l'équipe ───────────────────────────────────────────────────────────────────────────
-- Une rubrique du back-office : l'annonce va à tous les comptes (catégorie « Annonces » du profil). Ni lecture ni
-- écriture directes : tout passe par les deux fonctions ci-dessous, réservées à l'équipe.
create table if not exists public.annonces (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  texte text not null,
  lien text,
  auteur uuid references public.profils (id) on delete set null,
  cree_le timestamptz not null default now(),
  destinataires integer not null default 0,
  constraint annonces_titre_longueur check (char_length(titre) between 1 and 80),
  constraint annonces_texte_longueur check (char_length(texte) between 1 and 300),
  -- Une adresse du site : « / » d'abord, jamais « // » (autre site), ni espace ni barre oblique inversée.
  constraint annonces_lien check (
    lien is null or (lien ~ '^/' and lien !~ '^//' and lien !~ '[[:space:]\\]' and char_length(lien) <= 300)
  )
);
alter table public.annonces enable row level security;
revoke all on public.annonces from anon, authenticated;

-- Rend le nombre de comptes qui la reçoivent (tous, sauf son auteur et ceux qui ont coupé les annonces).
create or replace function public.publier_annonce(p_titre text, p_texte text, p_lien text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_titre text := regexp_replace(coalesce(p_titre, ''), '^\s+|\s+$', '', 'g');
  v_texte text := regexp_replace(coalesce(p_texte, ''), '^\s+|\s+$', '', 'g');
  v_lien text := nullif(regexp_replace(coalesce(p_lien, ''), '^\s+|\s+$', '', 'g'), '');
  v_annonce uuid;
  v_nombre integer;
begin
  if not public.equipe_contenus() then
    raise exception 'Accès réservé à l’équipe.' using errcode = '42501';
  end if;
  if char_length(v_titre) not between 1 and 80 then
    raise exception 'Écrivez un titre (80 caractères au plus).';
  end if;
  if char_length(v_texte) not between 1 and 300 then
    raise exception 'Écrivez le texte de l’annonce (300 caractères au plus).';
  end if;
  if v_lien is not null
     and not (v_lien ~ '^/' and v_lien !~ '^//' and v_lien !~ '[[:space:]\\]' and char_length(v_lien) <= 300) then
    raise exception 'Le lien doit être une adresse du site, commençant par « / ».';
  end if;

  insert into public.annonces (titre, texte, lien, auteur)
  values (v_titre, v_texte, v_lien, (select auth.uid()))
  returning id into v_annonce;
  v_nombre := public.notifier(array(select id from public.profils), 'annonces', v_titre, v_texte, v_lien);
  update public.annonces set destinataires = v_nombre where id = v_annonce;
  return v_nombre;
end;
$$;

-- Les 100 dernières, des plus récentes aux plus anciennes, avec le nom de leur auteur.
create or replace function public.annonces_equipe()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.equipe_contenus() then
    raise exception 'Accès réservé à l’équipe.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'titre', a.titre,
        'texte', a.texte,
        'lien', a.lien,
        'auteur', case
          when p.id is null then 'Compte supprimé'
          else coalesce(nullif(btrim(coalesce(p.prenom, '') || ' ' || coalesce(p.nom, '')), ''), 'Membre de l’équipe')
        end,
        'cree_le', a.cree_le,
        'destinataires', a.destinataires
      )
      order by a.cree_le desc, a.id
    )
    from (select * from public.annonces order by cree_le desc, id limit 100) a
    left join public.profils p on p.id = a.auteur
  ), '[]'::jsonb);
end;
$$;

-- ─── Avis masqués : l'auteur ne le sait pas ─────────────────────────────────────────────────────────
-- Son avis masqué lui reste visible, exactement comme un autre : la colonne « masque » lui est toujours rendue fausse
-- (gardée pour que la 0010 reste rejouable). Les autres ne le voient toujours pas ; il ne compte pas dans la note.
create or replace function public.avis_formation(p_formation uuid, p_limite integer default 6)
returns table (
  id uuid,
  note smallint,
  commentaire text,
  auteur text,
  initiales text,
  cree_le timestamptz,
  modifie_le timestamptz,
  est_moi boolean,
  masque boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.id,
    a.note,
    a.commentaire,
    public.nom_avis(p.prenom, p.nom),
    public.initiales_avis(p.prenom, p.nom),
    a.cree_le,
    a.modifie_le,
    coalesce(a.profil_id = (select auth.uid()), false),
    false
  from public.avis a
  join public.profils p on p.id = a.profil_id
  join public.formations f on f.id = a.formation_id
  where a.formation_id = p_formation
    and f.statut = 'publiee'
    and (not a.masque or a.profil_id = (select auth.uid()))
  order by coalesce(a.profil_id = (select auth.uid()), false) desc, a.modifie_le desc
  limit greatest(coalesce(p_limite, 6), 0);
$$;
revoke execute on function public.avis_formation(uuid, integer) from public;
grant execute on function public.avis_formation(uuid, integer) to anon, authenticated;

-- La synthèse de la fiche (moyenne, nombre, répartition) compte aussi son avis masqué, pour lui seul : sa note et le
-- nombre d'avis ne baissent pas sous ses yeux. Pour tous les autres, et dans la note de la formation, il ne compte pas.
create or replace function public.repartition_avis(p_formation uuid)
returns table (note smallint, nombre integer)
language sql
stable
security definer
set search_path = ''
as $$
  select a.note, count(*)::integer
  from public.avis a
  join public.formations f on f.id = a.formation_id
  where a.formation_id = p_formation
    and f.statut = 'publiee'
    and (not a.masque or a.profil_id = (select auth.uid()))
  group by a.note;
$$;
revoke execute on function public.repartition_avis(uuid) from public;
grant execute on function public.repartition_avis(uuid) to anon, authenticated;

-- Ses propres avis restent lisibles, sauf la colonne « masque », que seule l'équipe connaît (avis_equipe, compte_equipe).
revoke select on public.avis from authenticated;
grant select (id, profil_id, formation_id, note, commentaire, cree_le, modifie_le) on public.avis to authenticated;

revoke execute on function public.publier_annonce(text, text, text) from public, anon;
revoke execute on function public.annonces_equipe() from public, anon;
grant execute on function public.publier_annonce(text, text, text) to authenticated;
grant execute on function public.annonces_equipe() to authenticated;

revoke execute on function public.notifier(uuid[], text, text, text, text) from public, anon, authenticated;
revoke execute on function public.suiveurs_formation(uuid) from public, anon, authenticated;
revoke execute on function public.membres_equipe() from public, anon, authenticated;
revoke execute on function public.notifications_formations() from public, anon, authenticated;
revoke execute on function public.notifications_lecons() from public, anon, authenticated;
revoke execute on function public.notifications_avis() from public, anon, authenticated;
revoke execute on function public.notifications_roles() from public, anon, authenticated;
revoke execute on function public.notifications_reactivation() from public, anon, authenticated;
revoke execute on function public.mes_notifications(boolean, bigint, integer) from public, anon;
revoke execute on function public.marquer_lues(bigint[]) from public, anon;
grant execute on function public.mes_notifications(boolean, bigint, integer) to authenticated;
grant execute on function public.marquer_lues(bigint[]) to authenticated;

commit;

-- ═══ 0017_role_unique.sql ═══
-- Étudium · migration 0017 : un seul rôle en plus d'étudiant (décision du 14 octobre 2026).
-- Deux espaces au plus : étudiant et formateur, ou étudiant et back-office. L'équipe gère déjà les formations de tous
-- les formateurs : un compte de l'équipe n'est jamais formateur. Donner le rôle Formateur crée sa fiche formateur, ou
-- lui rend la sienne : plus jamais de fiche à choisir.
-- À appliquer dans Supabase, après la 0016 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancé sur une base qui l'a déjà, il ne change rien et ne casse rien. Si une migration plus ancienne
-- est rejouée un jour (0013 surtout), rejouer celle-ci ensuite.

begin;

-- ─── La fiche garde le compte qui l'a eue ───────────────────────────────────────────────────────────
-- Un compte qui perd le rôle Formateur est détaché de sa fiche (ses formations y restent) ; s'il redevient formateur,
-- il la retrouve. Les comptes ne l'écrivent pas (0013 n'accorde que nom, titre, domaine…) ; elle se lit comme compte_id.
alter table public.formateurs add column if not exists compte_precedent uuid references public.profils (id) on delete set null;
create index if not exists formateurs_compte_precedent_idx on public.formateurs (compte_precedent);

-- ─── Remise en ordre des comptes existants ──────────────────────────────────────────────────────────
-- Un compte qui a plusieurs rôles en plus d'étudiant garde le plus élevé (ordre du type : formateur, modérateur, admin,
-- super admin) : formateur et admin → admin ; admin et modérateur → admin. Celui qui perd Formateur est détaché de sa
-- fiche, gardée pour la lui rendre.
update public.formateurs f
set compte_precedent = f.compte_id, compte_id = null
where f.compte_id in (select profil_id from public.roles where role in ('moderateur', 'admin', 'super_admin'));

delete from public.roles r
where r.role <> 'etudiant'
  and exists (select 1 from public.roles e where e.profil_id = r.profil_id and e.role > r.role);

-- Chaque formateur a sa fiche, à son nom.
insert into public.formateurs (nom, compte_id)
select left(coalesce(nullif(btrim(coalesce(p.prenom, '') || ' ' || coalesce(p.nom, '')), ''), 'Formateur'), 80), p.id
from public.roles r
join public.profils p on p.id = r.profil_id
where r.role = 'formateur' and not exists (select 1 from public.formateurs f where f.compte_id = p.id);

-- ─── Un seul rôle en plus d'étudiant, vérifié par la base ───────────────────────────────────────────
-- L'index unique le garantit en toutes circonstances, même pour deux demandes simultanées ; le déclencheur, avant lui,
-- donne un message lisible. Même une insertion directe (éditeur SQL) est refusée.
create unique index if not exists roles_un_seul_role on public.roles (profil_id) where role <> 'etudiant';

create or replace function public.roles_un_seul()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role <> 'etudiant' and exists (
    select 1 from public.roles
    where profil_id = new.profil_id
      and role <> 'etudiant'
      and role <> new.role
      and (tg_op = 'INSERT' or role <> old.role)
  ) then
    raise exception 'Un compte n’a qu’un rôle en plus d’étudiant : formateur, ou un rôle de l’équipe.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists roles_un_seul on public.roles;
create trigger roles_un_seul
  before insert or update on public.roles
  for each row execute function public.roles_un_seul();

-- ─── Changer le rôle d'un compte (super admin seul) ─────────────────────────────────────────────────
-- Remplace changer_roles (0013) : un seul rôle, et la fiche formateur suit toute seule.
drop function if exists public.changer_roles(uuid, public.role_etudium[], uuid, boolean);

create or replace function public.changer_role(p_compte uuid, p_role public.role_etudium)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prenom text;
  v_nom text;
  v_actuel public.role_etudium;
  v_equipe constant public.role_etudium[] := array['moderateur', 'admin', 'super_admin']::public.role_etudium[];
begin
  if not public.a_role('super_admin') then
    raise exception 'Seul le super admin change les rôles.' using errcode = '42501';
  end if;
  select prenom, nom into v_prenom, v_nom from public.profils where id = p_compte;
  if not found then
    raise exception 'Compte introuvable.';
  end if;
  if p_role is null then
    raise exception 'Choisissez un rôle.';
  end if;

  select coalesce(max(role), 'etudiant') into v_actuel from public.roles where profil_id = p_compte and role <> 'etudiant';
  if v_actuel = p_role then
    return;
  end if;
  if p_compte = (select auth.uid()) and v_actuel = 'super_admin' then
    raise exception 'Vous ne pouvez pas vous retirer le rôle super admin.';
  end if;
  if p_role <> 'etudiant' and exists (select 1 from public.suspensions where profil_id = p_compte) then
    raise exception 'Réactivez le compte avant de lui donner un rôle.';
  end if;

  if v_actuel = any (v_equipe) and p_role = any (v_equipe) then
    -- D'un rôle d'équipe à un autre : le même espace, aucune notification « Vous faites partie de l’équipe ».
    update public.roles set role = p_role where profil_id = p_compte and role = v_actuel;
    return;
  end if;

  if v_actuel = 'formateur' then
    update public.formateurs set compte_precedent = compte_id, compte_id = null where compte_id = p_compte;
  end if;
  delete from public.roles where profil_id = p_compte and role <> 'etudiant';
  insert into public.roles (profil_id, role) values (p_compte, 'etudiant') on conflict do nothing;
  if p_role <> 'etudiant' then
    insert into public.roles (profil_id, role) values (p_compte, p_role);
  end if;

  -- Formateur : sa fiche d'avant s'il en a eu une, sinon une fiche à son nom.
  if p_role = 'formateur' and not exists (select 1 from public.formateurs where compte_id = p_compte) then
    update public.formateurs set compte_id = p_compte, compte_precedent = null
    where id = (select id from public.formateurs where compte_precedent = p_compte order by modifie_le desc limit 1);
    if not found then
      insert into public.formateurs (nom, compte_id)
      values (left(coalesce(nullif(btrim(coalesce(v_prenom, '') || ' ' || coalesce(v_nom, '')), ''), 'Formateur'), 80), p_compte);
    end if;
  end if;
end;
$$;

revoke execute on function public.roles_un_seul() from public, anon, authenticated;
revoke execute on function public.changer_role(uuid, public.role_etudium) from public, anon;
grant execute on function public.changer_role(uuid, public.role_etudium) to authenticated;

commit;

-- ═══ 0018_sessions_live.sql ═══
-- Étudium · migration 0018 : événements et sessions live (spec des sessions live, 14 octobre 2026).
-- À appliquer dans Supabase, après la 0017 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancé sur une base qui l'a déjà, il ne change rien et ne casse rien. Si une migration plus ancienne
-- est rejouée un jour (0016 surtout), rejouer celle-ci ensuite.
-- Aucune fonction n'accepte l'heure du client : la fenêtre du lien, les rappels et les limites de date suivent now().

begin;

-- ─── Les sessions et leurs inscriptions ─────────────────────────────────────────────────────────────
-- Fermées aux comptes : tout passe par les fonctions plus bas, qui ne livrent le lien que dans sa fenêtre.
create table if not exists public.sessions_live (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  description text not null default '',
  debut timestamptz not null,
  duree_minutes integer not null default 60,
  lien text not null,
  parcours_id uuid references public.parcours (id) on delete set null,
  -- La fiche de l'animateur ; nulle : « Équipe Étudium ».
  formateur_id uuid references public.formateurs (id) on delete set null,
  statut text not null default 'programmee',
  annulee_le timestamptz,
  cree_par uuid references public.profils (id) on delete set null,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  constraint sessions_titre_longueur check (char_length(titre) between 1 and 120),
  constraint sessions_description_longueur check (char_length(description) <= 1000),
  constraint sessions_duree check (duree_minutes between 30 and 240 and duree_minutes % 15 = 0),
  constraint sessions_lien check (lien ~ '^https://' and char_length(lien) <= 500),
  constraint sessions_statut check (statut in ('programmee', 'annulee'))
);
create index if not exists sessions_live_debut_idx on public.sessions_live (debut);
create index if not exists sessions_live_formateur_idx on public.sessions_live (formateur_id);
create index if not exists sessions_live_parcours_idx on public.sessions_live (parcours_id);
create index if not exists sessions_live_cree_par_idx on public.sessions_live (cree_par);

drop trigger if exists sessions_live_modifie_le on public.sessions_live;
create trigger sessions_live_modifie_le before update on public.sessions_live
  for each row execute function public.toucher_modifie_le();

create table if not exists public.inscriptions_sessions (
  session_id uuid not null references public.sessions_live (id) on delete cascade,
  profil_id uuid not null references public.profils (id) on delete cascade,
  inscrit_le timestamptz not null default now(),
  -- Rappels déjà créés (la veille, 1 h avant) : chacun une seule fois.
  rappel_veille_le timestamptz,
  rappel_heure_le timestamptz,
  primary key (session_id, profil_id)
);
create index if not exists inscriptions_sessions_profil_idx on public.inscriptions_sessions (profil_id);

alter table public.sessions_live enable row level security;
alter table public.inscriptions_sessions enable row level security;
revoke all on public.sessions_live from anon, authenticated;
revoke all on public.inscriptions_sessions from anon, authenticated;

-- ─── Outils ─────────────────────────────────────────────────────────────────────────────────────────
-- La plateforme, déduite du lien (qui peut être caché) : « Google Meet », « Zoom », sinon « En ligne ».
create or replace function public.plateforme_session(p_lien text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_lien ~* '^https://meet\.google\.com(/|$)' then 'Google Meet'
    when p_lien ~* '^https://([a-z0-9-]+\.)*zoom\.us(/|$)' then 'Zoom'
    else 'En ligne'
  end;
$$;

-- « samedi 24 octobre à 15 h 00 », à l'heure du Bénin (UTC+1 toute l'année). Les noms viennent de tableaux en français,
-- jamais de la langue du serveur.
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
    || ' à ' || extract(hour from t)::int || ' h ' || to_char(t, 'MI')
  from b;
$$;

create or replace function public.majuscule(p_texte text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(left(p_texte, 1)) || substr(p_texte, 2);
$$;

-- Le nom affiché de l'animateur : sa fiche, sinon « Équipe Étudium ».
create or replace function public.animateur_session(p_formateur uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select nom from public.formateurs where id = p_formateur), 'Équipe Étudium');
$$;

-- Le droit d'agir sur une session : l'équipe, ou le formateur dont la fiche anime la session.
create or replace function public.droit_session(p_formateur uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- coalesce : sans fiche (étudiant), la comparaison est « inconnue », jamais « vraie » ni ignorée.
  select public.equipe_contenus() or coalesce(p_formateur = public.ma_fiche_formateur(), false);
$$;

-- ─── notifier : une option pour les rappels ─────────────────────────────────────────────────────────
-- Un rappel est créé quand l'inscrit ouvre l'application : celui qui « agit » est alors le destinataire. Avec
-- p_auteur_inclus, il n'est pas écarté ; partout ailleurs (version à 5 paramètres), l'auteur l'est toujours.
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

  insert into public.notifications (destinataire, categorie, titre, texte, lien)
  select p.id, p_categorie, left(p_titre, 200), left(coalesce(p_texte, ''), 400), p_lien
  from public.profils p
  where p.id = any (p_destinataires)
    and (coalesce(p_auteur_inclus, false) or p.id is distinct from (select auth.uid()))
    and (p.preferences_notifications ->> 'canal_appli') is distinct from 'false'
    and (p_categorie = 'service' or (p.preferences_notifications ->> p_categorie) is distinct from 'false');
  get diagnostics v_nombre = row_count;
  return v_nombre;
end;
$$;

create or replace function public.notifier(p_destinataires uuid[], p_categorie text, p_titre text, p_texte text, p_lien text)
returns integer
language sql
security definer
set search_path = ''
as $$
  select public.notifier(p_destinataires, p_categorie, p_titre, p_texte, p_lien, false);
$$;

-- ─── Vérifier une session ───────────────────────────────────────────────────────────────────────────
-- Le début n'est revérifié que s'il change (une session en cours se modifie encore, pour corriger son lien).
create or replace function public.verifier_session(
  p_titre text,
  p_description text,
  p_debut timestamptz,
  p_duree integer,
  p_lien text,
  p_verifier_debut boolean
)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if char_length(p_titre) not between 1 and 120 then
    raise exception 'Écrivez un titre (120 caractères au plus).';
  end if;
  if char_length(p_description) > 1000 then
    raise exception 'La description dépasse 1 000 caractères.';
  end if;
  if p_debut is null or (p_verifier_debut and p_debut < now() + interval '10 minutes') then
    raise exception 'Choisissez une date au moins 10 minutes dans le futur.';
  end if;
  if p_verifier_debut and p_debut > now() + interval '1 year' then
    raise exception 'Choisissez une date dans l’année qui vient.';
  end if;
  if p_duree is null or p_duree not between 30 and 240 or p_duree % 15 <> 0 then
    raise exception 'Choisissez une durée de 30 minutes à 4 heures, par quarts d’heure.';
  end if;
  if p_lien !~ '^https://' or char_length(p_lien) > 500 or p_lien ~ '\s' then
    raise exception 'Le lien doit commencer par https://';
  end if;
end;
$$;

-- ─── Programmer, modifier, annuler ──────────────────────────────────────────────────────────────────
-- Le formateur anime toujours ses sessions ; l'équipe choisit l'animateur (une fiche, ou personne : Équipe Étudium).
create or replace function public.creer_session(
  p_titre text,
  p_description text,
  p_debut timestamptz,
  p_duree integer,
  p_lien text,
  p_parcours uuid,
  p_formateur uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_titre text := regexp_replace(coalesce(p_titre, ''), '^\s+|\s+$', '', 'g');
  v_description text := regexp_replace(coalesce(p_description, ''), '^\s+|\s+$', '', 'g');
  v_lien text := regexp_replace(coalesce(p_lien, ''), '^\s+|\s+$', '', 'g');
  v_equipe boolean := public.equipe_contenus();
  v_fiche uuid := public.ma_fiche_formateur();
  v_formateur uuid;
  v_id uuid;
begin
  if not v_equipe and v_fiche is null then
    raise exception 'Accès réservé aux formateurs et à l’équipe.' using errcode = '42501';
  end if;
  v_formateur := case when v_equipe then p_formateur else v_fiche end;
  if v_formateur is not null and not exists (select 1 from public.formateurs where id = v_formateur) then
    raise exception 'Cette fiche formateur n’existe plus.';
  end if;
  perform public.verifier_session(v_titre, v_description, p_debut, p_duree, v_lien, true);

  insert into public.sessions_live (titre, description, debut, duree_minutes, lien, parcours_id, formateur_id, cree_par)
  values (v_titre, v_description, p_debut, p_duree, v_lien, p_parcours, v_formateur, (select auth.uid()))
  returning id into v_id;

  perform public.notifier(
    array(select id from public.profils), 'sessions_live', 'Nouvelle session live : ' || v_titre,
    public.majuscule(public.quand_session(p_debut)) || ', avec ' || public.animateur_session(v_formateur) || '.', '/evenements'
  );
  return v_id;
end;
$$;

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
    update public.inscriptions_sessions set rappel_veille_le = null, rappel_heure_le = null where session_id = p_session;
  end if;
  if v_heure_changee or p_duree is distinct from v.duree_minutes or v_lien is distinct from v.lien then
    perform public.notifier(
      array(select profil_id from public.inscriptions_sessions where session_id = p_session), 'sessions_live',
      'Session live modifiée', v_titre || ' : ' || public.quand_session(p_debut) || '.', '/evenements'
    );
  end if;
end;
$$;

-- Annulée plutôt que supprimée : ses inscrits sont prévenus et la retrouvent, marquée annulée.
create or replace function public.annuler_session(p_session uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.sessions_live%rowtype;
begin
  if not public.equipe_contenus() and public.ma_fiche_formateur() is null then
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
  update public.sessions_live set statut = 'annulee', annulee_le = now() where id = p_session;
  perform public.notifier(
    array(select profil_id from public.inscriptions_sessions where session_id = p_session), 'sessions_live',
    'Session live annulée', v.titre || ', prévue ' || public.quand_session(v.debut) || '.', '/evenements'
  );
end;
$$;

-- ─── Listes et fiche, pour l'animateur et l'équipe ──────────────────────────────────────────────────
-- p_fiche nulle : toutes les sessions (équipe). À venir : pas terminées, annulées comprises ; passées : 50 au plus.
create or replace function public.liste_sessions_edition(p_fiche uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with lignes as (
    select
      s.debut,
      s.debut + make_interval(mins => s.duree_minutes) > now() as a_venir,
      jsonb_build_object(
        'id', s.id,
        'titre', s.titre,
        'debut', s.debut,
        'duree_minutes', s.duree_minutes,
        'plateforme', public.plateforme_session(s.lien),
        'statut', s.statut,
        'inscriptions', (select count(*)::int from public.inscriptions_sessions i where i.session_id = s.id),
        'parcours', (select jsonb_build_object('nom_court', p.nom_court, 'couleur', p.couleur) from public.parcours p where p.id = s.parcours_id),
        'animateur', public.animateur_session(s.formateur_id)
      ) as ligne
    from public.sessions_live s
    where p_fiche is null or s.formateur_id = p_fiche
  )
  select jsonb_build_object(
    'a_venir', coalesce((select jsonb_agg(ligne order by debut) from lignes where a_venir), '[]'::jsonb),
    'passees', coalesce(
      (select jsonb_agg(ligne order by debut desc) from (select * from lignes where not a_venir order by debut desc limit 50) passees),
      '[]'::jsonb
    )
  );
$$;

create or replace function public.sessions_animees()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_fiche uuid := public.ma_fiche_formateur();
begin
  if v_fiche is null then
    raise exception 'Accès réservé aux formateurs et à l’équipe.' using errcode = '42501';
  end if;
  return public.liste_sessions_edition(v_fiche);
end;
$$;

create or replace function public.sessions_equipe()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.equipe_contenus() then
    raise exception 'Accès réservé à l’équipe.' using errcode = '42501';
  end if;
  return public.liste_sessions_edition(null);
end;
$$;

-- La fiche d'une session : son lien et ses inscrits (prénom et nom, jamais l'adresse e-mail). Null pour qui n'est ni
-- son animateur ni l'équipe, ou pour une session inconnue.
create or replace function public.session_detail(p_session uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.sessions_live%rowtype;
begin
  select * into v from public.sessions_live where id = p_session;
  if not found or not public.droit_session(v.formateur_id) then
    return null;
  end if;
  return jsonb_build_object(
    'id', v.id,
    'titre', v.titre,
    'description', v.description,
    'debut', v.debut,
    'duree_minutes', v.duree_minutes,
    'lien', v.lien,
    'plateforme', public.plateforme_session(v.lien),
    'parcours', (select jsonb_build_object('id', p.id, 'nom_court', p.nom_court, 'couleur', p.couleur) from public.parcours p where p.id = v.parcours_id),
    'formateur_id', v.formateur_id,
    'animateur', public.animateur_session(v.formateur_id),
    'statut', v.statut,
    'annulee_le', v.annulee_le,
    'inscrits', coalesce((
      select jsonb_agg(jsonb_build_object('prenom', coalesce(p.prenom, ''), 'nom', coalesce(p.nom, '')) order by i.inscrit_le)
      from public.inscriptions_sessions i
      join public.profils p on p.id = i.profil_id
      where i.session_id = v.id
    ), '[]'::jsonb)
  );
end;
$$;

-- ─── Pour tout compte connecté ──────────────────────────────────────────────────────────────────────
-- Un visiteur n'a aucun droit d'exécution ; un compte suspendu est refusé.
create or replace function public.exiger_compte_actif()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.compte_suspendu() then
    raise exception 'Accès réservé aux comptes connectés.' using errcode = '42501';
  end if;
end;
$$;

-- « 15 h 00 », à l'heure du Bénin.
create or replace function public.heure_session(p_debut timestamptz)
returns text
language sql
immutable
set search_path = ''
as $$
  with b as (select (p_debut at time zone 'UTC') + interval '1 hour' as t)
  select extract(hour from t)::int || ' h ' || to_char(t, 'MI') from b;
$$;

-- Une carte de la page Événements. Le lien n'y est que de 10 min avant le début jusqu'à la fin, pour une session
-- programmée ; l'animateur et l'équipe l'ont toujours.
create or replace function public.carte_session(s public.sessions_live)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id,
    'titre', s.titre,
    'description', s.description,
    'debut', s.debut,
    'duree_minutes', s.duree_minutes,
    'plateforme', public.plateforme_session(s.lien),
    'lien', case
      when public.droit_session(s.formateur_id)
        or (s.statut = 'programmee'
            and now() >= s.debut - interval '10 minutes'
            and now() < s.debut + make_interval(mins => s.duree_minutes))
      then s.lien
    end,
    'parcours', (select jsonb_build_object('nom_court', p.nom_court, 'couleur', p.couleur) from public.parcours p where p.id = s.parcours_id),
    'animateur', public.animateur_session(s.formateur_id),
    'inscriptions', (select count(*)::int from public.inscriptions_sessions i where i.session_id = s.id),
    'inscrit', exists (select 1 from public.inscriptions_sessions i where i.session_id = s.id and i.profil_id = (select auth.uid())),
    'statut', s.statut
  );
$$;

-- Les trois onglets : à venir (programmées pas terminées), mes inscriptions (pas terminées, annulées comprises),
-- passées (mes inscriptions terminées et programmées, 50 au plus). Une autre vue vaut « à venir ».
create or replace function public.sessions_live(p_vue text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
begin
  perform public.exiger_compte_actif();
  if p_vue = 'inscriptions' then
    return coalesce((
      select jsonb_agg(public.carte_session(s) order by s.debut)
      from public.sessions_live s
      join public.inscriptions_sessions i on i.session_id = s.id and i.profil_id = v_moi
      where s.debut + make_interval(mins => s.duree_minutes) > now()
    ), '[]'::jsonb);
  elsif p_vue = 'passees' then
    return coalesce((
      select jsonb_agg(public.carte_session(x) order by x.debut desc)
      from (
        select s.* from public.sessions_live s
        join public.inscriptions_sessions i on i.session_id = s.id and i.profil_id = v_moi
        where s.statut = 'programmee' and s.debut + make_interval(mins => s.duree_minutes) <= now()
        order by s.debut desc
        limit 50
      ) x
    ), '[]'::jsonb);
  end if;
  return coalesce((
    select jsonb_agg(public.carte_session(x) order by x.debut)
    from (
      select s.* from public.sessions_live s
      where s.statut = 'programmee' and s.debut + make_interval(mins => s.duree_minutes) > now()
      order by s.debut
      limit 100
    ) x
  ), '[]'::jsonb);
end;
$$;

-- La carte de l'accueil : la plus proche de mes inscriptions, sinon la prochaine session ; avec les initiales des
-- 3 premiers inscrits. Null sans session à venir.
create or replace function public.prochaine_session()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.sessions_live%rowtype;
begin
  perform public.exiger_compte_actif();
  select s.* into v
  from public.sessions_live s
  join public.inscriptions_sessions i on i.session_id = s.id and i.profil_id = (select auth.uid())
  where s.statut = 'programmee' and s.debut + make_interval(mins => s.duree_minutes) > now()
  order by s.debut
  limit 1;
  if not found then
    select * into v from public.sessions_live s
    where s.statut = 'programmee' and s.debut + make_interval(mins => s.duree_minutes) > now()
    order by s.debut
    limit 1;
  end if;
  if not found then
    return null;
  end if;
  return public.carte_session(v) || jsonb_build_object('initiales', coalesce((
    select jsonb_agg(x.initiales order by x.inscrit_le)
    from (
      select upper(left(coalesce(nullif(btrim(p.prenom), ''), '?'), 1)) || upper(left(btrim(coalesce(p.nom, '')), 1)) as initiales, i.inscrit_le
      from public.inscriptions_sessions i
      join public.profils p on p.id = i.profil_id
      where i.session_id = v.id
      order by i.inscrit_le
      limit 3
    ) x
  ), '[]'::jsonb));
end;
$$;

-- S'inscrire : un rappel dont le moment est déjà passé est marqué comme envoyé (pas de rappel aussitôt).
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
  insert into public.inscriptions_sessions (session_id, profil_id, rappel_veille_le, rappel_heure_le)
  values (
    p_session,
    (select auth.uid()),
    case when now() >= v.debut - interval '24 hours' then now() end,
    case when now() >= v.debut - interval '1 hour' then now() end
  )
  on conflict do nothing;
end;
$$;

create or replace function public.se_desinscrire_session(p_session uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  if exists (select 1 from public.sessions_live where id = p_session and debut <= now()) then
    raise exception 'La session a commencé.';
  end if;
  delete from public.inscriptions_sessions where session_id = p_session and profil_id = (select auth.uid());
end;
$$;

-- Les rappels dus au compte qui demande (la cloche les demande en se chargeant) : 1 h avant, puis la veille pour
-- celles qui sont encore à plus d'1 h. Chacun une seule fois ; celui de la veille n'a plus lieu après celui d'1 h.
create or replace function public.rappels_sessions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
  v_nombre integer := 0;
  r record;
begin
  perform public.exiger_compte_actif();

  for r in
    select s.id, s.titre, s.debut
    from public.inscriptions_sessions i
    join public.sessions_live s on s.id = i.session_id
    where i.profil_id = v_moi and s.statut = 'programmee' and i.rappel_heure_le is null
      and s.debut > now() and s.debut <= now() + interval '1 hour'
  loop
    v_nombre := v_nombre + public.notifier(
      array[v_moi], 'sessions_live', 'Session live dans moins d’une heure',
      r.titre || ', à ' || public.heure_session(r.debut) || '. Le lien s’ouvre 10 min avant.', '/evenements', true
    );
    update public.inscriptions_sessions
    set rappel_heure_le = now(), rappel_veille_le = coalesce(rappel_veille_le, now())
    where session_id = r.id and profil_id = v_moi;
  end loop;

  for r in
    select s.id, s.titre, s.debut
    from public.inscriptions_sessions i
    join public.sessions_live s on s.id = i.session_id
    where i.profil_id = v_moi and s.statut = 'programmee' and i.rappel_veille_le is null and i.rappel_heure_le is null
      and s.debut > now() + interval '1 hour' and s.debut <= now() + interval '24 hours'
  loop
    v_nombre := v_nombre + public.notifier(
      array[v_moi], 'sessions_live',
      case
        when ((r.debut at time zone 'UTC') + interval '1 hour')::date = ((now() at time zone 'UTC') + interval '1 hour')::date
        then 'Session live aujourd’hui'
        else 'Session live demain'
      end,
      r.titre || ', à ' || public.heure_session(r.debut) || '.', '/evenements', true
    );
    update public.inscriptions_sessions set rappel_veille_le = now() where session_id = r.id and profil_id = v_moi;
  end loop;

  return v_nombre;
end;
$$;

-- ─── Droits d'exécution ─────────────────────────────────────────────────────────────────────────────
revoke execute on function public.exiger_compte_actif() from public, anon, authenticated;
revoke execute on function public.carte_session(public.sessions_live) from public, anon, authenticated;
revoke execute on function public.sessions_live(text) from public, anon;
revoke execute on function public.prochaine_session() from public, anon;
revoke execute on function public.sinscrire_session(uuid) from public, anon;
revoke execute on function public.se_desinscrire_session(uuid) from public, anon;
revoke execute on function public.rappels_sessions() from public, anon;
grant execute on function public.sessions_live(text) to authenticated;
grant execute on function public.prochaine_session() to authenticated;
grant execute on function public.sinscrire_session(uuid) to authenticated;
grant execute on function public.se_desinscrire_session(uuid) to authenticated;
grant execute on function public.rappels_sessions() to authenticated;
revoke execute on function public.notifier(uuid[], text, text, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.notifier(uuid[], text, text, text, text) from public, anon, authenticated;
revoke execute on function public.animateur_session(uuid) from public, anon, authenticated;
revoke execute on function public.droit_session(uuid) from public, anon, authenticated;
revoke execute on function public.verifier_session(text, text, timestamptz, integer, text, boolean) from public, anon, authenticated;
revoke execute on function public.liste_sessions_edition(uuid) from public, anon, authenticated;
revoke execute on function public.creer_session(text, text, timestamptz, integer, text, uuid, uuid) from public, anon;
revoke execute on function public.modifier_session(uuid, text, text, timestamptz, integer, text, uuid, uuid) from public, anon;
revoke execute on function public.annuler_session(uuid) from public, anon;
revoke execute on function public.sessions_animees() from public, anon;
revoke execute on function public.sessions_equipe() from public, anon;
revoke execute on function public.session_detail(uuid) from public, anon;
grant execute on function public.creer_session(text, text, timestamptz, integer, text, uuid, uuid) to authenticated;
grant execute on function public.modifier_session(uuid, text, text, timestamptz, integer, text, uuid, uuid) to authenticated;
grant execute on function public.annuler_session(uuid) to authenticated;
grant execute on function public.sessions_animees() to authenticated;
grant execute on function public.sessions_equipe() to authenticated;
grant execute on function public.session_detail(uuid) to authenticated;

commit;

-- ═══ 0019_communaute.sql ═══
-- Étudium · migration 0019 : la communauté (spec de la communauté, 14 octobre 2026).
-- À appliquer dans Supabase, après la 0018 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancé sur une base qui l'a déjà, il ne change rien et ne casse rien. Si une migration plus ancienne
-- est rejouée un jour, rejouer celle-ci ensuite.
-- Règle provisoire avant les abonnements (lot 2) : l'espace général est ouvert à tout compte ; un espace de parcours,
-- à qui suit une formation du parcours, à son formateur et à l'équipe.

begin;

-- ─── Publications ───────────────────────────────────────────────────────────────────────────────────
-- Fermées aux comptes : tout passe par les fonctions plus bas, qui appliquent peut_lire_espace.
create table if not exists public.publications (
  id uuid primary key default gen_random_uuid(),
  auteur uuid not null references public.profils (id) on delete cascade,
  -- Nul : l'espace général.
  parcours_id uuid references public.parcours (id) on delete cascade,
  titre text not null default '',
  texte text not null,
  -- {chemin, nom, type, taille} : le fichier de l'espace de stockage « communaute », ou rien.
  piece_jointe jsonb,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  modifiee boolean not null default false,
  constraint publications_titre_longueur check (char_length(titre) <= 120),
  constraint publications_texte_longueur check (char_length(texte) between 1 and 3000)
);
create index if not exists publications_fil_idx on public.publications (cree_le desc, id desc);
create index if not exists publications_parcours_idx on public.publications (parcours_id);
create index if not exists publications_auteur_idx on public.publications (auteur);
-- Un fichier n'est joint qu'à une seule publication ; l'index sert aussi aux règles du stockage.
create unique index if not exists publications_piece_idx on public.publications ((piece_jointe ->> 'chemin')) where piece_jointe is not null;

alter table public.publications enable row level security;
revoke all on public.publications from anon, authenticated;

-- Les réponses : un seul niveau, sous une publication.
create table if not exists public.commentaires_publications (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications (id) on delete cascade,
  auteur uuid not null references public.profils (id) on delete cascade,
  texte text not null,
  cree_le timestamptz not null default now(),
  constraint commentaires_texte_longueur check (char_length(texte) between 1 and 1000)
);
create index if not exists commentaires_publication_idx on public.commentaires_publications (publication_id, cree_le);
create index if not exists commentaires_auteur_idx on public.commentaires_publications (auteur);

-- « J’aime » : une fois par compte et par publication.
create table if not exists public.reactions_publications (
  publication_id uuid not null references public.publications (id) on delete cascade,
  profil_id uuid not null references public.profils (id) on delete cascade,
  cree_le timestamptz not null default now(),
  primary key (publication_id, profil_id)
);
create index if not exists reactions_profil_idx on public.reactions_publications (profil_id);

alter table public.commentaires_publications enable row level security;
alter table public.reactions_publications enable row level security;
revoke all on public.commentaires_publications from anon, authenticated;
revoke all on public.reactions_publications from anon, authenticated;

-- ─── Qui entre dans un espace ───────────────────────────────────────────────────────────────────────
-- Interne (aussi utilisée par le stockage). Jamais pour un visiteur ni un compte suspendu.
create or replace function public.peut_lire_espace(p_parcours uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and not public.compte_suspendu()
    and (
      p_parcours is null
      or public.equipe_contenus()
      or exists (
        select 1 from public.parcours pa
        where pa.id = p_parcours and pa.actif
          and (
            exists (
              select 1
              from public.formations_parcours fp
              join public.formations f on f.id = fp.formation_id
              where fp.parcours_id = pa.id and f.formateur_id is not null and f.formateur_id = public.ma_fiche_formateur()
            )
            or exists (
              select 1
              from public.progression_lecons pr
              join public.lecons l on l.id = pr.lecon_id
              join public.modules m on m.id = l.module_id
              join public.formations_parcours fp on fp.formation_id = m.formation_id
              where fp.parcours_id = pa.id and pr.profil_id = (select auth.uid())
            )
          )
      )
    );
$$;

-- Les espaces, le général d'abord, puis les parcours actifs ; « ouvert » selon le compte qui demande.
create or replace function public.espaces_communaute()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  return jsonb_build_array(
    jsonb_build_object('id', null, 'nom', 'Général', 'nom_court', 'Général', 'couleur', null, 'slug', null, 'ouvert', true)
  ) || coalesce((
    select jsonb_agg(
      jsonb_build_object('id', pa.id, 'nom', pa.nom, 'nom_court', pa.nom_court, 'couleur', pa.couleur, 'slug', pa.slug, 'ouvert', public.peut_lire_espace(pa.id))
      order by pa.ordre, pa.nom
    )
    from public.parcours pa
    where pa.actif
  ), '[]'::jsonb);
end;
$$;

-- ─── Une publication, telle que la voit le compte qui demande ───────────────────────────────────────
-- Jamais d'adresse e-mail : prénom et nom de l'auteur, et son rôle (formateur, équipe).
create or replace function public.role_communaute(p_profil uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.roles where profil_id = p_profil and role in ('moderateur', 'admin', 'super_admin')) then 'equipe'
    when exists (select 1 from public.roles where profil_id = p_profil and role = 'formateur') then 'formateur'
  end;
$$;

-- Une réponse : « Prénom N. », jamais l'adresse e-mail.
create or replace function public.carte_reponse(c public.commentaires_publications)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'auteur', jsonb_build_object('prenom', coalesce(pr.prenom, ''), 'nom_court', public.nom_avis(pr.prenom, pr.nom)),
    'est_moi', c.auteur = (select auth.uid()),
    'texte', c.texte,
    'cree_le', c.cree_le,
    'peut_supprimer', c.auteur = (select auth.uid()) or public.equipe_contenus()
  )
  from public.profils pr
  where pr.id = c.auteur;
$$;

create or replace function public.carte_publication(p public.publications)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'auteur', jsonb_build_object('prenom', coalesce(pr.prenom, ''), 'nom', coalesce(pr.nom, ''), 'role', public.role_communaute(p.auteur)),
    'est_moi', p.auteur = (select auth.uid()),
    'espace', jsonb_build_object('id', p.parcours_id, 'nom', coalesce((select pa.nom_court from public.parcours pa where pa.id = p.parcours_id), 'général')),
    'titre', p.titre,
    'texte', p.texte,
    'piece_jointe', p.piece_jointe,
    'cree_le', p.cree_le,
    'modifiee', p.modifiee,
    'reactions', (select count(*)::int from public.reactions_publications r where r.publication_id = p.id),
    'j_aime', exists (select 1 from public.reactions_publications r where r.publication_id = p.id and r.profil_id = (select auth.uid())),
    'reponses', (select count(*)::int from public.commentaires_publications c where c.publication_id = p.id),
    'dernieres_reponses', coalesce((
      select jsonb_agg(public.carte_reponse(d) order by d.cree_le, d.id)
      from (
        select c.* from public.commentaires_publications c
        where c.publication_id = p.id
        order by c.cree_le desc, c.id desc
        limit 2
      ) d
    ), '[]'::jsonb),
    'peut_supprimer', p.auteur = (select auth.uid()) or public.equipe_contenus()
  )
  from public.profils pr
  where pr.id = p.auteur;
$$;

-- Le fil : « tous » (les espaces ouverts au compte) ou l'id d'un parcours (vide s'il est fermé). Curseur (cree_le, id).
create or replace function public.fil_communaute(
  p_espace text,
  p_avant timestamptz default null,
  p_avant_id uuid default null,
  p_nombre integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_nombre integer := least(greatest(coalesce(p_nombre, 20), 1), 50);
  v_parcours uuid;
  v_lignes jsonb;
  v_total integer;
begin
  perform public.exiger_compte_actif();
  if p_espace is distinct from 'tous' then
    begin
      v_parcours := p_espace::uuid;
    exception when invalid_text_representation then
      return jsonb_build_object('publications', '[]'::jsonb, 'suite', false);
    end;
    if not public.peut_lire_espace(v_parcours) then
      return jsonb_build_object('publications', '[]'::jsonb, 'suite', false);
    end if;
  end if;

  with lot as (
    select p.id, row_number() over (order by p.cree_le desc, p.id desc) as rang
    from public.publications p
    where (case when p_espace = 'tous' then public.peut_lire_espace(p.parcours_id) else p.parcours_id = v_parcours end)
      and (p_avant is null or (p.cree_le, p.id) < (p_avant, coalesce(p_avant_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
    order by p.cree_le desc, p.id desc
    limit v_nombre + 1
  )
  select
    coalesce(jsonb_agg(public.carte_publication(p) order by p.cree_le desc, p.id desc) filter (where lot.rang <= v_nombre), '[]'::jsonb),
    count(*)::integer
  into v_lignes, v_total
  from lot
  join public.publications p on p.id = lot.id;

  return jsonb_build_object('publications', v_lignes, 'suite', v_total > v_nombre);
end;
$$;

-- Une publication et toutes ses réponses (page d'une publication) ; null si inconnue ou fermée.
create or replace function public.publication_communaute(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.publications%rowtype;
begin
  perform public.exiger_compte_actif();
  select * into v from public.publications where id = p_id;
  if not found or not public.peut_lire_espace(v.parcours_id) then
    return null;
  end if;
  return public.carte_publication(v) || jsonb_build_object('toutes_reponses', coalesce((
    select jsonb_agg(public.carte_reponse(c) order by c.cree_le, c.id)
    from public.commentaires_publications c
    where c.publication_id = v.id
  ), '[]'::jsonb));
end;
$$;

-- ─── Publier, modifier, supprimer ───────────────────────────────────────────────────────────────────
-- La pièce jointe doit être un fichier déposé par le compte, dans son dossier de l'espace « communaute ».
create or replace function public.verifier_piece(p_piece jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_chemin text := p_piece ->> 'chemin';
  v_type text := p_piece ->> 'type';
  v_taille bigint;
begin
  if p_piece is null or jsonb_typeof(p_piece) = 'null' then
    return null;
  end if;
  begin
    v_taille := (p_piece ->> 'taille')::bigint;
  exception when others then
    v_taille := null;
  end;
  if v_chemin is null or v_chemin ~ '\.\.'
     or (storage.foldername(v_chemin))[1] is distinct from (select auth.uid())::text
     or not exists (select 1 from storage.objects o where o.bucket_id = 'communaute' and o.name = v_chemin)
     or exists (select 1 from public.publications p where p.piece_jointe ->> 'chemin' = v_chemin)
     or v_type is null or v_type not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
     or v_taille is null or v_taille < 1 or v_taille > 10485760 then
    raise exception 'Ce fichier n’est pas le vôtre.';
  end if;
  return jsonb_build_object('chemin', v_chemin, 'nom', left(coalesce(nullif(btrim(p_piece ->> 'nom'), ''), 'fichier'), 200), 'type', v_type, 'taille', v_taille);
end;
$$;

create or replace function public.publier(p_parcours uuid, p_titre text, p_texte text, p_piece jsonb default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_titre text := regexp_replace(coalesce(p_titre, ''), '^\s+|\s+$', '', 'g');
  v_texte text := regexp_replace(coalesce(p_texte, ''), '^\s+|\s+$', '', 'g');
  v_id uuid;
begin
  perform public.exiger_compte_actif();
  if not public.peut_lire_espace(p_parcours) then
    raise exception 'Cet espace ne vous est pas ouvert.' using errcode = '42501';
  end if;
  if char_length(v_texte) not between 1 and 3000 then
    raise exception 'Écrivez votre publication (3 000 caractères au plus).';
  end if;
  if char_length(v_titre) > 120 then
    raise exception 'Le titre dépasse 120 caractères.';
  end if;
  insert into public.publications (auteur, parcours_id, titre, texte, piece_jointe)
  values ((select auth.uid()), p_parcours, v_titre, v_texte, public.verifier_piece(p_piece))
  returning id into v_id;
  return v_id;
end;
$$;

-- Son auteur seulement ; le titre et le texte (une pièce jointe ne se remplace pas).
create or replace function public.modifier_publication(p_id uuid, p_titre text, p_texte text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.publications%rowtype;
  v_titre text := regexp_replace(coalesce(p_titre, ''), '^\s+|\s+$', '', 'g');
  v_texte text := regexp_replace(coalesce(p_texte, ''), '^\s+|\s+$', '', 'g');
begin
  perform public.exiger_compte_actif();
  select * into v from public.publications where id = p_id for update;
  if not found or not public.peut_lire_espace(v.parcours_id) then
    raise exception 'Cette publication n’existe plus.';
  end if;
  if v.auteur <> (select auth.uid()) then
    raise exception 'Cette publication n’est pas la vôtre.' using errcode = '42501';
  end if;
  if char_length(v_texte) not between 1 and 3000 then
    raise exception 'Écrivez votre publication (3 000 caractères au plus).';
  end if;
  if char_length(v_titre) > 120 then
    raise exception 'Le titre dépasse 120 caractères.';
  end if;
  update public.publications set titre = v_titre, texte = v_texte, modifiee = true, modifie_le = now() where id = p_id;
end;
$$;

-- Son auteur, ou l'équipe ; ses réponses et réactions partent avec elle. Rend le chemin du fichier à retirer du stockage.
create or replace function public.supprimer_publication(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.publications%rowtype;
begin
  perform public.exiger_compte_actif();
  select * into v from public.publications where id = p_id for update;
  if not found or not public.peut_lire_espace(v.parcours_id) then
    raise exception 'Cette publication n’existe plus.';
  end if;
  if v.auteur <> (select auth.uid()) and not public.equipe_contenus() then
    raise exception 'Cette publication n’est pas la vôtre.' using errcode = '42501';
  end if;
  delete from public.publications where id = p_id;
  return v.piece_jointe ->> 'chemin';
end;
$$;

-- ─── Répondre, aimer ────────────────────────────────────────────────────────────────────────────────
-- La publication d'un espace ouvert au compte ; sinon le refus qui convient.
create or replace function public.publication_ouverte(p_id uuid)
returns public.publications
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.publications%rowtype;
begin
  perform public.exiger_compte_actif();
  select * into v from public.publications where id = p_id;
  if not found then
    raise exception 'Cette publication n’existe plus.';
  end if;
  if not public.peut_lire_espace(v.parcours_id) then
    raise exception 'Cet espace ne vous est pas ouvert.' using errcode = '42501';
  end if;
  return v;
end;
$$;

-- Répondre ; l'auteur de la publication est prévenu (catégorie Communauté), jamais soi-même.
create or replace function public.commenter(p_publication uuid, p_texte text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.publications%rowtype := public.publication_ouverte(p_publication);
  v_texte text := regexp_replace(coalesce(p_texte, ''), '^\s+|\s+$', '', 'g');
  v_id uuid;
  v_nom text;
begin
  if char_length(v_texte) not between 1 and 1000 then
    raise exception 'Écrivez votre réponse (1 000 caractères au plus).';
  end if;
  insert into public.commentaires_publications (publication_id, auteur, texte)
  values (p_publication, (select auth.uid()), v_texte)
  returning id into v_id;
  select public.nom_avis(prenom, nom) into v_nom from public.profils where id = (select auth.uid());
  perform public.notifier(
    array[v.auteur], 'communaute', 'Nouvelle réponse',
    v_nom || ' a répondu à votre publication dans l’espace '
      || coalesce((select pa.nom_court from public.parcours pa where pa.id = v.parcours_id), 'général') || '.',
    '/communaute/publications/' || v.id
  );
  return v_id;
end;
$$;

-- Son auteur, ou l'équipe.
create or replace function public.supprimer_commentaire(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.commentaires_publications%rowtype;
begin
  perform public.exiger_compte_actif();
  select * into v from public.commentaires_publications where id = p_id;
  if not found then
    return;
  end if;
  perform public.publication_ouverte(v.publication_id);
  if v.auteur <> (select auth.uid()) and not public.equipe_contenus() then
    raise exception 'Cette réponse n’est pas la vôtre.' using errcode = '42501';
  end if;
  delete from public.commentaires_publications where id = p_id;
end;
$$;

-- « J’aime » : le premier clic l'ajoute, le second le retire. Rend l'état et le nombre.
create or replace function public.basculer_reaction(p_publication uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
  v_aime boolean;
begin
  perform public.publication_ouverte(p_publication);
  delete from public.reactions_publications where publication_id = p_publication and profil_id = v_moi;
  if found then
    v_aime := false;
  else
    insert into public.reactions_publications (publication_id, profil_id) values (p_publication, v_moi) on conflict do nothing;
    v_aime := true;
  end if;
  return jsonb_build_object(
    'j_aime', v_aime,
    'reactions', (select count(*)::int from public.reactions_publications where publication_id = p_publication)
  );
end;
$$;

-- Les 3 comptes qui ont le plus publié et répondu en 7 jours, dans les espaces ouverts au compte qui demande, avec
-- l'espace où ils ont le plus écrit.
create or replace function public.membres_actifs()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  return coalesce((
    with ecrits as (
      select p.auteur, p.parcours_id, p.cree_le
      from public.publications p
      where p.cree_le > now() - interval '7 days' and public.peut_lire_espace(p.parcours_id)
      union all
      select c.auteur, p.parcours_id, c.cree_le
      from public.commentaires_publications c
      join public.publications p on p.id = c.publication_id
      where c.cree_le > now() - interval '7 days' and public.peut_lire_espace(p.parcours_id)
    ),
    par_espace as (
      select auteur, parcours_id,
             row_number() over (partition by auteur order by count(*) desc, max(cree_le) desc) as rang
      from ecrits
      group by auteur, parcours_id
    ),
    totaux as (
      select auteur, count(*) as n, max(cree_le) as dernier from ecrits group by auteur
    ),
    premiers as (
      select t.auteur, t.n, t.dernier from totaux t order by t.n desc, t.dernier desc limit 3
    )
    select jsonb_agg(
      jsonb_build_object(
        'prenom', coalesce(pr.prenom, ''),
        'nom_court', public.nom_avis(pr.prenom, pr.nom),
        'initiales', public.initiales_avis(pr.prenom, pr.nom),
        'espace', coalesce((select pa.nom_court from public.parcours pa where pa.id = e.parcours_id), 'Général')
      )
      order by pm.n desc, pm.dernier desc
    )
    from premiers pm
    join public.profils pr on pr.id = pm.auteur
    join par_espace e on e.auteur = pm.auteur and e.rang = 1
  ), '[]'::jsonb);
end;
$$;

-- ─── Fichiers joints : l'espace de stockage « communaute » ──────────────────────────────────────────
-- Un fichier se lit si une publication lisible par le compte l'attache (la règle du stockage s'exécute avec les droits
-- du compte, qui ne lit pas la table : cette fonction le fait pour elle).
create or replace function public.fichier_communaute_lisible(p_nom text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.publications p
    where p.piece_jointe ->> 'chemin' = p_nom and public.peut_lire_espace(p.parcours_id)
  );
$$;

-- Un fichier joint à une publication : son auteur ne peut plus le retirer (ni donc le remplacer) tant qu'elle existe.
create or replace function public.fichier_communaute_attache(p_nom text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.publications p where p.piece_jointe ->> 'chemin' = p_nom);
$$;

-- Privé, 10 Mo, images et PDF. Chacun dépose dans son dossier (« <compte>/… ») ; on lit un fichier si une publication
-- lisible l'attache, si c'est le sien, ou pour l'équipe ; on supprime le sien tant qu'aucune publication ne l'attache
-- (un fichier publié ne se remplace pas), et l'équipe tout. Supprimer demande aussi de pouvoir lire : l'équipe lit tout.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('communaute', 'communaute', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "communaute : déposer dans son dossier" on storage.objects;
create policy "communaute : déposer dans son dossier" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'communaute'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not (select public.compte_suspendu())
  );

drop policy if exists "communaute : lire" on storage.objects;
create policy "communaute : lire" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'communaute'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.fichier_communaute_lisible(objects.name))
      or (select public.equipe_contenus())
    )
  );

drop policy if exists "communaute : supprimer" on storage.objects;
create policy "communaute : supprimer" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'communaute'
    and (
      ((storage.foldername(name))[1] = (select auth.uid())::text and not (select public.fichier_communaute_attache(objects.name)))
      or (select public.equipe_contenus())
    )
  );

-- ─── Droits d'exécution ─────────────────────────────────────────────────────────────────────────────
revoke execute on function public.peut_lire_espace(uuid) from public, anon;
grant execute on function public.peut_lire_espace(uuid) to authenticated;
revoke execute on function public.role_communaute(uuid) from public, anon, authenticated;
revoke execute on function public.carte_publication(public.publications) from public, anon, authenticated;
revoke execute on function public.verifier_piece(jsonb) from public, anon, authenticated;
revoke execute on function public.carte_reponse(public.commentaires_publications) from public, anon, authenticated;
revoke execute on function public.publication_ouverte(uuid) from public, anon, authenticated;
revoke execute on function public.commenter(uuid, text) from public, anon;
revoke execute on function public.supprimer_commentaire(uuid) from public, anon;
revoke execute on function public.basculer_reaction(uuid) from public, anon;
revoke execute on function public.membres_actifs() from public, anon;
grant execute on function public.commenter(uuid, text) to authenticated;
grant execute on function public.supprimer_commentaire(uuid) to authenticated;
grant execute on function public.basculer_reaction(uuid) to authenticated;
grant execute on function public.membres_actifs() to authenticated;
revoke execute on function public.fichier_communaute_lisible(text) from public, anon;
grant execute on function public.fichier_communaute_lisible(text) to authenticated;
revoke execute on function public.fichier_communaute_attache(text) from public, anon;
grant execute on function public.fichier_communaute_attache(text) to authenticated;
revoke execute on function public.espaces_communaute() from public, anon;
revoke execute on function public.fil_communaute(text, timestamptz, uuid, integer) from public, anon;
revoke execute on function public.publication_communaute(uuid) from public, anon;
revoke execute on function public.publier(uuid, text, text, jsonb) from public, anon;
revoke execute on function public.modifier_publication(uuid, text, text) from public, anon;
revoke execute on function public.supprimer_publication(uuid) from public, anon;
grant execute on function public.espaces_communaute() to authenticated;
grant execute on function public.fil_communaute(text, timestamptz, uuid, integer) to authenticated;
grant execute on function public.publication_communaute(uuid) to authenticated;
grant execute on function public.publier(uuid, text, text, jsonb) to authenticated;
grant execute on function public.modifier_publication(uuid, text, text) to authenticated;
grant execute on function public.supprimer_publication(uuid) to authenticated;

commit;

-- ═══ 0020_moderation.sql ═══
-- Étudium · migration 0020 : la modération (spec de la modération, 14 octobre 2026).
-- À appliquer dans Supabase, après la 0019 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancé sur une base qui l'a déjà, il ne change rien et ne casse rien (le jeton est conservé). Si la 0019
-- est rejouée un jour, rejouer celle-ci ensuite.
-- L'analyse automatique se fait sur le serveur de l'application, qui transmet le verdict avec le jeton de modération :
-- la base n'applique qu'un verdict qui le porte. Analyse active, une publication sans verdict valide attend l'équipe.

begin;

-- ─── Publications : statut et verdict de l'analyse ───────────────────────────────────────────────────────────────
-- « publiee » (en ligne), « en_attente » (vue par son auteur et l'équipe), « bloquee » (vue par l'équipe seule).
alter table public.publications add column if not exists statut text not null default 'publiee';
alter table public.publications add column if not exists verdict jsonb;
-- Signalée par l'analyse, ou analyse impossible : dans la file de l'équipe.
alter table public.publications add column if not exists a_examiner boolean not null default false;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'publications_statut_valeurs') then
    alter table public.publications add constraint publications_statut_valeurs check (statut in ('publiee', 'en_attente', 'bloquee'));
  end if;
end;
$$;
create index if not exists publications_moderation_idx on public.publications (cree_le) where statut <> 'publiee' or a_examiner;
create index if not exists publications_auteur_recent_idx on public.publications (auteur, cree_le);
create index if not exists commentaires_auteur_recent_idx on public.commentaires_publications (auteur, cree_le);

-- ─── Réglages : le jeton et l'analyse active ────────────────────────────────────────────────────────
-- Une seule ligne, fermée à tous : seules les fonctions plus bas la lisent. L'utilisateur lit le jeton dans l'éditeur
-- SQL (select jeton from public.reglages_moderation;) et le recopie dans web/.env.local (MODERATION_JETON).
create table if not exists public.reglages_moderation (
  id boolean primary key default true check (id),
  jeton text not null,
  analyse_active boolean not null default false,
  derniere_analyse timestamptz
);
alter table public.reglages_moderation enable row level security;
revoke all on public.reglages_moderation from anon, authenticated;
insert into public.reglages_moderation (id, jeton)
values (true, replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
on conflict (id) do nothing;

-- Chaque analyse demandée à l'IA (avant de publier ou de modifier) : 10 au plus par compte en 10 minutes, même si les
-- publications sont supprimées ensuite. Le coût de l'IA reste borné.
create table if not exists public.journal_moderation (
  id bigint generated always as identity primary key,
  profil_id uuid not null references public.profils (id) on delete cascade,
  cree_le timestamptz not null default now()
);
create index if not exists journal_moderation_idx on public.journal_moderation (profil_id, cree_le);
alter table public.journal_moderation enable row level security;
revoke all on public.journal_moderation from anon, authenticated;

create or replace function public.moderation_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select analyse_active from public.reglages_moderation where id), false);
$$;

create or replace function public.exiger_equipe_moderation()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  if not public.equipe_contenus() then
    raise exception 'Réservé à l’équipe.' using errcode = '42501';
  end if;
end;
$$;

-- L'état de l'analyse pour le back-office ; « jeton_reconnu » dit si le jeton du serveur est le bon (nul sans jeton).
create or replace function public.etat_moderation(p_jeton text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.reglages_moderation%rowtype;
begin
  perform public.exiger_equipe_moderation();
  select * into r from public.reglages_moderation where id;
  return jsonb_build_object(
    'active', coalesce(r.analyse_active, false),
    'jeton_reconnu', case when coalesce(p_jeton, '') = '' then null else p_jeton = r.jeton end,
    'derniere_analyse', r.derniere_analyse,
    'en_attente', (select count(*)::int from public.publications where statut = 'en_attente')
  );
end;
$$;

-- Activer demande le jeton du serveur : la preuve que l'application saura analyser.
create or replace function public.regler_analyse(p_active boolean, p_jeton text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_equipe_moderation();
  if coalesce(p_active, false) and (coalesce(p_jeton, '') = '' or p_jeton is distinct from (select jeton from public.reglages_moderation where id)) then
    raise exception 'Le jeton de modération n’est pas reconnu.';
  end if;
  update public.reglages_moderation set analyse_active = coalesce(p_active, false) where id;
end;
$$;

-- Un verdict porte le bon jeton et une décision connue.
create or replace function public.verdict_valide(p_analyse jsonb)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_analyse is not null
    and jsonb_typeof(p_analyse) = 'object'
    and coalesce(p_analyse ->> 'jeton', '') <> ''
    and p_analyse ->> 'jeton' = (select jeton from public.reglages_moderation where id)
    and p_analyse ->> 'decision' in ('autoriser', 'signaler', 'bloquer', 'echec');
$$;

-- Ce que la base garde d'un verdict (sans le jeton).
create or replace function public.analyse_retenue(p_analyse jsonb)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'decision', p_analyse ->> 'decision',
    'categorie', case
      when p_analyse ->> 'categorie' in ('spam', 'harcelement', 'haine', 'sexuel', 'arnaque', 'hameconnage', 'publicite', 'illegal', 'hors_sujet', 'autre', 'aucune')
        then p_analyse ->> 'categorie'
      else 'autre'
    end,
    'raison', left(coalesce(p_analyse ->> 'raison', ''), 300),
    'le', now()
  );
$$;

-- « général » ou le nom court du parcours.
create or replace function public.nom_espace_communaute(p_parcours uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select pa.nom_court from public.parcours pa where pa.id = p_parcours), 'général');
$$;

-- « À modérer » à toute l'équipe (catégorie service : toujours envoyée).
create or replace function public.prevenir_equipe(p_texte text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notifier(
    array(select distinct r.profil_id from public.roles r where r.role in ('moderateur', 'admin', 'super_admin')),
    'service', 'À modérer', p_texte, '/admin/moderation'
  );
end;
$$;

-- Au plus 5 publications ou 30 réponses par compte toutes les 10 minutes.
create or replace function public.limiter_debit(p_reponses boolean)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_nombre integer;
  v_limite integer := 5;
begin
  if p_reponses then
    v_limite := 30;
    select count(*) into v_nombre from public.commentaires_publications
    where auteur = (select auth.uid()) and cree_le > now() - interval '10 minutes';
  else
    select count(*) into v_nombre from public.publications
    where auteur = (select auth.uid()) and cree_le > now() - interval '10 minutes';
  end if;
  if v_nombre >= v_limite then
    raise exception 'Vous publiez beaucoup en peu de temps. Réessayez dans quelques minutes.';
  end if;
end;
$$;

-- Visible du compte qui demande : en ligne, ou la sienne en attente.
create or replace function public.publication_visible(p public.publications)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p.statut = 'publiee' or (p.statut = 'en_attente' and p.auteur = (select auth.uid()));
$$;

-- ─── Les cartes : statut et « Signaler » ────────────────────────────────────────────────────────────
create or replace function public.carte_reponse(c public.commentaires_publications)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'auteur', jsonb_build_object('prenom', coalesce(pr.prenom, ''), 'nom_court', public.nom_avis(pr.prenom, pr.nom)),
    'est_moi', c.auteur = (select auth.uid()),
    'texte', c.texte,
    'cree_le', c.cree_le,
    'peut_supprimer', c.auteur = (select auth.uid()) or public.equipe_contenus(),
    'peut_signaler', c.auteur <> (select auth.uid()) and not public.equipe_contenus()
  )
  from public.profils pr
  where pr.id = c.auteur;
$$;

create or replace function public.carte_publication(p public.publications)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'auteur', jsonb_build_object('prenom', coalesce(pr.prenom, ''), 'nom', coalesce(pr.nom, ''), 'role', public.role_communaute(p.auteur)),
    'est_moi', p.auteur = (select auth.uid()),
    'espace', jsonb_build_object('id', p.parcours_id, 'nom', public.nom_espace_communaute(p.parcours_id)),
    'titre', p.titre,
    'texte', p.texte,
    'piece_jointe', p.piece_jointe,
    'cree_le', p.cree_le,
    'modifiee', p.modifiee,
    'statut', p.statut,
    'reactions', (select count(*)::int from public.reactions_publications r where r.publication_id = p.id),
    'j_aime', exists (select 1 from public.reactions_publications r where r.publication_id = p.id and r.profil_id = (select auth.uid())),
    'reponses', (select count(*)::int from public.commentaires_publications c where c.publication_id = p.id),
    'dernieres_reponses', coalesce((
      select jsonb_agg(public.carte_reponse(d) order by d.cree_le, d.id)
      from (
        select c.* from public.commentaires_publications c
        where c.publication_id = p.id
        order by c.cree_le desc, c.id desc
        limit 2
      ) d
    ), '[]'::jsonb),
    'peut_supprimer', p.auteur = (select auth.uid()) or public.equipe_contenus(),
    'peut_signaler', p.statut = 'publiee' and p.auteur <> (select auth.uid()) and not public.equipe_contenus()
  )
  from public.profils pr
  where pr.id = p.auteur;
$$;

-- ─── Lectures : seulement les publications visibles ─────────────────────────────────────────────────
create or replace function public.fil_communaute(
  p_espace text,
  p_avant timestamptz default null,
  p_avant_id uuid default null,
  p_nombre integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_nombre integer := least(greatest(coalesce(p_nombre, 20), 1), 50);
  v_parcours uuid;
  v_lignes jsonb;
  v_total integer;
begin
  perform public.exiger_compte_actif();
  if p_espace is distinct from 'tous' then
    begin
      v_parcours := p_espace::uuid;
    exception when invalid_text_representation then
      return jsonb_build_object('publications', '[]'::jsonb, 'suite', false);
    end;
    if not public.peut_lire_espace(v_parcours) then
      return jsonb_build_object('publications', '[]'::jsonb, 'suite', false);
    end if;
  end if;

  with lot as (
    select p.id, row_number() over (order by p.cree_le desc, p.id desc) as rang
    from public.publications p
    where (case when p_espace = 'tous' then public.peut_lire_espace(p.parcours_id) else p.parcours_id = v_parcours end)
      and public.publication_visible(p)
      and (p_avant is null or (p.cree_le, p.id) < (p_avant, coalesce(p_avant_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
    order by p.cree_le desc, p.id desc
    limit v_nombre + 1
  )
  select
    coalesce(jsonb_agg(public.carte_publication(p) order by p.cree_le desc, p.id desc) filter (where lot.rang <= v_nombre), '[]'::jsonb),
    count(*)::integer
  into v_lignes, v_total
  from lot
  join public.publications p on p.id = lot.id;

  return jsonb_build_object('publications', v_lignes, 'suite', v_total > v_nombre);
end;
$$;

-- La page d'une publication : visible, ou pour l'équipe quel que soit son statut (depuis la file).
create or replace function public.publication_communaute(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.publications%rowtype;
begin
  perform public.exiger_compte_actif();
  select * into v from public.publications where id = p_id;
  if not found or not public.peut_lire_espace(v.parcours_id) or not (public.publication_visible(v) or public.equipe_contenus()) then
    return null;
  end if;
  return public.carte_publication(v) || jsonb_build_object('toutes_reponses', coalesce((
    select jsonb_agg(public.carte_reponse(c) order by c.cree_le, c.id)
    from public.commentaires_publications c
    where c.publication_id = v.id
  ), '[]'::jsonb));
end;
$$;

-- Répondre, aimer, supprimer une réponse : une publication en ligne (l'équipe, toutes).
create or replace function public.publication_ouverte(p_id uuid)
returns public.publications
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.publications%rowtype;
begin
  perform public.exiger_compte_actif();
  select * into v from public.publications where id = p_id;
  if not found then
    raise exception 'Cette publication n’existe plus.';
  end if;
  if not public.peut_lire_espace(v.parcours_id) then
    raise exception 'Cet espace ne vous est pas ouvert.' using errcode = '42501';
  end if;
  if v.statut <> 'publiee' and not public.equipe_contenus() then
    if v.statut = 'en_attente' and v.auteur = (select auth.uid()) then
      raise exception 'Cette publication attend sa vérification.';
    end if;
    raise exception 'Cette publication n’existe plus.';
  end if;
  return v;
end;
$$;

create or replace function public.membres_actifs()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  return coalesce((
    with ecrits as (
      select p.auteur, p.parcours_id, p.cree_le
      from public.publications p
      where p.cree_le > now() - interval '7 days' and p.statut = 'publiee' and public.peut_lire_espace(p.parcours_id)
      union all
      select c.auteur, p.parcours_id, c.cree_le
      from public.commentaires_publications c
      join public.publications p on p.id = c.publication_id
      where c.cree_le > now() - interval '7 days' and p.statut = 'publiee' and public.peut_lire_espace(p.parcours_id)
    ),
    par_espace as (
      select auteur, parcours_id,
             row_number() over (partition by auteur order by count(*) desc, max(cree_le) desc) as rang
      from ecrits
      group by auteur, parcours_id
    ),
    totaux as (
      select auteur, count(*) as n, max(cree_le) as dernier from ecrits group by auteur
    ),
    premiers as (
      select t.auteur, t.n, t.dernier from totaux t order by t.n desc, t.dernier desc limit 3
    )
    select jsonb_agg(
      jsonb_build_object(
        'prenom', coalesce(pr.prenom, ''),
        'nom_court', public.nom_avis(pr.prenom, pr.nom),
        'initiales', public.initiales_avis(pr.prenom, pr.nom),
        'espace', coalesce((select pa.nom_court from public.parcours pa where pa.id = e.parcours_id), 'Général')
      )
      order by pm.n desc, pm.dernier desc
    )
    from premiers pm
    join public.profils pr on pr.id = pm.auteur
    join par_espace e on e.auteur = pm.auteur and e.rang = 1
  ), '[]'::jsonb);
end;
$$;

-- Un fichier se lit si une publication en ligne, d'un espace ouvert au compte, l'attache.
create or replace function public.fichier_communaute_lisible(p_nom text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.publications p
    where p.piece_jointe ->> 'chemin' = p_nom and p.statut = 'publiee' and public.peut_lire_espace(p.parcours_id)
  );
$$;

-- ─── Publier, modifier : le verdict, la limite de débit ─────────────────────────────────────────────
-- Le type et la taille sont ceux que le stockage a enregistrés, pas ceux qu'annonce le navigateur.
create or replace function public.verifier_piece(p_piece jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_chemin text := p_piece ->> 'chemin';
  v_type text := p_piece ->> 'type';
  v_taille bigint;
begin
  if p_piece is null or jsonb_typeof(p_piece) = 'null' then
    return null;
  end if;
  begin
    v_taille := (p_piece ->> 'taille')::bigint;
  exception when others then
    v_taille := null;
  end;
  if v_chemin is null or v_chemin ~ '\.\.'
     or (storage.foldername(v_chemin))[1] is distinct from (select auth.uid())::text
     or v_type is null or v_type not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
     or v_taille is null or v_taille < 1 or v_taille > 10485760
     or not exists (
       select 1 from storage.objects o
       where o.bucket_id = 'communaute' and o.name = v_chemin
         and o.metadata ->> 'mimetype' = v_type and o.metadata ->> 'size' = v_taille::text
     )
     or exists (select 1 from public.publications p where p.piece_jointe ->> 'chemin' = v_chemin) then
    raise exception 'Ce fichier n’est pas le vôtre.';
  end if;
  return jsonb_build_object('chemin', v_chemin, 'nom', left(coalesce(nullif(btrim(p_piece ->> 'nom'), ''), 'fichier'), 200), 'type', v_type, 'taille', v_taille);
end;
$$;

drop function if exists public.publier(uuid, text, text, jsonb);
create or replace function public.publier(p_parcours uuid, p_titre text, p_texte text, p_piece jsonb default null, p_analyse jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_titre text := regexp_replace(coalesce(p_titre, ''), '^\s+|\s+$', '', 'g');
  v_texte text := regexp_replace(coalesce(p_texte, ''), '^\s+|\s+$', '', 'g');
  v_statut text := 'publiee';
  v_examen boolean := false;
  v_analyse jsonb;
  v_id uuid;
begin
  perform public.exiger_compte_actif();
  if not public.peut_lire_espace(p_parcours) then
    raise exception 'Cet espace ne vous est pas ouvert.' using errcode = '42501';
  end if;
  if char_length(v_texte) not between 1 and 3000 then
    raise exception 'Écrivez votre publication (3 000 caractères au plus).';
  end if;
  if char_length(v_titre) > 120 then
    raise exception 'Le titre dépasse 120 caractères.';
  end if;
  perform public.limiter_debit(false);
  if public.verdict_valide(p_analyse) then
    -- Le fichier analysé ne doit pas avoir été remplacé entre l'analyse et la publication.
    if p_piece is not null and jsonb_typeof(p_piece) <> 'null' and (
      coalesce(p_analyse ->> 'objet', '') = ''
      or not exists (
        select 1 from storage.objects o
        where o.bucket_id = 'communaute' and o.name = p_piece ->> 'chemin' and o.id::text = p_analyse ->> 'objet'
      )
    ) then
      raise exception 'Ce fichier a changé pendant la vérification. Publiez-le de nouveau.';
    end if;
    v_analyse := public.analyse_retenue(p_analyse);
    v_statut := case when v_analyse ->> 'decision' = 'bloquer' then 'bloquee' else 'publiee' end;
    v_examen := v_analyse ->> 'decision' in ('signaler', 'echec');
    update public.reglages_moderation set derniere_analyse = now() where id;
  elsif public.moderation_active() then
    v_statut := 'en_attente';
  end if;
  insert into public.publications (auteur, parcours_id, titre, texte, piece_jointe, statut, verdict, a_examiner)
  values ((select auth.uid()), p_parcours, v_titre, v_texte, public.verifier_piece(p_piece), v_statut, v_analyse, v_examen)
  returning id into v_id;
  if v_examen or v_statut = 'en_attente' then
    perform public.prevenir_equipe('Une publication de l’espace ' || public.nom_espace_communaute(p_parcours) || ' attend votre examen.');
  end if;
  return jsonb_build_object('id', v_id, 'statut', v_statut, 'categorie', v_analyse ->> 'categorie');
end;
$$;

-- Son auteur seulement ; le titre et le texte sont réanalysés. Bloquée, la modification n'est pas appliquée.
drop function if exists public.modifier_publication(uuid, text, text);
create or replace function public.modifier_publication(p_id uuid, p_titre text, p_texte text, p_analyse jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.publications%rowtype;
  v_titre text := regexp_replace(coalesce(p_titre, ''), '^\s+|\s+$', '', 'g');
  v_texte text := regexp_replace(coalesce(p_texte, ''), '^\s+|\s+$', '', 'g');
  v_statut text;
  v_examen boolean;
  v_analyse jsonb;
begin
  perform public.exiger_compte_actif();
  select * into v from public.publications where id = p_id for update;
  if not found or not public.peut_lire_espace(v.parcours_id) or v.statut = 'bloquee' then
    raise exception 'Cette publication n’existe plus.';
  end if;
  if v.auteur <> (select auth.uid()) then
    raise exception 'Cette publication n’est pas la vôtre.' using errcode = '42501';
  end if;
  if char_length(v_texte) not between 1 and 3000 then
    raise exception 'Écrivez votre publication (3 000 caractères au plus).';
  end if;
  if char_length(v_titre) > 120 then
    raise exception 'Le titre dépasse 120 caractères.';
  end if;
  v_statut := v.statut;
  v_examen := v.a_examiner;
  if public.verdict_valide(p_analyse) then
    v_analyse := public.analyse_retenue(p_analyse);
    update public.reglages_moderation set derniere_analyse = now() where id;
    if v_analyse ->> 'decision' = 'bloquer' then
      return jsonb_build_object('statut', 'bloquee', 'categorie', v_analyse ->> 'categorie');
    end if;
    -- En attente, elle le reste : la modification n'analyse que le texte, jamais le fichier ; seule l'équipe la publie.
    v_statut := case when v.statut = 'en_attente' then 'en_attente' else 'publiee' end;
    v_examen := v.a_examiner or v_analyse ->> 'decision' in ('signaler', 'echec');
  elsif public.moderation_active() then
    v_statut := 'en_attente';
  end if;
  update public.publications
  set titre = v_titre, texte = v_texte, modifiee = true, modifie_le = now(),
      statut = v_statut, a_examiner = v_examen, verdict = coalesce(v_analyse, verdict)
  where id = p_id;
  if (v_statut = 'en_attente' and v.statut <> 'en_attente') or (v_examen and not v.a_examiner) then
    perform public.prevenir_equipe('Une publication de l’espace ' || public.nom_espace_communaute(v.parcours_id) || ' attend votre examen.');
  end if;
  return jsonb_build_object('statut', v_statut, 'categorie', v_analyse ->> 'categorie');
end;
$$;

-- Avant d'appeler l'IA (serveur) : les refus de publier ou de modifier, la limite des analyses ; rend l'identifiant du
-- fichier joint, que le verdict reprendra (« objet »). Une modification : la publication de l'appelant, non bloquée.
create or replace function public.preparer_analyse(p_publication uuid, p_parcours uuid, p_titre text, p_texte text, p_piece jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.publications%rowtype;
  v_moi uuid := (select auth.uid());
  v_titre text := regexp_replace(coalesce(p_titre, ''), '^\s+|\s+$', '', 'g');
  v_texte text := regexp_replace(coalesce(p_texte, ''), '^\s+|\s+$', '', 'g');
  v_objet text;
begin
  perform public.exiger_compte_actif();
  if p_publication is not null then
    select * into v from public.publications where id = p_publication;
    if not found or not public.peut_lire_espace(v.parcours_id) or v.statut = 'bloquee' then
      raise exception 'Cette publication n’existe plus.';
    end if;
    if v.auteur <> v_moi then
      raise exception 'Cette publication n’est pas la vôtre.' using errcode = '42501';
    end if;
  else
    if not public.peut_lire_espace(p_parcours) then
      raise exception 'Cet espace ne vous est pas ouvert.' using errcode = '42501';
    end if;
    perform public.limiter_debit(false);
  end if;
  if char_length(v_texte) not between 1 and 3000 then
    raise exception 'Écrivez votre publication (3 000 caractères au plus).';
  end if;
  if char_length(v_titre) > 120 then
    raise exception 'Le titre dépasse 120 caractères.';
  end if;
  if p_publication is null and p_piece is not null and jsonb_typeof(p_piece) <> 'null' then
    perform public.verifier_piece(p_piece);
    select o.id::text into v_objet from storage.objects o where o.bucket_id = 'communaute' and o.name = p_piece ->> 'chemin';
  end if;
  delete from public.journal_moderation where profil_id = v_moi and cree_le < now() - interval '1 day';
  if (select count(*) from public.journal_moderation where profil_id = v_moi and cree_le > now() - interval '10 minutes') >= 10 then
    raise exception 'Vous publiez beaucoup en peu de temps. Réessayez dans quelques minutes.';
  end if;
  insert into public.journal_moderation (profil_id) values (v_moi);
  return jsonb_build_object('objet', v_objet);
end;
$$;

-- Répondre : la limite de débit en plus (le reste comme la 0019).
create or replace function public.commenter(p_publication uuid, p_texte text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.publications%rowtype := public.publication_ouverte(p_publication);
  v_texte text := regexp_replace(coalesce(p_texte, ''), '^\s+|\s+$', '', 'g');
  v_id uuid;
  v_nom text;
begin
  if char_length(v_texte) not between 1 and 1000 then
    raise exception 'Écrivez votre réponse (1 000 caractères au plus).';
  end if;
  perform public.limiter_debit(true);
  insert into public.commentaires_publications (publication_id, auteur, texte)
  values (p_publication, (select auth.uid()), v_texte)
  returning id into v_id;
  select public.nom_avis(prenom, nom) into v_nom from public.profils where id = (select auth.uid());
  perform public.notifier(
    array[v.auteur], 'communaute', 'Nouvelle réponse',
    v_nom || ' a répondu à votre publication dans l’espace ' || public.nom_espace_communaute(v.parcours_id) || '.',
    '/communaute/publications/' || v.id
  );
  return v_id;
end;
$$;

-- ─── Signalements ───────────────────────────────────────────────────────────────────────────────────
-- Une publication ou une réponse ; un seul par compte et par contenu. Fermés : l'équipe les lit par la file.
create table if not exists public.signalements (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid references public.publications (id) on delete cascade,
  commentaire_id uuid references public.commentaires_publications (id) on delete cascade,
  auteur uuid not null references public.profils (id) on delete cascade,
  motif text not null,
  precisions text not null default '',
  cree_le timestamptz not null default now(),
  traite_le timestamptz,
  constraint signalements_une_cible check ((publication_id is null) <> (commentaire_id is null)),
  constraint signalements_motif check (motif in ('inapproprie', 'spam', 'harcelement', 'autre')),
  constraint signalements_precisions check (char_length(precisions) <= 500)
);
create unique index if not exists signalements_publication_unique on public.signalements (auteur, publication_id) where publication_id is not null;
create unique index if not exists signalements_commentaire_unique on public.signalements (auteur, commentaire_id) where commentaire_id is not null;
create index if not exists signalements_publication_idx on public.signalements (publication_id) where traite_le is null;
create index if not exists signalements_commentaire_idx on public.signalements (commentaire_id) where traite_le is null;
alter table public.signalements enable row level security;
revoke all on public.signalements from anon, authenticated;

-- Signaler : qui lit l'espace du contenu, sauf son auteur et l'équipe. L'équipe est prévenue au premier signalement d'un
-- contenu qui n'était pas déjà dans sa file.
create or replace function public.signaler(p_publication uuid, p_commentaire uuid, p_motif text, p_precisions text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_publication public.publications%rowtype;
  v_commentaire public.commentaires_publications%rowtype;
  v_auteur uuid;
  v_precisions text := regexp_replace(coalesce(p_precisions, ''), '^\s+|\s+$', '', 'g');
  v_dans_la_file boolean;
begin
  perform public.exiger_compte_actif();
  if (p_publication is null) = (p_commentaire is null) then
    raise exception 'Ce contenu n’existe plus.';
  end if;
  if p_commentaire is not null then
    select * into v_commentaire from public.commentaires_publications where id = p_commentaire;
    if not found then
      raise exception 'Ce contenu n’existe plus.';
    end if;
    v_publication := public.publication_ouverte(v_commentaire.publication_id);
    v_auteur := v_commentaire.auteur;
    v_dans_la_file := exists (select 1 from public.signalements s where s.commentaire_id = p_commentaire and s.traite_le is null);
  else
    v_publication := public.publication_ouverte(p_publication);
    v_auteur := v_publication.auteur;
    v_dans_la_file := v_publication.a_examiner or v_publication.statut <> 'publiee'
      or exists (select 1 from public.signalements s where s.publication_id = p_publication and s.traite_le is null);
  end if;
  if v_auteur = (select auth.uid()) then
    raise exception 'Vous ne pouvez pas signaler votre propre contenu.';
  end if;
  if public.equipe_contenus() then
    raise exception 'L’équipe modère depuis la file.';
  end if;
  if p_motif is null or p_motif not in ('inapproprie', 'spam', 'harcelement', 'autre') then
    raise exception 'Choisissez un motif.';
  end if;
  if p_motif = 'autre' and v_precisions = '' then
    raise exception 'Précisez le motif du signalement.';
  end if;
  if char_length(v_precisions) > 500 then
    raise exception '500 caractères au plus pour les précisions.';
  end if;
  begin
    insert into public.signalements (publication_id, commentaire_id, auteur, motif, precisions)
    values (case when p_commentaire is null then p_publication end, p_commentaire, (select auth.uid()), p_motif, v_precisions);
  exception when unique_violation then
    raise exception 'Vous avez déjà signalé ce contenu.';
  end;
  if not v_dans_la_file then
    perform public.prevenir_equipe(
      case when p_commentaire is null then 'Une publication' else 'Une réponse' end
      || ' de l’espace ' || public.nom_espace_communaute(v_publication.parcours_id) || ' attend votre examen.'
    );
  end if;
end;
$$;

-- ─── La file de l'équipe ────────────────────────────────────────────────────────────────────────────
-- Les signalements non traités d'un contenu : leur nombre, les motifs comptés, le détail (nom court de qui signale).
create or replace function public.resume_signalements(p_publication uuid, p_commentaire uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with s as (
    select * from public.signalements
    where traite_le is null and (publication_id = p_publication or commentaire_id = p_commentaire)
  )
  select jsonb_build_object(
    'nombre', (select count(*)::int from s),
    'motifs', coalesce((
      select jsonb_agg(jsonb_build_object('motif', m.motif, 'nombre', m.n) order by m.n desc, m.motif)
      from (select motif, count(*)::int as n from s group by motif) m
    ), '[]'::jsonb),
    'details', coalesce((
      select jsonb_agg(jsonb_build_object('motif', s.motif, 'precisions', s.precisions, 'par', public.nom_avis(pr.prenom, pr.nom), 'le', s.cree_le) order by s.cree_le, s.id)
      from s join public.profils pr on pr.id = s.auteur
    ), '[]'::jsonb)
  );
$$;

create or replace function public.element_publication(p public.publications)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'type', 'publication',
    'id', p.id,
    'publication_id', p.id,
    'espace', jsonb_build_object('id', p.parcours_id, 'nom', public.nom_espace_communaute(p.parcours_id)),
    'auteur', jsonb_build_object('id', p.auteur, 'prenom', coalesce(pr.prenom, ''), 'nom', coalesce(pr.nom, '')),
    'cree_le', p.cree_le,
    'titre', p.titre,
    'texte', p.texte,
    'piece_jointe', p.piece_jointe,
    'statut', p.statut,
    'analyse', p.verdict,
    'extrait', null,
    'signalements', public.resume_signalements(p.id, null)
  )
  from public.profils pr
  where pr.id = p.auteur;
$$;

create or replace function public.element_reponse(c public.commentaires_publications)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'type', 'reponse',
    'id', c.id,
    'publication_id', c.publication_id,
    'espace', jsonb_build_object('id', p.parcours_id, 'nom', public.nom_espace_communaute(p.parcours_id)),
    'auteur', jsonb_build_object('id', c.auteur, 'prenom', coalesce(pr.prenom, ''), 'nom', coalesce(pr.nom, '')),
    'cree_le', c.cree_le,
    'titre', '',
    'texte', c.texte,
    'piece_jointe', null,
    'statut', p.statut,
    'analyse', null,
    'extrait', left(coalesce(nullif(p.titre, ''), p.texte), 140),
    'signalements', public.resume_signalements(null, c.id)
  )
  from public.publications p
  join public.profils pr on pr.id = c.auteur
  where p.id = c.publication_id;
$$;

-- « À examiner » : publications en attente, signalées par l'analyse ou par des membres, et réponses signalées, les plus
-- anciennes d'abord. « Bloquées » : refusées par l'analyse, les plus récentes d'abord. 50 au plus.
create or replace function public.file_moderation(p_onglet text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_equipe_moderation();
  if p_onglet = 'bloquees' then
    return coalesce((
      select jsonb_agg(public.element_publication(b) order by b.cree_le desc, b.id desc)
      from (select * from public.publications where statut = 'bloquee' order by cree_le desc, id desc limit 50) b
    ), '[]'::jsonb);
  end if;
  return coalesce((
    select jsonb_agg(e.element order by e.cree_le, e.id)
    from (
      select public.element_publication(p) as element, p.cree_le, p.id
      from public.publications p
      where p.statut = 'en_attente'
        or (p.statut = 'publiee' and (p.a_examiner or exists (select 1 from public.signalements s where s.publication_id = p.id and s.traite_le is null)))
      union all
      select public.element_reponse(c), c.cree_le, c.id
      from public.commentaires_publications c
      where exists (select 1 from public.signalements s where s.commentaire_id = c.id and s.traite_le is null)
      order by 2, 3
      limit 50
    ) e
  ), '[]'::jsonb);
end;
$$;

create or replace function public.nombre_a_examiner()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_equipe_moderation();
  return (
    select count(*)::int from public.publications p
    where p.statut = 'en_attente'
      or (p.statut = 'publiee' and (p.a_examiner or exists (select 1 from public.signalements s where s.publication_id = p.id and s.traite_le is null)))
  ) + (
    select count(*)::int from public.commentaires_publications c
    where exists (select 1 from public.signalements s where s.commentaire_id = c.id and s.traite_le is null)
  );
end;
$$;

-- « Publication en ligne » à son auteur, après vérification par l'équipe.
create or replace function public.annoncer_mise_en_ligne(p public.publications)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notifier(
    array[p.auteur], 'service', 'Publication en ligne',
    'Votre publication dans l’espace ' || public.nom_espace_communaute(p.parcours_id) || ' a été vérifiée par l’équipe Étudium et mise en ligne.',
    '/communaute/publications/' || p.id
  );
end;
$$;

-- Garder : les signalements sont classés et le contenu quitte la file ; une publication en attente est mise en ligne.
create or replace function public.garder_contenu(p_publication uuid, p_commentaire uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.publications%rowtype;
begin
  perform public.exiger_equipe_moderation();
  if p_commentaire is not null then
    if not exists (select 1 from public.commentaires_publications where id = p_commentaire) then
      raise exception 'Ce contenu n’existe plus.';
    end if;
    update public.signalements set traite_le = now() where commentaire_id = p_commentaire and traite_le is null;
    return;
  end if;
  select * into v from public.publications where id = p_publication for update;
  if not found then
    raise exception 'Ce contenu n’existe plus.';
  end if;
  update public.signalements set traite_le = now() where publication_id = p_publication and traite_le is null;
  update public.publications
  set a_examiner = false, statut = case when statut = 'en_attente' then 'publiee' else statut end
  where id = p_publication;
  if v.statut = 'en_attente' then
    perform public.annoncer_mise_en_ligne(v);
  end if;
end;
$$;

-- Supprimer : le contenu disparaît (avec ses signalements) et son auteur est prévenu, sauf pour une publication bloquée,
-- qu'il n'a jamais vue en ligne. Rend le chemin du fichier à retirer du stockage.
create or replace function public.supprimer_contenu(p_publication uuid, p_commentaire uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.publications%rowtype;
  v_commentaire public.commentaires_publications%rowtype;
  v_regles text := ' a été retirée par l’équipe Étudium : elle ne respecte pas les règles de la communauté.';
begin
  perform public.exiger_equipe_moderation();
  if p_commentaire is not null then
    select * into v_commentaire from public.commentaires_publications where id = p_commentaire for update;
    if not found then
      raise exception 'Ce contenu n’existe plus.';
    end if;
    select * into v from public.publications where id = v_commentaire.publication_id;
    delete from public.commentaires_publications where id = p_commentaire;
    perform public.notifier(
      array[v_commentaire.auteur], 'service', 'Réponse retirée',
      'Votre réponse dans l’espace ' || public.nom_espace_communaute(v.parcours_id) || v_regles, '/communaute'
    );
    return null;
  end if;
  select * into v from public.publications where id = p_publication for update;
  if not found then
    raise exception 'Ce contenu n’existe plus.';
  end if;
  delete from public.publications where id = p_publication;
  if v.statut <> 'bloquee' then
    perform public.notifier(
      array[v.auteur], 'service', 'Publication retirée',
      'Votre publication dans l’espace ' || public.nom_espace_communaute(v.parcours_id) || v_regles, '/communaute'
    );
  end if;
  return v.piece_jointe ->> 'chemin';
end;
$$;

-- Rétablir une publication bloquée par erreur : elle est mise en ligne et son auteur est prévenu.
create or replace function public.retablir_publication(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.publications%rowtype;
begin
  perform public.exiger_equipe_moderation();
  select * into v from public.publications where id = p_id for update;
  if not found then
    raise exception 'Ce contenu n’existe plus.';
  end if;
  if v.statut <> 'bloquee' then
    return;
  end if;
  update public.publications set statut = 'publiee', a_examiner = false where id = p_id;
  perform public.annoncer_mise_en_ligne(v);
end;
$$;

-- ─── Droits d'exécution ─────────────────────────────────────────────────────────────────────────────
revoke execute on function public.exiger_equipe_moderation() from public, anon, authenticated;
revoke execute on function public.verdict_valide(jsonb) from public, anon, authenticated;
revoke execute on function public.analyse_retenue(jsonb) from public, anon, authenticated;
revoke execute on function public.nom_espace_communaute(uuid) from public, anon, authenticated;
revoke execute on function public.prevenir_equipe(text) from public, anon, authenticated;
revoke execute on function public.limiter_debit(boolean) from public, anon, authenticated;
revoke execute on function public.publication_visible(public.publications) from public, anon, authenticated;
revoke execute on function public.moderation_active() from public, anon;
revoke execute on function public.etat_moderation(text) from public, anon;
revoke execute on function public.regler_analyse(boolean, text) from public, anon;
revoke execute on function public.publier(uuid, text, text, jsonb, jsonb) from public, anon;
revoke execute on function public.modifier_publication(uuid, text, text, jsonb) from public, anon;
grant execute on function public.moderation_active() to authenticated;
grant execute on function public.etat_moderation(text) to authenticated;
grant execute on function public.regler_analyse(boolean, text) to authenticated;
grant execute on function public.publier(uuid, text, text, jsonb, jsonb) to authenticated;
revoke execute on function public.preparer_analyse(uuid, uuid, text, text, jsonb) from public, anon;
grant execute on function public.preparer_analyse(uuid, uuid, text, text, jsonb) to authenticated;
grant execute on function public.modifier_publication(uuid, text, text, jsonb) to authenticated;

revoke execute on function public.signaler(uuid, uuid, text, text) from public, anon;
revoke execute on function public.resume_signalements(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.element_publication(public.publications) from public, anon, authenticated;
revoke execute on function public.element_reponse(public.commentaires_publications) from public, anon, authenticated;
revoke execute on function public.annoncer_mise_en_ligne(public.publications) from public, anon, authenticated;
revoke execute on function public.file_moderation(text) from public, anon;
revoke execute on function public.nombre_a_examiner() from public, anon;
revoke execute on function public.garder_contenu(uuid, uuid) from public, anon;
revoke execute on function public.supprimer_contenu(uuid, uuid) from public, anon;
revoke execute on function public.retablir_publication(uuid) from public, anon;
grant execute on function public.signaler(uuid, uuid, text, text) to authenticated;
grant execute on function public.file_moderation(text) to authenticated;
grant execute on function public.nombre_a_examiner() to authenticated;
grant execute on function public.garder_contenu(uuid, uuid) to authenticated;
grant execute on function public.supprimer_contenu(uuid, uuid) to authenticated;
grant execute on function public.retablir_publication(uuid) to authenticated;

commit;
