-- Migration 0039 : l'annonce de l'Accueil masquable (liste du 31 octobre 2026, tâche 6).
-- L'équipe choisit, en l'enregistrant, si les membres peuvent masquer l'annonce. Masquée, elle ne revient pour ce membre
-- que si l'équipe la modifie (une nouvelle annonce : sa date de modification passe après le masquage). Mêmes définitions
-- qu'en 0021 (annonce_communaute, annonce_equipe, enregistrer_annonce), plus ce réglage. Rejouable.

begin;

alter table public.annonce_communaute add column if not exists masquable boolean not null default false;

-- Qui a masqué l'annonce, et quand (une ligne par compte, remplacée à chaque masquage).
create table if not exists public.annonces_masquees (
  profil_id uuid primary key references public.profils (id) on delete cascade,
  masquee_le timestamptz not null default now()
);
alter table public.annonces_masquees enable row level security;
revoke all on public.annonces_masquees from anon, authenticated;

create or replace function public.annonce_communaute()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.annonce_communaute%rowtype;
begin
  perform public.exiger_compte_actif();
  select * into a from public.annonce_communaute where id;
  if not found or not public.annonce_visible(a) then
    return null;
  end if;
  -- Masquée par ce compte depuis sa dernière modification : il ne la voit plus.
  if a.masquable and exists (
    select 1 from public.annonces_masquees m where m.profil_id = (select auth.uid()) and m.masquee_le >= a.modifiee_le
  ) then
    return null;
  end if;
  return jsonb_build_object(
    'titre', a.titre, 'texte', a.texte, 'media', a.media, 'youtube_id', a.youtube_id, 'image_chemin', a.image_chemin,
    'masquable', a.masquable
  );
end;
$$;

create or replace function public.annonce_equipe()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.annonce_communaute%rowtype;
begin
  perform public.exiger_equipe_moderation();
  select * into a from public.annonce_communaute where id;
  return jsonb_build_object(
    'active', a.active, 'titre', a.titre, 'texte', a.texte, 'media', a.media, 'youtube_id', a.youtube_id,
    'image_chemin', a.image_chemin, 'public', a.public, 'parcours_id', a.parcours_id, 'modifiee_le', a.modifiee_le,
    'masquable', a.masquable
  );
end;
$$;

-- La signature change (un paramètre de plus, facultatif) : l'ancienne est retirée pour éviter deux versions.
drop function if exists public.enregistrer_annonce(boolean, text, text, text, text, text, text, uuid);
create or replace function public.enregistrer_annonce(
  p_active boolean, p_titre text, p_texte text, p_media text, p_youtube_id text, p_image_chemin text, p_public text, p_parcours uuid,
  p_masquable boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_titre text := regexp_replace(coalesce(p_titre, ''), '^\s+|\s+$', '', 'g');
  v_texte text := regexp_replace(coalesce(p_texte, ''), '^\s+|\s+$', '', 'g');
  v_media text := case when p_media in ('youtube', 'image') then p_media end;
  v_public text := case when p_public = 'parcours' then 'parcours' else 'tous' end;
  v_actuelle text;
begin
  perform public.exiger_equipe_moderation();
  select image_chemin into v_actuelle from public.annonce_communaute where id;
  if char_length(v_titre) > 120 or (coalesce(p_active, false) and v_titre = '') then
    raise exception 'Écrivez le titre de l’annonce (120 caractères au plus).';
  end if;
  if char_length(v_texte) > 500 then
    raise exception 'Le texte de l’annonce dépasse 500 caractères.';
  end if;
  if v_media = 'youtube' and coalesce(p_youtube_id, '') !~ '^[A-Za-z0-9_-]{11}$' then
    raise exception 'Cette adresse YouTube n’est pas reconnue.';
  end if;
  if v_media = 'image' and (
    p_image_chemin is null
    or (
      p_image_chemin is distinct from v_actuelle
      and (
        p_image_chemin ~ '\.\.'
        or (storage.foldername(p_image_chemin))[1] is distinct from (select auth.uid())::text
        or not exists (
          select 1 from storage.objects o
          where o.bucket_id = 'communaute' and o.name = p_image_chemin
            and o.metadata ->> 'mimetype' in ('image/jpeg', 'image/png', 'image/webp')
            and o.metadata ->> 'size' ~ '^[0-9]{1,9}$'
            and (o.metadata ->> 'size')::bigint between 1 and 10485760
        )
      )
    )
  ) then
    raise exception 'Choisissez une image JPEG, PNG ou WebP de 10 Mo au plus.';
  end if;
  if v_public = 'parcours' and (p_parcours is null or not exists (select 1 from public.parcours where id = p_parcours)) then
    raise exception 'Choisissez un parcours.';
  end if;
  update public.annonce_communaute
  set active = coalesce(p_active, false), titre = v_titre, texte = v_texte, media = v_media,
      youtube_id = case when v_media = 'youtube' then p_youtube_id end,
      image_chemin = case when v_media = 'image' then p_image_chemin end,
      public = v_public, parcours_id = case when v_public = 'parcours' then p_parcours end,
      masquable = coalesce(p_masquable, false),
      modifiee_le = now()
  where id;
end;
$$;

-- Masquer l'annonce pour soi : seulement si l'équipe l'a permis, et si on la voit.
create or replace function public.masquer_annonce()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.annonce_communaute%rowtype;
begin
  perform public.exiger_compte_actif();
  select * into a from public.annonce_communaute where id;
  if not found or not public.annonce_visible(a) or not a.masquable then
    raise exception 'Cette annonce ne peut pas être masquée.';
  end if;
  insert into public.annonces_masquees (profil_id, masquee_le)
  values ((select auth.uid()), now())
  on conflict (profil_id) do update set masquee_le = excluded.masquee_le;
end;
$$;

revoke execute on function public.enregistrer_annonce(boolean, text, text, text, text, text, text, uuid, boolean) from public, anon;
grant execute on function public.enregistrer_annonce(boolean, text, text, text, text, text, text, uuid, boolean) to authenticated;
revoke execute on function public.masquer_annonce() from public, anon;
grant execute on function public.masquer_annonce() to authenticated;

commit;
