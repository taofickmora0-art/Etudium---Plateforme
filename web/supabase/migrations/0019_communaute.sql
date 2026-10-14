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

alter table public.publications enable row level security;
revoke all on public.publications from anon, authenticated;

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
    'reactions', 0,
    'j_aime', false,
    'reponses', 0,
    'dernieres_reponses', '[]'::jsonb,
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
  return public.carte_publication(v) || jsonb_build_object('toutes_reponses', '[]'::jsonb);
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

-- Privé, 10 Mo, images et PDF. Chacun dépose dans son dossier (« <compte>/… ») ; on lit un fichier si une publication
-- lisible l'attache, ou si c'est le sien ; on supprime le sien, et l'équipe tout.
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
    )
  );

drop policy if exists "communaute : supprimer" on storage.objects;
create policy "communaute : supprimer" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'communaute'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.equipe_contenus()))
  );

-- ─── Droits d'exécution ─────────────────────────────────────────────────────────────────────────────
revoke execute on function public.peut_lire_espace(uuid) from public, anon;
grant execute on function public.peut_lire_espace(uuid) to authenticated;
revoke execute on function public.role_communaute(uuid) from public, anon, authenticated;
revoke execute on function public.carte_publication(public.publications) from public, anon, authenticated;
revoke execute on function public.verifier_piece(jsonb) from public, anon, authenticated;
revoke execute on function public.fichier_communaute_lisible(text) from public, anon;
grant execute on function public.fichier_communaute_lisible(text) to authenticated;
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
