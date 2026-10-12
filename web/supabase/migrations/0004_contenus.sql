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
