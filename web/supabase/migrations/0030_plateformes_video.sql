-- Étudium · migration 0030 : les vidéos des leçons sur TikTok, Tella, Loom, ScreenPal et Google Drive
-- (spec docs/superpowers/specs/2026-10-15-plateformes-video-design.md).
-- À appliquer dans Supabase, après la 0029 : SQL Editor → New query → coller tout le fichier → Run. Rejouable.
--
-- TikTok et Tella sont « mesurées » comme YouTube et Vimeo : leur lecteur donne la position et la durée, le temps
-- réellement regardé valide la leçon au seuil. Loom, ScreenPal et Google Drive ne donnent rien : la vidéo s'affiche avec
-- le lecteur de la plateforme, et la leçon se termine d'un clic, comme une leçon sans vidéo.

begin;

-- ─── Les nouvelles plateformes ──────────────────────────────────────────────────────────────────────
-- Les nouvelles valeurs ne servent pas dans cette transaction (Postgres l'interdit avant leur validation) : la
-- contrainte et les fonctions comparent le texte du fournisseur.
alter type public.fournisseur_video add value if not exists 'tiktok';
alter type public.fournisseur_video add value if not exists 'tella';
alter type public.fournisseur_video add value if not exists 'loom';
alter type public.fournisseur_video add value if not exists 'screenpal';
alter type public.fournisseur_video add value if not exists 'drive';

-- Le format de l'identifiant de chaque plateforme (le lien collé n'est jamais gardé).
alter table public.lecons_contenus drop constraint if exists lecons_contenus_video;
alter table public.lecons_contenus add constraint lecons_contenus_video check (
  (video_fournisseur is null and video_id is null)
  or (
    video_fournisseur is not null and video_id is not null and (
      (video_fournisseur::text = 'youtube' and video_id ~ '^[A-Za-z0-9_-]{11}$')
      -- Vimeo : l'identifiant, suivi du code d'une vidéo « non répertoriée » comme dans son lien (76979871/abcdef0123).
      or (video_fournisseur::text = 'vimeo' and video_id ~ '^[0-9]{6,12}(/[0-9a-f]{6,20})?$')
      or (video_fournisseur::text = 'tiktok' and video_id ~ '^[0-9]{15,21}$')
      or (video_fournisseur::text = 'tella' and video_id ~ '^[A-Za-z0-9-]{4,120}$')
      or (video_fournisseur::text = 'loom' and video_id ~ '^[0-9a-f]{32}$')
      or (video_fournisseur::text = 'screenpal' and video_id ~ '^[A-Za-z0-9]{6,20}$')
      or (video_fournisseur::text = 'drive' and video_id ~ '^[A-Za-z0-9_-]{20,80}$')
    )
  )
);

-- Une plateforme dont le lecteur donne la position et la durée : le temps regardé s'y mesure.
create or replace function public.video_mesuree(p_fournisseur public.fournisseur_video)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_fournisseur::text in ('youtube', 'vimeo', 'tiktok', 'tella');
$$;

-- ─── Visionnage (0007) : rien à mesurer sur une plateforme sans mesure ───────────────────────────────
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
  if exists (
    select 1 from public.lecons_contenus c
    where c.lecon_id = p_lecon and c.video_id is not null and not public.video_mesuree(c.video_fournisseur)
  ) then
    raise exception 'Le temps regardé ne se mesure pas sur cette plateforme.' using errcode = '22023';
  end if;
  insert into public.progression_lecons (profil_id, lecon_id, dernier_envoi, vue_le)
  values ((select auth.uid()), p_lecon, now(), now())
  on conflict (profil_id, lecon_id) do update
    set vue_le = now(),
        dernier_envoi = coalesce(public.progression_lecons.dernier_envoi, now());
end;
$$;

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
  if exists (
    select 1 from public.lecons_contenus c
    where c.lecon_id = p_lecon and c.video_id is not null and not public.video_mesuree(c.video_fournisseur)
  ) then
    raise exception 'Le temps regardé ne se mesure pas sur cette plateforme.' using errcode = '22023';
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

-- ─── Fin d'une leçon (0008) : d'un clic pour une vidéo sans mesure ───────────────────────────────────
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
  -- YouTube et Vimeo se terminent en les regardant (seuil). Une vidéo sans mesure (Drive, Loom, ScreenPal) se
  -- termine d'un clic ; TikTok et Tella aussi, en secours quand leur lecteur ne répond pas (leur protocole de
  -- messages n'est pas encore éprouvé : une leçon ne doit jamais devenir impossible à terminer).
  if exists (
    select 1 from public.lecons_contenus c
    where c.lecon_id = p_lecon and c.video_id is not null and c.video_fournisseur::text in ('youtube', 'vimeo')
  ) then
    raise exception 'Une leçon vidéo se termine en la regardant.' using errcode = '22023';
  end if;
  insert into public.progression_lecons (profil_id, lecon_id, terminee_le)
  values ((select auth.uid()), p_lecon, now())
  on conflict (profil_id, lecon_id) do update
    set terminee_le = coalesce(public.progression_lecons.terminee_le, now()),
        vue_le = now();
end;
$$;

revoke execute on function public.video_mesuree(public.fournisseur_video) from public, anon, authenticated;

commit;
