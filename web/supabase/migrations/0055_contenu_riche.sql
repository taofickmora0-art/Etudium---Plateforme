-- Migration 0055 : le contenu riche des leçons (fin du lot 4, spec §1 ; demande du 1er novembre 2026). Le contenu d'une
-- leçon devient le document de l'éditeur (titres, listes, images, tableaux, blocs d'information, vidéos), vérifié par
-- l'application (liste fermée) ; la colonne `texte` garde le texte brut. Les images vivent dans un espace privé, au
-- dossier de la formation : l'équipe et le formateur de la formation y déposent ; elles se lisent par des liens signés,
-- pour qui a accès à au moins une leçon de la formation. Rejouable.

begin;

-- ─── Le document ────────────────────────────────────────────────────────────────────────────────────
-- Vide pour une leçon ancienne : son texte (Markdown restreint) s'affiche comme avant. 300 Ko au plus.
alter table public.lecons_contenus add column if not exists document jsonb;
alter table public.lecons_contenus drop constraint if exists lecons_contenus_document_valide;
alter table public.lecons_contenus add constraint lecons_contenus_document_valide
  check (document is null or (jsonb_typeof(document) = 'object' and octet_length(document::text) <= 307200));

-- ─── Espace « images_lecons » : privé, 5 Mo, images seulement ───────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images_lecons', 'images_lecons', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Lire une image : l'équipe ; le formateur de la formation du dossier ; qui a accès à au moins une de ses leçons (une
-- image d'une version ancienne reste lisible : une leçon supprimée depuis ne la rend pas orpheline).
create or replace function public.lecture_images_formation(p_nom text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_dossier text := (storage.foldername(p_nom))[1];
  v_formation uuid;
begin
  if public.equipe_contenus() then
    return true;
  end if;
  if v_dossier is null or v_dossier !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  v_formation := v_dossier::uuid;
  return public.formateur_de(v_formation) or exists (
    select 1
    from public.lecons l
    join public.modules m on m.id = l.module_id
    where m.formation_id = v_formation and public.acces_lecon(l.id)
  );
end;
$$;
revoke execute on function public.lecture_images_formation(text) from public;
grant execute on function public.lecture_images_formation(text) to anon, authenticated;

drop policy if exists "images_lecons : lecture avec l'accès à la formation" on storage.objects;
create policy "images_lecons : lecture avec l'accès à la formation" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'images_lecons' and public.lecture_images_formation(name));

drop policy if exists "images_lecons : dépôt" on storage.objects;
create policy "images_lecons : dépôt" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'images_lecons' and ((select public.equipe_contenus()) or public.formateur_du_dossier(name)));

drop policy if exists "images_lecons : remplacement" on storage.objects;
create policy "images_lecons : remplacement" on storage.objects
  for update to authenticated
  using (bucket_id = 'images_lecons' and ((select public.equipe_contenus()) or public.formateur_du_dossier(name)))
  with check (bucket_id = 'images_lecons' and ((select public.equipe_contenus()) or public.formateur_du_dossier(name)));

drop policy if exists "images_lecons : suppression" on storage.objects;
create policy "images_lecons : suppression" on storage.objects
  for delete to authenticated
  using (bucket_id = 'images_lecons' and ((select public.equipe_contenus()) or public.formateur_du_dossier(name)));

-- ─── L'écran de correction : la consigne riche ──────────────────────────────────────────────────────
-- Même définition qu'en 0032, avec le document de la consigne en plus.
create or replace function public.rendu_a_corriger(p_rendu uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_r public.rendus_exercices;
begin
  select * into v_r from public.rendus_exercices r where r.id = p_rendu;
  if not found or not public.editeur_de_lecon(v_r.lecon_id) then
    return null;
  end if;
  return (
    select jsonb_build_object(
      'etudiant', coalesce(public.nom_du_profil(v_r.profil_id), 'Étudiant'),
      'exercice', jsonb_build_object(
        'id', l.id, 'titre', l.titre, 'genre', l.genre_exercice, 'consigne', coalesce(c.texte, ''), 'consigne_document', c.document
      ),
      'formation', jsonb_build_object('id', f.id, 'titre', f.titre, 'slug', f.slug),
      'module', jsonb_build_object('titre', m.titre, 'rang', public.rang_du_module(m.id)),
      'version', public.version_rendu(v_r),
      'derniere', not exists (
        select 1 from public.rendus_exercices r where r.lecon_id = v_r.lecon_id and r.profil_id = v_r.profil_id and r.version > v_r.version
      ),
      'historique', (
        select jsonb_agg(public.version_rendu(r) order by r.version desc)
        from public.rendus_exercices r
        where r.lecon_id = v_r.lecon_id and r.profil_id = v_r.profil_id
      ),
      'suivant', (
        select d.id
        from public.derniers_rendus d
        join public.lecons l2 on l2.id = d.lecon_id
        join public.modules m2 on m2.id = l2.module_id
        where d.statut = 'en_attente' and d.id <> v_r.id and (public.equipe_contenus() or public.formateur_de(m2.formation_id))
        order by d.cree_le
        limit 1
      )
    )
    from public.lecons l
    join public.modules m on m.id = l.module_id
    join public.formations f on f.id = m.formation_id
    left join public.lecons_contenus c on c.lecon_id = l.id
    where l.id = v_r.lecon_id
  );
end;
$$;
revoke execute on function public.rendu_a_corriger(uuid) from public, anon;
grant execute on function public.rendu_a_corriger(uuid) to authenticated;

commit;
