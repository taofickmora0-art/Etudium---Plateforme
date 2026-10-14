-- Étudium · migration 0022 : la vidéo jointe aux publications de la communauté (spec du 14 octobre 2026, mise en forme
-- et vidéo). À appliquer dans Supabase, après la 0021 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable. Si la 0019, la 0020 ou la 0021 est rejouée un jour, rejouer celle-ci ensuite.
-- Le texte mis en forme (Markdown restreint) n'a besoin d'aucun changement : il reste dans `publications.texte`.

begin;

-- ─── La vidéo ───────────────────────────────────────────────────────────────────────────────────────
-- {plateforme, id, h, url} pour une plateforme connue, {plateforme: 'fichier', url} pour un fichier vidéo en https,
-- {plateforme: 'autre', url, titre, image} pour une autre page (carte). Le lecteur est construit par l'application depuis
-- la plateforme et l'identifiant, jamais depuis l'adresse.
alter table public.publications add column if not exists video jsonb;

-- Vérifie et normalise une vidéo (les champs inconnus sont retirés) ; null si aucune ; refusée sinon. Mêmes formes
-- d'identifiant que l'application (lib/communaute/video.ts).
create or replace function public.verifier_video(p_video jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_formes constant jsonb := jsonb_build_object(
    'youtube', '^[A-Za-z0-9_-]{11}$',
    'vimeo', '^[0-9]{6,12}$',
    'dailymotion', '^[A-Za-z0-9]{5,12}$',
    'loom', '^[a-f0-9]{32}$',
    'tiktok', '^[0-9]{10,25}$',
    'facebook', '^[0-9]{5,25}$',
    'instagram', '^[A-Za-z0-9_-]{5,30}$',
    'drive', '^[A-Za-z0-9_-]{20,80}$'
  );
  v_plateforme text;
  v_url text;
  v_id text;
  v_image text;
begin
  if p_video is null or jsonb_typeof(p_video) = 'null' then
    return null;
  end if;
  if jsonb_typeof(p_video) <> 'object' then
    raise exception 'Cette vidéo n’est pas reconnue.';
  end if;
  v_plateforme := p_video ->> 'plateforme';
  v_url := p_video ->> 'url';
  if v_url is null or char_length(v_url) > 1000 or v_url !~* '^https?://[^[:space:]]+$' then
    raise exception 'Cette vidéo n’est pas reconnue.';
  end if;
  if v_plateforme = 'fichier' then
    if v_url !~* '^https://' or v_url !~* '\.(mp4|webm|ogg|ogv)([?#][^[:space:]]*)?$' then
      raise exception 'Cette vidéo n’est pas reconnue.';
    end if;
    return jsonb_build_object('plateforme', 'fichier', 'url', v_url);
  end if;
  if v_plateforme = 'autre' then
    v_image := p_video ->> 'image';
    if v_image is not null and (char_length(v_image) > 1000 or v_image !~* '^https://[^[:space:]]+$') then
      v_image := null;
    end if;
    return jsonb_strip_nulls(jsonb_build_object(
      'plateforme', 'autre',
      'url', v_url,
      'titre', nullif(left(regexp_replace(coalesce(p_video ->> 'titre', ''), '[[:space:]]+', ' ', 'g'), 200), ''),
      'image', v_image
    ));
  end if;
  if v_plateforme is null or not (v_formes ? v_plateforme) then
    raise exception 'Cette vidéo n’est pas reconnue.';
  end if;
  v_id := p_video ->> 'id';
  if v_id is null or v_id !~ (v_formes ->> v_plateforme) then
    raise exception 'Cette vidéo n’est pas reconnue.';
  end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'plateforme', v_plateforme,
    'id', v_id,
    'h', case when v_plateforme = 'vimeo' and coalesce(p_video ->> 'h', '') ~ '^[a-f0-9]{6,20}$' then p_video ->> 'h' end,
    'url', v_url
  ));
end;
$$;

-- ─── Publier : la vidéo en plus (le reste comme la 0021) ────────────────────────────────────────────
drop function if exists public.publier(uuid, text, text, jsonb, jsonb, jsonb);
create or replace function public.publier(p_parcours uuid, p_titre text, p_texte text, p_piece jsonb default null, p_analyse jsonb default null, p_apercu jsonb default null, p_video jsonb default null)
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
  insert into public.publications (auteur, parcours_id, titre, texte, piece_jointe, statut, verdict, a_examiner, apercu, video)
  values ((select auth.uid()), p_parcours, v_titre, v_texte, public.verifier_piece(p_piece), v_statut, v_analyse, v_examen, public.verifier_apercu(p_apercu, v_texte), public.verifier_video(p_video))
  returning id into v_id;
  if v_examen or v_statut = 'en_attente' then
    perform public.prevenir_equipe('Une publication de l’espace ' || public.nom_espace_communaute(p_parcours) || ' attend votre examen.');
  end if;
  return jsonb_build_object('id', v_id, 'statut', v_statut, 'categorie', v_analyse ->> 'categorie');
end;
$$;

-- ─── La carte d'une publication : la vidéo en plus ──────────────────────────────────────────────────
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
    'apercu', p.apercu,
    'video', p.video,
    'enregistree', exists (
      select 1 from public.publications_enregistrees e where e.publication_id = p.id and e.profil_id = (select auth.uid())
    ),
    'aimee_par', coalesce((
      select jsonb_agg(public.initiales_avis(pr2.prenom, pr2.nom) order by d.cree_le desc, d.profil_id)
      from (
        select r.profil_id, r.cree_le from public.reactions_publications r
        where r.publication_id = p.id
        order by r.cree_le desc, r.profil_id
        limit 3
      ) d
      join public.profils pr2 on pr2.id = d.profil_id
    ), '[]'::jsonb),
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

-- ─── Droits d'exécution ─────────────────────────────────────────────────────────────────────────────
revoke execute on function public.verifier_video(jsonb) from public, anon, authenticated;
revoke execute on function public.publier(uuid, text, text, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.publier(uuid, text, text, jsonb, jsonb, jsonb, jsonb) to authenticated;

commit;
