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

drop policy if exists "couvertures : lecture pour tous" on storage.objects;
create policy "couvertures : lecture pour tous" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'couvertures');

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
