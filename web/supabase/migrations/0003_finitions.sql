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
