-- Étudium · base de production · partie 2 sur 6 (migrations 0021 à 0034).
-- Fichier produit par scripts/assembler-migrations.mjs : ne pas le modifier à la main.
-- Supabase › SQL Editor › New query : colle tout ce fichier, puis Run. Attends « Success » avant la partie suivante.
-- Ensuite : partie 3.

-- ═══ 0021_communaute_actualites.sql ═══
-- Étudium · migration 0021 : le fil « Actualités » de la communauté (spec du 14 octobre 2026).
-- À appliquer dans Supabase, après la 0020 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancé sur une base qui l'a déjà, il ne change rien et ne casse rien. Si la 0019 ou la 0020 est rejouée
-- un jour, rejouer celle-ci ensuite.

begin;

-- ─── Aperçus et signets ─────────────────────────────────────────────────────────────────────────────
-- L'aperçu de la première adresse d'une publication, lu par le serveur et vérifié ici : {type:'youtube', id} ou
-- {type:'lien', url, titre, description, image}.
alter table public.publications add column if not exists apercu jsonb;

-- Les publications qu'un compte a enregistrées (« Mes enregistrements »). Fermée : tout passe par les fonctions.
create table if not exists public.publications_enregistrees (
  profil_id uuid not null references public.profils (id) on delete cascade,
  publication_id uuid not null references public.publications (id) on delete cascade,
  cree_le timestamptz not null default now(),
  primary key (profil_id, publication_id)
);
create index if not exists publications_enregistrees_publication_idx on public.publications_enregistrees (publication_id);
alter table public.publications_enregistrees enable row level security;
revoke all on public.publications_enregistrees from anon, authenticated;

-- Un aperçu n'est gardé que si son adresse (ou l'identifiant de la vidéo) figure dans le texte : il ne peut pas présenter
-- une autre adresse que celle du lien. Longueurs coupées ; une image qui n'est pas une adresse web est retirée.
create or replace function public.verifier_apercu(p_apercu jsonb, p_texte text)
returns jsonb
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v_type text;
  v_id text;
  v_url text;
  v_image text;
begin
  if p_apercu is null or jsonb_typeof(p_apercu) <> 'object' then
    return null;
  end if;
  v_type := p_apercu ->> 'type';
  if v_type = 'youtube' then
    v_id := p_apercu ->> 'id';
    if v_id ~ '^[A-Za-z0-9_-]{11}$' and position(v_id in coalesce(p_texte, '')) > 0 then
      return jsonb_build_object('type', 'youtube', 'id', v_id);
    end if;
    return null;
  end if;
  if v_type = 'lien' then
    v_url := p_apercu ->> 'url';
    if v_url is null or v_url !~* '^https?://' or char_length(v_url) > 2000 or position(v_url in coalesce(p_texte, '')) = 0 then
      return null;
    end if;
    v_image := nullif(btrim(coalesce(p_apercu ->> 'image', '')), '');
    if v_image is not null and (v_image !~* '^https?://' or char_length(v_image) > 1000) then
      v_image := null;
    end if;
    return jsonb_build_object(
      'type', 'lien',
      'url', v_url,
      'titre', left(coalesce(p_apercu ->> 'titre', ''), 200),
      'description', left(coalesce(p_apercu ->> 'description', ''), 300),
      'image', v_image
    );
  end if;
  return null;
end;
$$;

-- ─── Publier, modifier : l'aperçu en plus (le reste comme la 0020) ──────────────────────────────────
drop function if exists public.publier(uuid, text, text, jsonb, jsonb);
create or replace function public.publier(p_parcours uuid, p_titre text, p_texte text, p_piece jsonb default null, p_analyse jsonb default null, p_apercu jsonb default null)
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
  insert into public.publications (auteur, parcours_id, titre, texte, piece_jointe, statut, verdict, a_examiner, apercu)
  values ((select auth.uid()), p_parcours, v_titre, v_texte, public.verifier_piece(p_piece), v_statut, v_analyse, v_examen, public.verifier_apercu(p_apercu, v_texte))
  returning id into v_id;
  if v_examen or v_statut = 'en_attente' then
    perform public.prevenir_equipe('Une publication de l’espace ' || public.nom_espace_communaute(p_parcours) || ' attend votre examen.');
  end if;
  return jsonb_build_object('id', v_id, 'statut', v_statut, 'categorie', v_analyse ->> 'categorie');
end;
$$;

drop function if exists public.modifier_publication(uuid, text, text, jsonb);
create or replace function public.modifier_publication(p_id uuid, p_titre text, p_texte text, p_analyse jsonb default null, p_apercu jsonb default null)
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
      statut = v_statut, a_examiner = v_examen, verdict = coalesce(v_analyse, verdict),
      apercu = public.verifier_apercu(p_apercu, v_texte)
  where id = p_id;
  if (v_statut = 'en_attente' and v.statut <> 'en_attente') or (v_examen and not v.a_examiner) then
    perform public.prevenir_equipe('Une publication de l’espace ' || public.nom_espace_communaute(v.parcours_id) || ' attend votre examen.');
  end if;
  return jsonb_build_object('statut', v_statut, 'categorie', v_analyse ->> 'categorie');
end;
$$;

-- ─── La carte : l'aperçu, le signet, les initiales des derniers qui ont aimé ────────────────────────
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

-- ─── Le fil : un espace (tous, general, un parcours) et un tri ──────────────────────────────────────
-- « recentes » : le curseur (cree_le, id). « populaires » : J’aime + 2 × commentaires, sur 30 jours, puis la date ; par
-- pages. « enregistrees » : les signets du compte, du plus récent ; par pages. Toujours les publications visibles.
drop function if exists public.fil_communaute(text, timestamptz, uuid, integer);
create or replace function public.fil_communaute(
  p_espace text,
  p_tri text default 'recentes',
  p_avant timestamptz default null,
  p_avant_id uuid default null,
  p_page integer default 0,
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
  v_debut integer := greatest(coalesce(p_page, 0), 0) * least(greatest(coalesce(p_nombre, 20), 1), 50);
  v_general boolean := p_espace = 'general';
  v_parcours uuid;
  v_ids uuid[];
  v_lignes jsonb;
  v_vide constant jsonb := jsonb_build_object('publications', '[]'::jsonb, 'suite', false);
begin
  perform public.exiger_compte_actif();
  if not v_general and p_espace is distinct from 'tous' then
    begin
      v_parcours := p_espace::uuid;
    exception when invalid_text_representation then
      return v_vide;
    end;
    if not public.peut_lire_espace(v_parcours) then
      return v_vide;
    end if;
  end if;

  if p_tri = 'populaires' then
    select array_agg(x.id order by x.score desc, x.cree_le desc, x.id desc) into v_ids
    from (
      select p.id, p.cree_le,
             (select count(*) from public.reactions_publications r where r.publication_id = p.id)
             + 2 * (select count(*) from public.commentaires_publications c where c.publication_id = p.id) as score
      from public.publications p
      where (case when v_general then p.parcours_id is null when v_parcours is not null then p.parcours_id = v_parcours else public.peut_lire_espace(p.parcours_id) end)
        and public.publication_visible(p)
        and p.cree_le > now() - interval '30 days'
      order by score desc, p.cree_le desc, p.id desc
      offset v_debut
      limit v_nombre + 1
    ) x;
  elsif p_tri = 'enregistrees' then
    select array_agg(x.id order by x.enregistree_le desc, x.id desc) into v_ids
    from (
      select p.id, e.cree_le as enregistree_le
      from public.publications_enregistrees e
      join public.publications p on p.id = e.publication_id
      where e.profil_id = (select auth.uid())
        and (case when v_general then p.parcours_id is null when v_parcours is not null then p.parcours_id = v_parcours else public.peut_lire_espace(p.parcours_id) end)
        and public.publication_visible(p)
      order by e.cree_le desc, p.id desc
      offset v_debut
      limit v_nombre + 1
    ) x;
  else
    select array_agg(x.id order by x.cree_le desc, x.id desc) into v_ids
    from (
      select p.id, p.cree_le
      from public.publications p
      where (case when v_general then p.parcours_id is null when v_parcours is not null then p.parcours_id = v_parcours else public.peut_lire_espace(p.parcours_id) end)
        and public.publication_visible(p)
        and (p_avant is null or (p.cree_le, p.id) < (p_avant, coalesce(p_avant_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
      order by p.cree_le desc, p.id desc
      limit v_nombre + 1
    ) x;
  end if;

  select coalesce(jsonb_agg(public.carte_publication(p) order by array_position(v_ids, p.id)), '[]'::jsonb) into v_lignes
  from public.publications p
  where p.id = any (coalesce(v_ids[1:v_nombre], '{}'::uuid[]));

  return jsonb_build_object('publications', v_lignes, 'suite', coalesce(array_length(v_ids, 1), 0) > v_nombre);
end;
$$;

-- ─── Le signet ──────────────────────────────────────────────────────────────────────────────────────
-- Une publication en ligne d'un espace ouvert au compte : le premier clic l'enregistre, le second la retire.
create or replace function public.basculer_enregistrement(p_publication uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
begin
  perform public.publication_ouverte(p_publication);
  delete from public.publications_enregistrees where profil_id = v_moi and publication_id = p_publication;
  if found then
    return false;
  end if;
  insert into public.publications_enregistrees (profil_id, publication_id) values (v_moi, p_publication) on conflict do nothing;
  return true;
end;
$$;

-- ─── La lecture des aperçus ─────────────────────────────────────────────────────────────────────────
-- Chaque page lue par le serveur pour un aperçu est notée : 20 lectures par compte et par 10 minutes au plus. Fermée.
create table if not exists public.lectures_apercu (
  profil_id uuid not null references public.profils (id) on delete cascade,
  cree_le timestamptz not null default now()
);
create index if not exists lectures_apercu_profil_idx on public.lectures_apercu (profil_id, cree_le);
alter table public.lectures_apercu enable row level security;
revoke all on public.lectures_apercu from anon, authenticated;

-- Avant de lire la page d'un lien : les droits de l'appelant d'abord (sa publication pour modifier ; l'espace ouvert et
-- la limite des publications pour publier), puis la limite des lectures. Rend l'aperçu actuel de la publication modifiée,
-- gardé sans lecture si son adresse n'a pas changé, et si une lecture est permise.
create or replace function public.reserver_apercu(p_publication uuid, p_parcours uuid, p_adresse text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
  v public.publications%rowtype;
  v_actuel jsonb;
  v_nombre integer;
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
    v_actuel := v.apercu;
    if v_actuel ->> 'type' = 'lien' and v_actuel ->> 'url' = p_adresse then
      return jsonb_build_object('lire', false, 'actuel', v_actuel);
    end if;
  else
    if not public.peut_lire_espace(p_parcours) then
      raise exception 'Cet espace ne vous est pas ouvert.' using errcode = '42501';
    end if;
    perform public.limiter_debit(false);
  end if;
  select count(*) into v_nombre from public.lectures_apercu where profil_id = v_moi and cree_le > now() - interval '10 minutes';
  if v_nombre >= 20 then
    return jsonb_build_object('lire', false, 'actuel', v_actuel);
  end if;
  delete from public.lectures_apercu where profil_id = v_moi and cree_le < now() - interval '1 day';
  insert into public.lectures_apercu (profil_id) values (v_moi);
  return jsonb_build_object('lire', true, 'actuel', v_actuel);
end;
$$;

-- ─── La colonne de droite ───────────────────────────────────────────────────────────────────────────
-- Les 5 publications des 7 derniers jours les plus aimées et commentées (au moins une fois), dans les espaces ouverts.
create or replace function public.publications_tendances()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  return coalesce((
    select jsonb_agg(y.carte order by y.score desc, y.cree_le desc, y.id desc)
    from (
    select x.* from (
      select p.id, p.cree_le,
             (select count(*) from public.reactions_publications r where r.publication_id = p.id)
             + (select count(*) from public.commentaires_publications c where c.publication_id = p.id) as score,
             jsonb_build_object(
               'id', p.id,
               'extrait', left(coalesce(nullif(p.titre, ''), p.texte), 160),
               'auteur', jsonb_build_object(
                 'nom_court', public.nom_avis(pr.prenom, pr.nom),
                 'initiales', public.initiales_avis(pr.prenom, pr.nom),
                 'equipe', coalesce(public.role_communaute(p.auteur) = 'equipe', false)
               )
             ) as carte
      from public.publications p
      join public.profils pr on pr.id = p.auteur
      where p.statut = 'publiee' and p.cree_le > now() - interval '7 days' and public.peut_lire_espace(p.parcours_id)
    ) x
    where x.score > 0
    order by x.score desc, x.cree_le desc, x.id desc
    limit 5
    ) y
  ), '[]'::jsonb);
end;
$$;

-- Les 6 dernières publications ou commentaires, dans les espaces ouverts au compte (publications en ligne seulement).
create or replace function public.activites_recentes()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'type', a.type,
        'publication_id', a.publication_id,
        'auteur', jsonb_build_object('nom_court', public.nom_avis(pr.prenom, pr.nom), 'initiales', public.initiales_avis(pr.prenom, pr.nom)),
        'extrait', a.extrait,
        'cree_le', a.cree_le
      )
      order by a.cree_le desc
    )
    from (
      (
        select 'publication' as type, p.id as publication_id, p.auteur, p.cree_le, left(coalesce(nullif(p.titre, ''), p.texte), 80) as extrait
        from public.publications p
        where p.statut = 'publiee' and public.peut_lire_espace(p.parcours_id)
        order by p.cree_le desc
        limit 6
      )
      union all
      (
        select 'commentaire', p.id, c.auteur, c.cree_le, left(coalesce(nullif(p.titre, ''), p.texte), 80)
        from public.commentaires_publications c
        join public.publications p on p.id = c.publication_id
        where p.statut = 'publiee' and public.peut_lire_espace(p.parcours_id)
        order by c.cree_le desc
        limit 6
      )
      order by cree_le desc
      limit 6
    ) a
    join public.profils pr on pr.id = a.auteur
  ), '[]'::jsonb);
end;
$$;

-- ─── L'annonce épinglée ─────────────────────────────────────────────────────────────────────────────
-- Une seule, réglée par l'équipe au back-office ; en haut du fil « Actualités ». Fermée : tout passe par les fonctions.
create table if not exists public.annonce_communaute (
  id boolean primary key default true check (id),
  active boolean not null default false,
  titre text not null default '',
  texte text not null default '',
  media text,
  youtube_id text,
  image_chemin text,
  public text not null default 'tous',
  parcours_id uuid references public.parcours (id) on delete set null,
  modifiee_le timestamptz not null default now(),
  constraint annonce_titre check (char_length(titre) <= 120),
  constraint annonce_texte check (char_length(texte) <= 500),
  constraint annonce_media check (media is null or media in ('youtube', 'image')),
  constraint annonce_public check (public in ('tous', 'parcours'))
);
alter table public.annonce_communaute enable row level security;
revoke all on public.annonce_communaute from anon, authenticated;
insert into public.annonce_communaute (id) values (true) on conflict (id) do nothing;

-- L'annonce, telle que la voit le compte qui demande : null si elle est inactive ou réservée à un parcours qu'il ne lit pas.
create or replace function public.annonce_visible(a public.annonce_communaute)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select a.active
    and (select auth.uid()) is not null
    and not public.compte_suspendu()
    and (a.public = 'tous' or (a.parcours_id is not null and public.peut_lire_espace(a.parcours_id)));
$$;

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
  return jsonb_build_object('titre', a.titre, 'texte', a.texte, 'media', a.media, 'youtube_id', a.youtube_id, 'image_chemin', a.image_chemin);
end;
$$;

-- Le réglage complet, pour le back-office.
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
    'image_chemin', a.image_chemin, 'public', a.public, 'parcours_id', a.parcours_id, 'modifiee_le', a.modifiee_le
  );
end;
$$;

-- Enregistrer l'annonce (équipe). Une nouvelle affiche est une image déposée par ce compte dans son dossier de l'espace
-- « communaute » ; l'affiche déjà enregistrée se garde, quel que soit le membre de l'équipe qui enregistre.
create or replace function public.enregistrer_annonce(
  p_active boolean, p_titre text, p_texte text, p_media text, p_youtube_id text, p_image_chemin text, p_public text, p_parcours uuid
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
      modifiee_le = now()
  where id;
end;
$$;

-- Retirer l'annonce : inactive et vidée. Rend le chemin de l'ancienne affiche, à retirer du stockage.
create or replace function public.retirer_annonce()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chemin text;
begin
  perform public.exiger_equipe_moderation();
  select image_chemin into v_chemin from public.annonce_communaute where id;
  update public.annonce_communaute
  set active = false, titre = '', texte = '', media = null, youtube_id = null, image_chemin = null,
      public = 'tous', parcours_id = null, modifiee_le = now()
  where id;
  return v_chemin;
end;
$$;

-- Un fichier se lit si une publication en ligne d'un espace ouvert l'attache, ou si c'est l'affiche de l'annonce visible.
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
  ) or exists (
    select 1 from public.annonce_communaute a
    where a.image_chemin = p_nom and public.annonce_visible(a)
  );
$$;

-- ─── Droits d'exécution ─────────────────────────────────────────────────────────────────────────────
revoke execute on function public.verifier_apercu(jsonb, text) from public, anon, authenticated;
revoke execute on function public.publier(uuid, text, text, jsonb, jsonb, jsonb) from public, anon;
revoke execute on function public.modifier_publication(uuid, text, text, jsonb, jsonb) from public, anon;
revoke execute on function public.fil_communaute(text, text, timestamptz, uuid, integer, integer) from public, anon;
revoke execute on function public.basculer_enregistrement(uuid) from public, anon;
revoke execute on function public.reserver_apercu(uuid, uuid, text) from public, anon;
revoke execute on function public.publications_tendances() from public, anon;
revoke execute on function public.activites_recentes() from public, anon;
grant execute on function public.publier(uuid, text, text, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.modifier_publication(uuid, text, text, jsonb, jsonb) to authenticated;
grant execute on function public.fil_communaute(text, text, timestamptz, uuid, integer, integer) to authenticated;
grant execute on function public.basculer_enregistrement(uuid) to authenticated;
grant execute on function public.reserver_apercu(uuid, uuid, text) to authenticated;
grant execute on function public.publications_tendances() to authenticated;
grant execute on function public.activites_recentes() to authenticated;
revoke execute on function public.annonce_visible(public.annonce_communaute) from public, anon, authenticated;
revoke execute on function public.annonce_communaute() from public, anon;
revoke execute on function public.annonce_equipe() from public, anon;
revoke execute on function public.enregistrer_annonce(boolean, text, text, text, text, text, text, uuid) from public, anon;
revoke execute on function public.retirer_annonce() from public, anon;
grant execute on function public.annonce_communaute() to authenticated;
grant execute on function public.annonce_equipe() to authenticated;
grant execute on function public.enregistrer_annonce(boolean, text, text, text, text, text, text, uuid) to authenticated;
grant execute on function public.retirer_annonce() to authenticated;

commit;

-- ═══ 0022_communaute_video.sql ═══
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

-- ─── La file de modération : la vidéo en plus (l'équipe la voit avant de garder ou de rétablir) ─────
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
    'video', p.video,
    'statut', p.statut,
    'analyse', p.verdict,
    'extrait', null,
    'signalements', public.resume_signalements(p.id, null)
  )
  from public.profils pr
  where pr.id = p.auteur;
$$;

-- ─── Droits d'exécution ─────────────────────────────────────────────────────────────────────────────
revoke execute on function public.verifier_video(jsonb) from public, anon, authenticated;
revoke execute on function public.publier(uuid, text, text, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.publier(uuid, text, text, jsonb, jsonb, jsonb, jsonb) to authenticated;

commit;

-- ═══ 0023_sessions_rappels.sql ═══
-- Étudium · migration 0023 : rappel 10 min avant et annonce du début du live à tous (spec Formations et Événements, §3.2).
-- À appliquer dans Supabase, après la 0022 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancée, elle ne change rien et ne casse rien. Si la 0018 est rejouée un jour, rejouer celle-ci ensuite.
-- Avant, un rappel n'était créé que lorsque l'inscrit lui-même chargeait une page. Désormais, traiter_sessions_live()
-- traite toutes les sessions et tous les inscrits : toutes les minutes par la base (pg_cron), et à chaque chargement de
-- la cloche par n'importe quel compte (filet si la tâche planifiée manque).

begin;

-- ─── Suivi des nouveaux envois ──────────────────────────────────────────────────────────────────────
alter table public.inscriptions_sessions add column if not exists rappel_dix_le timestamptz;
-- À la première application seulement, les sessions déjà commencées ne sont pas annoncées après coup (rejouée plus
-- tard, la migration ne retire pas l'annonce d'un live en cours).
do $colonne$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sessions_live' and column_name = 'debut_annonce_le'
  ) then
    alter table public.sessions_live add column debut_annonce_le timestamptz;
    update public.sessions_live set debut_annonce_le = now() where debut <= now();
  end if;
end
$colonne$;

-- ─── Le traitement de toutes les sessions ───────────────────────────────────────────────────────────
-- Chaque envoi est d'abord réservé (update … where … is null returning), puis envoyé : deux traitements simultanés
-- (tâche planifiée et cloche) n'envoient jamais deux fois la même notification.
create or replace function public.traiter_sessions_live()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre integer := 0;
  r record;
begin
  -- Un traitement à la fois : un appel qui en trouve un en cours repart aussitôt (la tâche planifiée repasse dans la
  -- minute), sans attendre ni rien perdre.
  if not pg_try_advisory_xact_lock(hashtext('etudium.traiter_sessions_live')) then
    return 0;
  end if;
  -- Les sessions proches sont figées le temps du traitement : un report ou une annulation en cours est d'abord validé
  -- (les envois qui suivent voient la nouvelle heure), ou attend la fin du traitement.
  perform 1 from public.sessions_live
  where statut = 'programmee' and debut > now() - interval '4 hours' and debut <= now() + interval '24 hours'
  for share;

  -- Le début du live : tous les comptes (équipe et non-inscrits compris), une fois, tant que la session est en cours
  -- (4 h au plus : la durée maximale d'une session).
  for r in
    update public.sessions_live s
    set debut_annonce_le = now()
    where s.statut = 'programmee' and s.debut_annonce_le is null
      and s.debut > now() - interval '4 hours'
      and s.debut <= now() and s.debut + make_interval(mins => s.duree_minutes) > now()
    returning s.titre, s.formateur_id
  loop
    v_nombre := v_nombre + public.notifier(
      array(select id from public.profils), 'sessions_live', 'C’est l’heure du live : ' || r.titre,
      'La session vient de commencer avec ' || public.animateur_session(r.formateur_id) || '. Rejoignez-la depuis la page Événements.',
      '/evenements', true
    );
  end loop;

  -- 10 min avant : les inscrits (le lien vient de s'ouvrir). Les rappels plus anciens qui n'ont pas pu partir sont clos.
  for r in
    update public.inscriptions_sessions i
    set rappel_dix_le = now(), rappel_heure_le = coalesce(i.rappel_heure_le, now()), rappel_veille_le = coalesce(i.rappel_veille_le, now())
    from public.sessions_live s
    where s.id = i.session_id and s.statut = 'programmee' and i.rappel_dix_le is null
      and s.debut > now() and s.debut <= now() + interval '10 minutes'
    returning i.profil_id, s.titre, s.debut
  loop
    v_nombre := v_nombre + public.notifier(
      array[r.profil_id], 'sessions_live', 'Session live dans 10 minutes',
      r.titre || ', à ' || public.heure_session(r.debut) || '. Le lien est ouvert : rejoignez la session depuis la page Événements.',
      '/evenements', true
    );
  end loop;

  -- 1 h avant (entre 10 min et 1 h).
  for r in
    update public.inscriptions_sessions i
    set rappel_heure_le = now(), rappel_veille_le = coalesce(i.rappel_veille_le, now())
    from public.sessions_live s
    where s.id = i.session_id and s.statut = 'programmee' and i.rappel_heure_le is null and i.rappel_dix_le is null
      and s.debut > now() + interval '10 minutes' and s.debut <= now() + interval '1 hour'
    returning i.profil_id, s.titre, s.debut
  loop
    v_nombre := v_nombre + public.notifier(
      array[r.profil_id], 'sessions_live', 'Session live dans moins d’une heure',
      r.titre || ', à ' || public.heure_session(r.debut) || '. Le lien s’ouvre 10 min avant.', '/evenements', true
    );
  end loop;

  -- La veille (entre 1 h et 24 h) : « aujourd’hui » ou « demain » selon le jour au Bénin.
  for r in
    update public.inscriptions_sessions i
    set rappel_veille_le = now()
    from public.sessions_live s
    where s.id = i.session_id and s.statut = 'programmee'
      and i.rappel_veille_le is null and i.rappel_heure_le is null and i.rappel_dix_le is null
      and s.debut > now() + interval '1 hour' and s.debut <= now() + interval '24 hours'
    returning i.profil_id, s.titre, s.debut
  loop
    v_nombre := v_nombre + public.notifier(
      array[r.profil_id], 'sessions_live',
      case
        when ((r.debut at time zone 'UTC') + interval '1 hour')::date = ((now() at time zone 'UTC') + interval '1 hour')::date
        then 'Session live aujourd’hui'
        else 'Session live demain'
      end,
      r.titre || ', à ' || public.heure_session(r.debut) || '.', '/evenements', true
    );
  end loop;

  return v_nombre;
end;
$$;

-- La cloche le demande en se chargeant : le traitement de toutes les sessions, pas seulement celles du compte.
create or replace function public.rappels_sessions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  return public.traiter_sessions_live();
end;
$$;

-- ─── S'inscrire : le rappel 10 min est marqué envoyé s'il est déjà passé ─────────────────────────────
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
  insert into public.inscriptions_sessions (session_id, profil_id, rappel_veille_le, rappel_heure_le, rappel_dix_le)
  values (
    p_session,
    (select auth.uid()),
    case when now() >= v.debut - interval '24 hours' then now() end,
    case when now() >= v.debut - interval '1 hour' then now() end,
    case when now() >= v.debut - interval '10 minutes' then now() end
  )
  on conflict do nothing;
end;
$$;

-- ─── Une session déplacée : ses rappels et son annonce repartent de zéro ─────────────────────────────
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
    update public.inscriptions_sessions set rappel_veille_le = null, rappel_heure_le = null, rappel_dix_le = null where session_id = p_session;
    update public.sessions_live set debut_annonce_le = null where id = p_session;
  end if;
  if v_heure_changee or p_duree is distinct from v.duree_minutes or v_lien is distinct from v.lien then
    perform public.notifier(
      array(select profil_id from public.inscriptions_sessions where session_id = p_session), 'sessions_live',
      'Session live modifiée', v_titre || ' : ' || public.quand_session(p_debut) || '.', '/evenements'
    );
  end if;
end;
$$;

-- ─── Droits d'exécution ─────────────────────────────────────────────────────────────────────────────
revoke execute on function public.traiter_sessions_live() from public, anon, authenticated;
revoke execute on function public.rappels_sessions() from public, anon;
grant execute on function public.rappels_sessions() to authenticated;
revoke execute on function public.sinscrire_session(uuid) from public, anon;
grant execute on function public.sinscrire_session(uuid) to authenticated;
revoke execute on function public.modifier_session(uuid, text, text, timestamptz, integer, text, uuid, uuid) from public, anon;
grant execute on function public.modifier_session(uuid, text, text, timestamptz, integer, text, uuid, uuid) to authenticated;

commit;

-- ─── La tâche planifiée (pg_cron) : toutes les minutes ──────────────────────────────────────────────
-- Hors de la transaction : sans pg_cron (extension indisponible), un simple avertissement, la migration reste appliquée.
-- Dans ce cas : Supabase → Integrations → Cron → Enable, puis relancer ce seul bloc.
do $cron$
begin
  begin
    create extension if not exists pg_cron with schema pg_catalog;
  exception when others then
    raise notice 'pg_cron indisponible (%) : activez Cron dans Supabase, puis relancez ce bloc.', sqlerrm;
    return;
  end;
  -- Même nom : la tâche est remplacée, jamais doublée. L'historique des passages (1 440 par jour) est purgé chaque
  -- nuit au-delà de 7 jours. Un refus (droits sur le schéma cron) reste un avertissement : la migration est appliquée.
  begin
    perform cron.schedule('etudium-sessions-live', '* * * * *', 'select public.traiter_sessions_live()');
    perform cron.schedule('etudium-purge-cron', '30 3 * * *', $purge$delete from cron.job_run_details where end_time < now() - interval '7 days'$purge$);
  exception when others then
    raise notice 'Tâche planifiée non créée (%) : voir le guide « Ce qui te revient », section 28.', sqlerrm;
  end;
end
$cron$;

-- ═══ 0024_sessions_promotion.sql ═══
-- Étudium · migration 0024 : promotion des sessions live (spec 2026-10-14-sessions-promotion-design).
-- À appliquer dans Supabase, après la 0023 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable. Si la 0018, la 0022 ou la 0023 est rejouée un jour, rejouer celle-ci ensuite.
-- Une session programmée paraît dans la communauté avec son visuel (affiche ou vidéo) et son bloc ; « nouvelles
-- sessions » compte celles programmées depuis la dernière visite de la page Événements (pastille rouge).

begin;

-- ─── Colonnes ───────────────────────────────────────────────────────────────────────────────────────
-- L'affiche : une pièce jointe de la communauté ({chemin, nom, type, taille}) ; la vidéo : le format de verifier_video.
alter table public.sessions_live add column if not exists promo_image jsonb;
alter table public.sessions_live add column if not exists promo_video jsonb;
alter table public.sessions_live add column if not exists publication_id uuid references public.publications (id) on delete set null;
alter table public.publications add column if not exists session_id uuid references public.sessions_live (id) on delete set null;
create unique index if not exists publications_session_idx on public.publications (session_id) where session_id is not null;
create index if not exists sessions_live_publication_idx on public.sessions_live (publication_id);
alter table public.profils add column if not exists evenements_vus_le timestamptz;

-- ─── Le visuel de promotion : une affiche (image) ou une vidéo, vérifiées comme dans la communauté ──
create or replace function public.verifier_promotion(p_image jsonb, p_video jsonb, p_image_actuelle jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_image jsonb := case when p_image is null or jsonb_typeof(p_image) = 'null' then null else p_image end;
  v_video jsonb := case when p_video is null or jsonb_typeof(p_video) = 'null' then null else p_video end;
begin
  if v_image is not null and v_video is not null then
    raise exception 'Choisissez une affiche ou une vidéo, pas les deux.';
  end if;
  if v_image is not null then
    if coalesce(v_image ->> 'type', '') not in ('image/jpeg', 'image/png', 'image/webp') then
      raise exception 'L’affiche doit être une image (JPG, PNG ou WebP).';
    end if;
    if p_image_actuelle is not null and v_image ->> 'chemin' = p_image_actuelle ->> 'chemin' then
      v_image := p_image_actuelle;
    else
      v_image := public.verifier_piece(v_image);
    end if;
  end if;
  -- Le lien d'un live (Google Meet, Zoom) reste réservé à sa fenêtre de 10 min : jamais en vidéo de promotion.
  if v_video is not null and public.plateforme_session(coalesce(v_video ->> 'url', '')) <> 'En ligne' then
    raise exception 'Le lien du live ne peut pas servir de vidéo de promotion.';
  end if;
  return jsonb_build_object('image', v_image, 'video', public.verifier_video(v_video));
end;
$$;

-- ─── L'espace de la publication d'une session ───────────────────────────────────────────────────────
-- Un parcours actif, et un espace ouvert au compte : un formateur publie dans les espaces de ses formations.
create or replace function public.verifier_espace_session(p_parcours uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_parcours is not null and not exists (select 1 from public.parcours where id = p_parcours and actif) then
    raise exception 'Ce parcours n’est plus proposé.';
  end if;
  if not public.peut_lire_espace(p_parcours) then
    raise exception 'Cet espace ne vous est pas ouvert.' using errcode = '42501';
  end if;
end;
$$;

-- La publication d'une session supprimée : son affiche part avec elle (le fichier est retiré du stockage), la session
-- ne la désigne plus.
create or replace function public.apres_suppression_publication_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.session_id is not null then
    update public.sessions_live set promo_image = null where id = old.session_id and promo_image is not null;
  end if;
  return null;
end;
$$;

drop trigger if exists publications_session_supprimee on public.publications;
create trigger publications_session_supprimee after delete on public.publications
  for each row execute function public.apres_suppression_publication_session();

-- ─── Programmer : la publication en plus ────────────────────────────────────────────────────────────
drop function if exists public.creer_session(text, text, timestamptz, integer, text, uuid, uuid);
create or replace function public.creer_session(
  p_titre text,
  p_description text,
  p_debut timestamptz,
  p_duree integer,
  p_lien text,
  p_parcours uuid,
  p_formateur uuid,
  p_image jsonb default null,
  p_video jsonb default null
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
  v_promo jsonb;
  v_publication uuid;
begin
  if not v_equipe and v_fiche is null then
    raise exception 'Accès réservé aux formateurs et à l’équipe.' using errcode = '42501';
  end if;
  v_formateur := case when v_equipe then p_formateur else v_fiche end;
  if v_formateur is not null and not exists (select 1 from public.formateurs where id = v_formateur) then
    raise exception 'Cette fiche formateur n’existe plus.';
  end if;
  perform public.verifier_session(v_titre, v_description, p_debut, p_duree, v_lien, true);
  v_promo := public.verifier_promotion(p_image, p_video, null);
  perform public.verifier_espace_session(p_parcours);

  insert into public.sessions_live (titre, description, debut, duree_minutes, lien, parcours_id, formateur_id, cree_par, promo_image, promo_video)
  values (v_titre, v_description, p_debut, p_duree, v_lien, p_parcours, v_formateur, (select auth.uid()),
          nullif(v_promo -> 'image', 'null'::jsonb), nullif(v_promo -> 'video', 'null'::jsonb))
  returning id into v_id;

  -- La session paraît aussitôt dans la communauté (espace de son parcours, Général pour tous les parcours).
  insert into public.publications (auteur, parcours_id, titre, texte, piece_jointe, video, statut, session_id)
  values ((select auth.uid()), p_parcours, v_titre, coalesce(nullif(v_description, ''), 'Session live programmée.'),
          nullif(v_promo -> 'image', 'null'::jsonb), nullif(v_promo -> 'video', 'null'::jsonb), 'publiee', v_id)
  returning id into v_publication;
  update public.sessions_live set publication_id = v_publication where id = v_id;

  perform public.notifier(
    array(select id from public.profils), 'sessions_live', 'Nouvelle session live : ' || v_titre,
    public.majuscule(public.quand_session(p_debut)) || ', avec ' || public.animateur_session(v_formateur) || '.', '/evenements'
  );
  return v_id;
end;
$$;

-- ─── Modifier : le visuel et la publication suivent ─────────────────────────────────────────────────
drop function if exists public.modifier_session(uuid, text, text, timestamptz, integer, text, uuid, uuid);
create or replace function public.modifier_session(
  p_session uuid,
  p_titre text,
  p_description text,
  p_debut timestamptz,
  p_duree integer,
  p_lien text,
  p_parcours uuid,
  p_formateur uuid,
  p_image jsonb default null,
  p_video jsonb default null
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
  v_promo jsonb;
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
  -- La même affiche que la session est gardée telle quelle (elle est déjà jointe à sa publication).
  v_promo := public.verifier_promotion(p_image, p_video, v.promo_image);
  if p_parcours is distinct from v.parcours_id then
    perform public.verifier_espace_session(p_parcours);
  end if;
  if v_equipe and p_formateur is not null and not exists (select 1 from public.formateurs where id = p_formateur) then
    raise exception 'Cette fiche formateur n’existe plus.';
  end if;

  update public.sessions_live
  set titre = v_titre, description = v_description, debut = p_debut, duree_minutes = p_duree, lien = v_lien,
      parcours_id = p_parcours, formateur_id = case when v_equipe then p_formateur else v.formateur_id end,
      promo_image = nullif(v_promo -> 'image', 'null'::jsonb), promo_video = nullif(v_promo -> 'video', 'null'::jsonb)
  where id = p_session;
  update public.publications
  set parcours_id = p_parcours, titre = v_titre, texte = coalesce(nullif(v_description, ''), 'Session live programmée.'),
      piece_jointe = nullif(v_promo -> 'image', 'null'::jsonb), video = nullif(v_promo -> 'video', 'null'::jsonb), modifie_le = now()
  where session_id = p_session;

  if v_heure_changee then
    update public.inscriptions_sessions set rappel_veille_le = null, rappel_heure_le = null, rappel_dix_le = null where session_id = p_session;
    update public.sessions_live set debut_annonce_le = null where id = p_session;
  end if;
  if v_heure_changee or p_duree is distinct from v.duree_minutes or v_lien is distinct from v.lien then
    perform public.notifier(
      array(select profil_id from public.inscriptions_sessions where session_id = p_session), 'sessions_live',
      'Session live modifiée', v_titre || ' : ' || public.quand_session(p_debut) || '.', '/evenements'
    );
  end if;
end;
$$;

-- ─── La fiche d'une session : son visuel en plus ────────────────────────────────────────────────────
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
    'promo_image', v.promo_image,
    'promo_video', v.promo_video,
    'inscrits', coalesce((
      select jsonb_agg(jsonb_build_object('prenom', coalesce(p.prenom, ''), 'nom', coalesce(p.nom, '')) order by i.inscrit_le)
      from public.inscriptions_sessions i
      join public.profils p on p.id = i.profil_id
      where i.session_id = v.id
    ), '[]'::jsonb)
  );
end;
$$;

-- ─── La carte d'une publication : le bloc de sa session ─────────────────────────────────────────────
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
    -- Le bloc d'une session programmée (jamais son lien, réservé à sa fenêtre de 10 min).
    'session', (
      select jsonb_build_object(
        'id', s.id, 'debut', s.debut, 'duree_minutes', s.duree_minutes, 'plateforme', public.plateforme_session(s.lien),
        'animateur', public.animateur_session(s.formateur_id), 'statut', s.statut,
        'inscriptions', (select count(*)::int from public.inscriptions_sessions i where i.session_id = s.id),
        'inscrit', exists (select 1 from public.inscriptions_sessions i where i.session_id = s.id and i.profil_id = (select auth.uid()))
      )
      from public.sessions_live s where s.id = p.session_id
    ),
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

-- ─── Nouvelles sessions (pastille rouge) ────────────────────────────────────────────────────────────
-- Programmées depuis la dernière visite de la page Événements, à venir ou en cours, pas annulées, pas les siennes.
create or replace function public.nouvelles_sessions()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.sessions_live s
  where s.statut = 'programmee'
    and s.debut + make_interval(mins => s.duree_minutes) > now()
    and s.cree_par is distinct from (select auth.uid())
    and s.cree_le > coalesce((select p.evenements_vus_le from public.profils p where p.id = (select auth.uid())), '-infinity'::timestamptz);
$$;

create or replace function public.marquer_evenements_vus()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  update public.profils set evenements_vus_le = now() where id = (select auth.uid());
end;
$$;

-- ─── Droits d'exécution ─────────────────────────────────────────────────────────────────────────────
revoke execute on function public.verifier_promotion(jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.verifier_espace_session(uuid) from public, anon, authenticated;
revoke execute on function public.apres_suppression_publication_session() from public, anon, authenticated;
revoke execute on function public.creer_session(text, text, timestamptz, integer, text, uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.creer_session(text, text, timestamptz, integer, text, uuid, uuid, jsonb, jsonb) to authenticated;
revoke execute on function public.modifier_session(uuid, text, text, timestamptz, integer, text, uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.modifier_session(uuid, text, text, timestamptz, integer, text, uuid, uuid, jsonb, jsonb) to authenticated;
revoke execute on function public.session_detail(uuid) from public, anon;
grant execute on function public.session_detail(uuid) to authenticated;
revoke execute on function public.nouvelles_sessions() from public, anon;
grant execute on function public.nouvelles_sessions() to authenticated;
revoke execute on function public.marquer_evenements_vus() from public, anon;
grant execute on function public.marquer_evenements_vus() to authenticated;

commit;

-- ═══ 0025_communaute_commentaires.sql ═══
-- Étudium · migration 0025 : les commentaires (communauté v3, étape 2) — répondre (un seul niveau), J’aime, modifier.
-- À appliquer dans Supabase, après la 0024 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable. Si la 0019, la 0020 ou la 0024 est rejouée un jour, rejouer celle-ci ensuite.

begin;

-- ─── Colonnes et table ──────────────────────────────────────────────────────────────────────────────
-- Une réponse vise un commentaire de premier niveau ; supprimer un commentaire supprime ses réponses.
alter table public.commentaires_publications add column if not exists parent_id uuid references public.commentaires_publications (id) on delete cascade;
alter table public.commentaires_publications add column if not exists modifie_le timestamptz;
create index if not exists commentaires_parent_idx on public.commentaires_publications (parent_id);

-- « J’aime » d'un commentaire : une fois par compte. Fermée aux comptes : tout passe par les fonctions.
create table if not exists public.reactions_commentaires (
  commentaire_id uuid not null references public.commentaires_publications (id) on delete cascade,
  profil_id uuid not null references public.profils (id) on delete cascade,
  cree_le timestamptz not null default now(),
  primary key (commentaire_id, profil_id)
);
create index if not exists reactions_commentaires_profil_idx on public.reactions_commentaires (profil_id);
alter table public.reactions_commentaires enable row level security;
revoke all on public.reactions_commentaires from anon, authenticated;

-- ─── Commenter : le commentaire parent ──────────────────────────────────────────────────────────────
drop function if exists public.commenter(uuid, text);
create or replace function public.commenter(p_publication uuid, p_texte text, p_parent uuid default null)
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
  v_parent public.commentaires_publications%rowtype;
begin
  if char_length(v_texte) not between 1 and 1000 then
    raise exception 'Écrivez votre réponse (1 000 caractères au plus).';
  end if;
  if p_parent is not null then
    select * into v_parent from public.commentaires_publications where id = p_parent and publication_id = p_publication;
    if not found then
      raise exception 'Ce commentaire n’existe plus.';
    end if;
    -- Un seul niveau : répondre à une réponse répond au même commentaire.
    if v_parent.parent_id is not null then
      select * into v_parent from public.commentaires_publications where id = v_parent.parent_id;
    end if;
  end if;
  perform public.limiter_debit(true);
  insert into public.commentaires_publications (publication_id, auteur, texte, parent_id)
  values (p_publication, (select auth.uid()), v_texte, v_parent.id)
  returning id into v_id;
  select public.nom_avis(prenom, nom) into v_nom from public.profils where id = (select auth.uid());
  -- L'auteur du commentaire auquel on répond est prévenu ; l'auteur de la publication aussi, sauf si c'est le même.
  if v_parent.id is not null then
    perform public.notifier(
      array[v_parent.auteur], 'communaute', 'Nouvelle réponse à votre commentaire',
      v_nom || ' a répondu à votre commentaire dans l’espace ' || public.nom_espace_communaute(v.parcours_id) || '.',
      '/communaute/publications/' || v.id || '#commentaire-' || v_id
    );
  end if;
  perform public.notifier(
    array(select v.auteur where v.auteur is distinct from v_parent.auteur), 'communaute', 'Nouvelle réponse',
    v_nom || ' a répondu à votre publication dans l’espace ' || public.nom_espace_communaute(v.parcours_id) || '.',
    '/communaute/publications/' || v.id || '#commentaire-' || v_id
  );
  return v_id;
end;
$$;

-- ─── Modifier un commentaire : son auteur ou l'équipe ───────────────────────────────────────────────
create or replace function public.modifier_commentaire(p_id uuid, p_texte text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.commentaires_publications%rowtype;
  v_texte text := regexp_replace(coalesce(p_texte, ''), '^\s+|\s+$', '', 'g');
begin
  perform public.exiger_compte_actif();
  select * into v from public.commentaires_publications where id = p_id for update;
  if not found then
    raise exception 'Ce commentaire n’existe plus.';
  end if;
  perform public.publication_ouverte(v.publication_id);
  if v.auteur <> (select auth.uid()) and not public.equipe_contenus() then
    raise exception 'Ce commentaire n’est pas le vôtre.' using errcode = '42501';
  end if;
  if char_length(v_texte) not between 1 and 1000 then
    raise exception 'Écrivez votre commentaire (1 000 caractères au plus).';
  end if;
  -- Le même texte : rien ne change, pas de « modifié ».
  if v_texte = v.texte then
    return;
  end if;
  update public.commentaires_publications set texte = v_texte, modifie_le = now() where id = p_id;
end;
$$;

-- ─── « J’aime » d'un commentaire : le premier clic l'ajoute, le second le retire ───────────────────
create or replace function public.basculer_reaction_commentaire(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
  v_publication uuid;
  v_aime boolean;
begin
  select publication_id into v_publication from public.commentaires_publications where id = p_id;
  if not found then
    raise exception 'Ce commentaire n’existe plus.';
  end if;
  perform public.publication_ouverte(v_publication);
  delete from public.reactions_commentaires where commentaire_id = p_id and profil_id = v_moi;
  if found then
    v_aime := false;
  else
    insert into public.reactions_commentaires (commentaire_id, profil_id) values (p_id, v_moi) on conflict do nothing;
    v_aime := true;
  end if;
  return jsonb_build_object(
    'j_aime', v_aime,
    'reactions', (select count(*)::int from public.reactions_commentaires where commentaire_id = p_id)
  );
end;
$$;

-- ─── La carte d'un commentaire : parent, J’aime, modifié, droits ────────────────────────────────────
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
    'parent_id', c.parent_id,
    'modifie', c.modifie_le is not null,
    'reactions', (select count(*)::int from public.reactions_commentaires r where r.commentaire_id = c.id),
    'j_aime', exists (select 1 from public.reactions_commentaires r where r.commentaire_id = c.id and r.profil_id = (select auth.uid())),
    'peut_modifier', c.auteur = (select auth.uid()) or public.equipe_contenus(),
    'peut_supprimer', c.auteur = (select auth.uid()) or public.equipe_contenus(),
    'peut_signaler', c.auteur <> (select auth.uid()) and not public.equipe_contenus()
  )
  from public.profils pr
  where pr.id = c.auteur;
$$;

-- ─── Supprimer un commentaire : rend le nombre retiré (lui et ses réponses), pour le compteur de la carte ─────
drop function if exists public.supprimer_commentaire(uuid);
create or replace function public.supprimer_commentaire(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.commentaires_publications%rowtype;
  v_nombre integer;
begin
  perform public.exiger_compte_actif();
  select * into v from public.commentaires_publications where id = p_id;
  if not found then
    return 0;
  end if;
  perform public.publication_ouverte(v.publication_id);
  if v.auteur <> (select auth.uid()) and not public.equipe_contenus() then
    raise exception 'Cette réponse n’est pas la vôtre.' using errcode = '42501';
  end if;
  select count(*) + 1 into v_nombre from public.commentaires_publications where parent_id = p_id;
  delete from public.commentaires_publications where id = p_id;
  return v_nombre;
end;
$$;

-- ─── La carte d'une publication : les 2 derniers commentaires de premier niveau ─────────────────────
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
    -- Le bloc d'une session programmée (jamais son lien, réservé à sa fenêtre de 10 min).
    'session', (
      select jsonb_build_object(
        'id', s.id, 'debut', s.debut, 'duree_minutes', s.duree_minutes, 'plateforme', public.plateforme_session(s.lien),
        'animateur', public.animateur_session(s.formateur_id), 'statut', s.statut,
        'inscriptions', (select count(*)::int from public.inscriptions_sessions i where i.session_id = s.id),
        'inscrit', exists (select 1 from public.inscriptions_sessions i where i.session_id = s.id and i.profil_id = (select auth.uid()))
      )
      from public.sessions_live s where s.id = p.session_id
    ),
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
        where c.publication_id = p.id and c.parent_id is null
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
revoke execute on function public.commenter(uuid, text, uuid) from public, anon;
grant execute on function public.commenter(uuid, text, uuid) to authenticated;
revoke execute on function public.modifier_commentaire(uuid, text) from public, anon;
grant execute on function public.modifier_commentaire(uuid, text) to authenticated;
revoke execute on function public.basculer_reaction_commentaire(uuid) from public, anon;
grant execute on function public.basculer_reaction_commentaire(uuid) to authenticated;
revoke execute on function public.supprimer_commentaire(uuid) from public, anon;
grant execute on function public.supprimer_commentaire(uuid) to authenticated;

commit;

-- ═══ 0026_communaute_sondages.sql ═══
-- Étudium · migration 0026 : sondages, quiz et publications programmées (spec 2026-10-14-publication-sondages-quiz-
-- programmation-design, validée le 14 octobre).
-- À appliquer dans Supabase, après la 0025 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable. Si une migration de la communauté (0019 à 0025) est rejouée un jour, rejouer celle-ci ensuite.
-- Une publication programmée prend son heure de parution pour date (cree_le dans le futur) : invisible des autres et sans
-- interaction jusque-là, elle paraît ensuite en haut du fil. Les résultats d'un sondage et la bonne réponse d'un quiz ne
-- sont rendus qu'à qui y a droit (après avoir voté ou répondu, sondage terminé, son auteur, l'équipe).

begin;

-- ─── Tables ─────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.sondages (
  publication_id uuid primary key references public.publications (id) on delete cascade,
  type text not null,
  choix_multiples boolean not null default false,
  fin_le timestamptz,
  explication text,
  constraint sondages_type check (type in ('texte', 'images', 'quiz')),
  constraint sondages_explication check (explication is null or char_length(explication) <= 300)
);

create table if not exists public.options_sondage (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.sondages (publication_id) on delete cascade,
  ordre integer not null,
  texte text not null default '',
  -- {chemin, nom, type, taille} : une image du stockage « communaute » (sondage avec images).
  image jsonb,
  correcte boolean not null default false,
  constraint options_texte check (char_length(texte) <= 80)
);
create index if not exists options_sondage_publication_idx on public.options_sondage (publication_id, ordre);
create unique index if not exists options_sondage_image_idx on public.options_sondage ((image ->> 'chemin')) where image is not null;

create table if not exists public.votes_sondage (
  publication_id uuid not null references public.sondages (publication_id) on delete cascade,
  option_id uuid not null references public.options_sondage (id) on delete cascade,
  profil_id uuid not null references public.profils (id) on delete cascade,
  cree_le timestamptz not null default now(),
  primary key (option_id, profil_id)
);
create index if not exists votes_sondage_compte_idx on public.votes_sondage (publication_id, profil_id);
create index if not exists votes_sondage_profil_idx on public.votes_sondage (profil_id);

alter table public.sondages enable row level security;
alter table public.options_sondage enable row level security;
alter table public.votes_sondage enable row level security;
revoke all on public.sondages from anon, authenticated;
revoke all on public.options_sondage from anon, authenticated;
revoke all on public.votes_sondage from anon, authenticated;

-- ─── L'heure d'écriture : la limite de débit compte une programmée quand on l'écrit ────────────────
-- (une programmée a son cree_le dans le futur : comptée sur cree_le, elle bloquerait l'auteur jusqu'à sa parution).
alter table public.publications add column if not exists ecrite_le timestamptz not null default now();
update public.publications set ecrite_le = cree_le where ecrite_le > cree_le;

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
    where auteur = (select auth.uid()) and ecrite_le > now() - interval '10 minutes';
  end if;
  if v_nombre >= v_limite then
    raise exception 'Vous publiez beaucoup en peu de temps. Réessayez dans quelques minutes.';
  end if;
end;
$$;

-- ─── Visible : parue (ou la sienne, programmée ou en attente) ───────────────────────────────────────
create or replace function public.publication_visible(p public.publications)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (p.statut = 'publiee' and p.cree_le <= now())
    or (p.auteur = (select auth.uid()) and p.statut in ('publiee', 'en_attente'));
$$;

-- ─── Ouverte aux interactions : parue ───────────────────────────────────────────────────────────────
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
  -- Programmée : rien avant son heure (l'auteur le sait ; pour les autres, elle n'existe pas encore).
  if v.cree_le > now() and not public.equipe_contenus() then
    if v.auteur = (select auth.uid()) then
      raise exception 'Cette publication n’est pas encore parue.';
    end if;
    raise exception 'Cette publication n’existe plus.';
  end if;
  return v;
end;
$$;

-- ─── Un fichier déjà image d'un sondage ne se joint pas ailleurs ────────────────────────────────
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
     or exists (select 1 from public.publications p where p.piece_jointe ->> 'chemin' = v_chemin)
     or exists (select 1 from public.options_sondage o where o.image ->> 'chemin' = v_chemin) then
    raise exception 'Ce fichier n’est pas le vôtre.';
  end if;
  return jsonb_build_object('chemin', v_chemin, 'nom', left(coalesce(nullif(btrim(p_piece ->> 'nom'), ''), 'fichier'), 200), 'type', v_type, 'taille', v_taille);
end;
$$;

-- ─── L'heure de parution : de 10 minutes (9 de tolérance) à 3 mois ──────────────────────────────────
create or replace function public.verifier_parution(p_publie_le timestamptz)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_publie_le is null then
    return;
  end if;
  if p_publie_le < now() + interval '9 minutes' then
    raise exception 'Choisissez une heure au moins 10 minutes plus tard.';
  end if;
  if p_publie_le > now() + interval '3 months' then
    raise exception 'Choisissez une date dans les 3 mois qui viennent.';
  end if;
end;
$$;

-- ─── Un sondage ou un quiz : vérifié et normalisé ───────────────────────────────────────────────────
-- {type, choix_multiples, duree_jours (1, 3, 7, 14 ou rien), explication, options: [{texte, image, correcte}]}.
create or replace function public.verifier_sondage(p_sondage jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_type text := p_sondage ->> 'type';
  v_options jsonb := coalesce(p_sondage -> 'options', '[]'::jsonb);
  v_nombre integer;
  v_duree integer;
  v_explication text := nullif(regexp_replace(coalesce(p_sondage ->> 'explication', ''), '^\s+|\s+$', '', 'g'), '');
  v_sorties jsonb := '[]'::jsonb;
  v_option jsonb;
  v_texte text;
  v_image jsonb;
  v_chemins text[] := '{}';
  v_bonnes integer := 0;
begin
  if v_type is null or v_type not in ('texte', 'images', 'quiz') or jsonb_typeof(v_options) <> 'array' then
    raise exception 'Ce sondage n’est pas reconnu.';
  end if;
  v_nombre := jsonb_array_length(v_options);
  if v_type = 'texte' and v_nombre not between 2 and 10 then
    raise exception 'Un sondage a de 2 à 10 options.';
  end if;
  if v_type = 'images' and v_nombre not between 2 and 6 then
    raise exception 'Un sondage avec images a de 2 à 6 images.';
  end if;
  if v_type = 'quiz' and v_nombre not between 2 and 6 then
    raise exception 'Un quiz a de 2 à 6 réponses.';
  end if;
  begin
    v_duree := nullif(p_sondage ->> 'duree_jours', '')::integer;
  exception when others then
    v_duree := -1;
  end;
  if v_type = 'quiz' then
    v_duree := null;
  elsif v_duree is not null and v_duree not in (1, 3, 7, 14) then
    raise exception 'Choisissez la fin du sondage : 1 jour, 3 jours, 1 semaine, 2 semaines ou sans fin.';
  end if;
  if v_explication is not null and char_length(v_explication) > 300 then
    raise exception 'L’explication fait 300 caractères au plus.';
  end if;

  for v_option in select value from jsonb_array_elements(v_options) loop
    v_texte := regexp_replace(coalesce(v_option ->> 'texte', ''), '^\s+|\s+$', '', 'g');
    if char_length(v_texte) > 80 then
      raise exception 'Une option fait 80 caractères au plus.';
    end if;
    v_image := null;
    if v_type = 'images' then
      if v_option -> 'image' is null or jsonb_typeof(v_option -> 'image') <> 'object' then
        raise exception 'Chaque option d’un sondage avec images a son image.';
      end if;
      if coalesce(v_option -> 'image' ->> 'type', '') not in ('image/jpeg', 'image/png', 'image/webp') then
        raise exception 'Une option d’un sondage avec images est une image (JPG, PNG ou WebP).';
      end if;
      v_image := public.verifier_piece(v_option -> 'image');
      if (v_image ->> 'chemin') = any (v_chemins) then
        raise exception 'Chaque option a sa propre image.';
      end if;
      v_chemins := v_chemins || (v_image ->> 'chemin');
    elsif v_texte = '' then
      raise exception 'Écrivez chaque option.';
    end if;
    if v_type = 'quiz' and coalesce((v_option ->> 'correcte')::boolean, false) then
      v_bonnes := v_bonnes + 1;
    end if;
    v_sorties := v_sorties || jsonb_build_array(jsonb_build_object(
      'texte', v_texte,
      'image', v_image,
      'correcte', v_type = 'quiz' and coalesce((v_option ->> 'correcte')::boolean, false)
    ));
  end loop;
  if v_type = 'quiz' and v_bonnes <> 1 then
    raise exception 'Un quiz a une seule bonne réponse.';
  end if;

  return jsonb_build_object(
    'type', v_type,
    'choix_multiples', v_type <> 'quiz' and coalesce((p_sondage ->> 'choix_multiples')::boolean, false),
    'duree_jours', v_duree,
    'explication', case when v_type = 'quiz' then v_explication end,
    'options', v_sorties
  );
end;
$$;

-- ─── Le bloc d'un sondage, pour le compte qui lit ───────────────────────────────────────────────────
-- Les résultats (et, pour un quiz, la bonne réponse et l'explication) : après avoir voté ou répondu, sondage terminé,
-- son auteur, l'équipe. Sinon les options seules.
create or replace function public.bloc_sondage(p_publication uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.sondages%rowtype;
  v_moi uuid := (select auth.uid());
  v_repondu boolean;
  v_ferme boolean;
  v_voit boolean;
begin
  select * into s from public.sondages where publication_id = p_publication;
  if not found then
    return null;
  end if;
  v_repondu := exists (select 1 from public.votes_sondage where publication_id = p_publication and profil_id = v_moi);
  v_ferme := s.fin_le is not null and s.fin_le <= now();
  v_voit := v_repondu or v_ferme or public.equipe_contenus()
    or exists (select 1 from public.publications p where p.id = p_publication and p.auteur = v_moi);
  return jsonb_build_object(
    'type', s.type,
    'choix_multiples', s.choix_multiples,
    'fin_le', s.fin_le,
    'ferme', v_ferme,
    'a_repondu', v_repondu,
    'votants', case when v_voit then (select count(distinct profil_id)::int from public.votes_sondage where publication_id = p_publication) end,
    'options', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', o.id,
          'texte', o.texte,
          'image', o.image,
          'votes', case when v_voit then (select count(*)::int from public.votes_sondage v where v.option_id = o.id) end,
          'moi', exists (select 1 from public.votes_sondage v where v.option_id = o.id and v.profil_id = v_moi)
        ) || case when s.type = 'quiz' and v_voit then jsonb_build_object('correcte', o.correcte) else '{}'::jsonb end
        order by o.ordre
      )
      from public.options_sondage o
      where o.publication_id = p_publication
    ), '[]'::jsonb)
  ) || case when s.type = 'quiz' and v_voit then jsonb_build_object('explication', s.explication) else '{}'::jsonb end;
end;
$$;

-- ─── Voter (sondage) ou répondre (quiz) ─────────────────────────────────────────────────────────────
-- Un vote se change tant que le sondage est ouvert ; la réponse à un quiz est définitive. Rend le bloc à jour.
create or replace function public.voter(p_publication uuid, p_options uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.sondages%rowtype;
  v_moi uuid := (select auth.uid());
  v_choix uuid[];
begin
  perform public.publication_ouverte(p_publication);
  -- Un vote à la fois par sondage : deux onglets ne votent pas deux fois.
  select * into s from public.sondages where publication_id = p_publication for update;
  if not found then
    raise exception 'Ce sondage n’existe plus.';
  end if;
  if s.fin_le is not null and s.fin_le <= now() then
    raise exception 'Ce sondage est terminé.';
  end if;
  select array_agg(distinct x) into v_choix from unnest(coalesce(p_options, '{}')) as x;
  if v_choix is null then
    raise exception 'Choisissez une réponse.';
  end if;
  if (select count(*) from public.options_sondage where publication_id = p_publication and id = any (v_choix)) <> array_length(v_choix, 1) then
    raise exception 'Cette option n’existe plus.';
  end if;
  if (s.type = 'quiz' or not s.choix_multiples) and array_length(v_choix, 1) > 1 then
    raise exception 'Choisissez une seule réponse.';
  end if;
  if s.type = 'quiz' and exists (select 1 from public.votes_sondage where publication_id = p_publication and profil_id = v_moi) then
    raise exception 'Vous avez déjà répondu à ce quiz.';
  end if;
  delete from public.votes_sondage where publication_id = p_publication and profil_id = v_moi;
  insert into public.votes_sondage (publication_id, option_id, profil_id)
  select p_publication, x, v_moi from unnest(v_choix) as x;
  return public.bloc_sondage(p_publication);
end;
$$;

-- ─── Reprogrammer : une autre heure, ou maintenant (null) ───────────────────────────────────────────
create or replace function public.reprogrammer(p_publication uuid, p_publie_le timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.publications%rowtype;
  v_nouvelle timestamptz := coalesce(p_publie_le, now());
begin
  perform public.exiger_compte_actif();
  select * into v from public.publications where id = p_publication for update;
  if not found then
    raise exception 'Cette publication n’existe plus.';
  end if;
  if v.auteur <> (select auth.uid()) and not public.equipe_contenus() then
    raise exception 'Cette publication n’est pas la vôtre.' using errcode = '42501';
  end if;
  if v.cree_le <= now() then
    raise exception 'Cette publication est déjà parue.';
  end if;
  perform public.verifier_parution(p_publie_le);
  -- La fin d'un sondage garde son écart avec la parution.
  update public.sondages set fin_le = v_nouvelle + (fin_le - v.cree_le) where publication_id = p_publication and fin_le is not null;
  update public.publications set cree_le = v_nouvelle where id = p_publication;
end;
$$;

-- ─── Les images d'un sondage (à retirer du stockage avec la publication) : son auteur, l'équipe ─────
create or replace function public.images_sondage(p_publication uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(o.image ->> 'chemin' order by o.ordre), '{}')
  from public.options_sondage o
  join public.publications p on p.id = o.publication_id
  where o.publication_id = p_publication and o.image is not null
    and (p.auteur = (select auth.uid()) or public.equipe_contenus());
$$;

-- ─── Fichiers : les images des sondages se lisent comme les pièces jointes, et restent attachées ─────
create or replace function public.fichier_communaute_lisible(p_nom text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.publications p
    where p.piece_jointe ->> 'chemin' = p_nom and p.statut = 'publiee' and p.cree_le <= now() and public.peut_lire_espace(p.parcours_id)
  ) or exists (
    select 1 from public.options_sondage o
    join public.publications p on p.id = o.publication_id
    where o.image ->> 'chemin' = p_nom and p.statut = 'publiee' and p.cree_le <= now() and public.peut_lire_espace(p.parcours_id)
  ) or exists (
    select 1 from public.annonce_communaute a
    where a.image_chemin = p_nom and public.annonce_visible(a)
  );
$$;

create or replace function public.fichier_communaute_attache(p_nom text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.publications p where p.piece_jointe ->> 'chemin' = p_nom)
    or exists (select 1 from public.options_sondage o where o.image ->> 'chemin' = p_nom);
$$;

-- ─── Publier : la parution programmée et le sondage (le reste comme la 0022) ────────────────────────
drop function if exists public.publier(uuid, text, text, jsonb, jsonb, jsonb, jsonb);
create or replace function public.publier(p_parcours uuid, p_titre text, p_texte text, p_piece jsonb default null, p_analyse jsonb default null, p_apercu jsonb default null, p_video jsonb default null, p_publie_le timestamptz default null, p_sondage jsonb default null)
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
  v_publie timestamptz := coalesce(p_publie_le, now());
  v_sondage jsonb;
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
  perform public.verifier_parution(p_publie_le);
  -- Un seul ajout : un sondage (ou un quiz) ne s'accompagne ni d'un fichier ni d'une vidéo.
  if p_sondage is not null and jsonb_typeof(p_sondage) <> 'null' then
    if (p_piece is not null and jsonb_typeof(p_piece) <> 'null') or (p_video is not null and jsonb_typeof(p_video) <> 'null') then
      raise exception 'Une publication porte un seul ajout : une image, un fichier, une vidéo, un sondage ou un quiz.';
    end if;
    v_sondage := public.verifier_sondage(p_sondage);
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
  -- Une publication programmée prend son heure de parution pour date : le fil la montre à cette heure-là.
  insert into public.publications (auteur, parcours_id, titre, texte, piece_jointe, statut, verdict, a_examiner, apercu, video, cree_le)
  values ((select auth.uid()), p_parcours, v_titre, v_texte, public.verifier_piece(p_piece), v_statut, v_analyse, v_examen, public.verifier_apercu(p_apercu, v_texte), public.verifier_video(p_video), v_publie)
  returning id into v_id;
  if v_sondage is not null then
    insert into public.sondages (publication_id, type, choix_multiples, fin_le, explication)
    values (v_id, v_sondage ->> 'type', (v_sondage ->> 'choix_multiples')::boolean,
            v_publie + make_interval(days => (v_sondage ->> 'duree_jours')::integer), v_sondage ->> 'explication');
    insert into public.options_sondage (publication_id, ordre, texte, image, correcte)
    select v_id, o.ordre::integer, o.valeur ->> 'texte', nullif(o.valeur -> 'image', 'null'::jsonb), coalesce((o.valeur ->> 'correcte')::boolean, false)
    from jsonb_array_elements(v_sondage -> 'options') with ordinality as o(valeur, ordre);
  end if;
  if v_examen or v_statut = 'en_attente' then
    perform public.prevenir_equipe('Une publication de l’espace ' || public.nom_espace_communaute(p_parcours) || ' attend votre examen.');
  end if;
  return jsonb_build_object('id', v_id, 'statut', v_statut, 'categorie', v_analyse ->> 'categorie');
end;
$$;

-- ─── La carte : programmée, sondage ─────────────────────────────────────────────────────────────────
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
    -- Programmée : vue par son auteur (onglet « Programmées ») et l'équipe seulement.
    'programmee', p.cree_le > now(),
    'sondage', public.bloc_sondage(p.id),
    -- Le bloc d'une session programmée (jamais son lien, réservé à sa fenêtre de 10 min).
    'session', (
      select jsonb_build_object(
        'id', s.id, 'debut', s.debut, 'duree_minutes', s.duree_minutes, 'plateforme', public.plateforme_session(s.lien),
        'animateur', public.animateur_session(s.formateur_id), 'statut', s.statut,
        'inscriptions', (select count(*)::int from public.inscriptions_sessions i where i.session_id = s.id),
        'inscrit', exists (select 1 from public.inscriptions_sessions i where i.session_id = s.id and i.profil_id = (select auth.uid()))
      )
      from public.sessions_live s where s.id = p.session_id
    ),
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
        where c.publication_id = p.id and c.parent_id is null
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

-- ─── Le fil : seulement les parues ; « programmees » pour l'auteur ──────────────────────────────────
create or replace function public.fil_communaute(
  p_espace text,
  p_tri text default 'recentes',
  p_avant timestamptz default null,
  p_avant_id uuid default null,
  p_page integer default 0,
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
  v_debut integer := greatest(coalesce(p_page, 0), 0) * least(greatest(coalesce(p_nombre, 20), 1), 50);
  v_general boolean := p_espace = 'general';
  v_parcours uuid;
  v_ids uuid[];
  v_lignes jsonb;
  v_vide constant jsonb := jsonb_build_object('publications', '[]'::jsonb, 'suite', false);
begin
  perform public.exiger_compte_actif();
  if not v_general and p_espace is distinct from 'tous' then
    begin
      v_parcours := p_espace::uuid;
    exception when invalid_text_representation then
      return v_vide;
    end;
    if not public.peut_lire_espace(v_parcours) then
      return v_vide;
    end if;
  end if;

  if p_tri = 'populaires' then
    select array_agg(x.id order by x.score desc, x.cree_le desc, x.id desc) into v_ids
    from (
      select p.id, p.cree_le,
             (select count(*) from public.reactions_publications r where r.publication_id = p.id)
             + 2 * (select count(*) from public.commentaires_publications c where c.publication_id = p.id) as score
      from public.publications p
      where (case when v_general then p.parcours_id is null when v_parcours is not null then p.parcours_id = v_parcours else public.peut_lire_espace(p.parcours_id) end)
        and public.publication_visible(p) and p.cree_le <= now()
        and p.cree_le > now() - interval '30 days'
      order by score desc, p.cree_le desc, p.id desc
      offset v_debut
      limit v_nombre + 1
    ) x;
  elsif p_tri = 'enregistrees' then
    select array_agg(x.id order by x.enregistree_le desc, x.id desc) into v_ids
    from (
      select p.id, e.cree_le as enregistree_le
      from public.publications_enregistrees e
      join public.publications p on p.id = e.publication_id
      where e.profil_id = (select auth.uid())
        and (case when v_general then p.parcours_id is null when v_parcours is not null then p.parcours_id = v_parcours else public.peut_lire_espace(p.parcours_id) end)
        and public.publication_visible(p) and p.cree_le <= now()
      order by e.cree_le desc, p.id desc
      offset v_debut
      limit v_nombre + 1
    ) x;
  elsif p_tri = 'programmees' then
    -- Les siennes, à venir, de la plus proche à la plus lointaine.
    select array_agg(x.id order by x.cree_le, x.id) into v_ids
    from (
      select p.id, p.cree_le
      from public.publications p
      where p.auteur = (select auth.uid()) and p.cree_le > now() and p.statut in ('publiee', 'en_attente')
        and (case when v_general then p.parcours_id is null when v_parcours is not null then p.parcours_id = v_parcours else public.peut_lire_espace(p.parcours_id) end)
      order by p.cree_le, p.id
      offset v_debut
      limit v_nombre + 1
    ) x;
  else
    select array_agg(x.id order by x.cree_le desc, x.id desc) into v_ids
    from (
      select p.id, p.cree_le
      from public.publications p
      where (case when v_general then p.parcours_id is null when v_parcours is not null then p.parcours_id = v_parcours else public.peut_lire_espace(p.parcours_id) end)
        and public.publication_visible(p) and p.cree_le <= now()
        and (p_avant is null or (p.cree_le, p.id) < (p_avant, coalesce(p_avant_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
      order by p.cree_le desc, p.id desc
      limit v_nombre + 1
    ) x;
  end if;

  select coalesce(jsonb_agg(public.carte_publication(p) order by array_position(v_ids, p.id)), '[]'::jsonb) into v_lignes
  from public.publications p
  where p.id = any (coalesce(v_ids[1:v_nombre], '{}'::uuid[]));

  return jsonb_build_object('publications', v_lignes, 'suite', coalesce(array_length(v_ids, 1), 0) > v_nombre);
end;
$$;

-- ─── Tendances et activités : seulement les parues ─────────────────────────────────────────────────
create or replace function public.publications_tendances()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  return coalesce((
    select jsonb_agg(y.carte order by y.score desc, y.cree_le desc, y.id desc)
    from (
    select x.* from (
      select p.id, p.cree_le,
             (select count(*) from public.reactions_publications r where r.publication_id = p.id)
             + (select count(*) from public.commentaires_publications c where c.publication_id = p.id) as score,
             jsonb_build_object(
               'id', p.id,
               'extrait', left(coalesce(nullif(p.titre, ''), p.texte), 160),
               'auteur', jsonb_build_object(
                 'nom_court', public.nom_avis(pr.prenom, pr.nom),
                 'initiales', public.initiales_avis(pr.prenom, pr.nom),
                 'equipe', coalesce(public.role_communaute(p.auteur) = 'equipe', false)
               )
             ) as carte
      from public.publications p
      join public.profils pr on pr.id = p.auteur
      where p.statut = 'publiee' and p.cree_le <= now() and p.cree_le > now() - interval '7 days' and public.peut_lire_espace(p.parcours_id)
    ) x
    where x.score > 0
    order by x.score desc, x.cree_le desc, x.id desc
    limit 5
    ) y
  ), '[]'::jsonb);
end;
$$;

create or replace function public.activites_recentes()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'type', a.type,
        'publication_id', a.publication_id,
        'auteur', jsonb_build_object('nom_court', public.nom_avis(pr.prenom, pr.nom), 'initiales', public.initiales_avis(pr.prenom, pr.nom)),
        'extrait', a.extrait,
        'cree_le', a.cree_le
      )
      order by a.cree_le desc
    )
    from (
      (
        select 'publication' as type, p.id as publication_id, p.auteur, p.cree_le, left(coalesce(nullif(p.titre, ''), p.texte), 80) as extrait
        from public.publications p
        where p.statut = 'publiee' and p.cree_le <= now() and public.peut_lire_espace(p.parcours_id)
        order by p.cree_le desc
        limit 6
      )
      union all
      (
        select 'commentaire', p.id, c.auteur, c.cree_le, left(coalesce(nullif(p.titre, ''), p.texte), 80)
        from public.commentaires_publications c
        join public.publications p on p.id = c.publication_id
        where p.statut = 'publiee' and p.cree_le <= now() and public.peut_lire_espace(p.parcours_id)
        order by c.cree_le desc
        limit 6
      )
      order by cree_le desc
      limit 6
    ) a
    join public.profils pr on pr.id = a.auteur
  ), '[]'::jsonb);
end;
$$;

-- ─── Droits d'exécution ─────────────────────────────────────────────────────────────────────────────
revoke execute on function public.limiter_debit(boolean) from public, anon, authenticated;
revoke execute on function public.verifier_parution(timestamptz) from public, anon, authenticated;
revoke execute on function public.verifier_sondage(jsonb) from public, anon, authenticated;
revoke execute on function public.bloc_sondage(uuid) from public, anon, authenticated;
revoke execute on function public.publier(uuid, text, text, jsonb, jsonb, jsonb, jsonb, timestamptz, jsonb) from public, anon;
grant execute on function public.publier(uuid, text, text, jsonb, jsonb, jsonb, jsonb, timestamptz, jsonb) to authenticated;
revoke execute on function public.voter(uuid, uuid[]) from public, anon;
grant execute on function public.voter(uuid, uuid[]) to authenticated;
revoke execute on function public.reprogrammer(uuid, timestamptz) from public, anon;
grant execute on function public.reprogrammer(uuid, timestamptz) to authenticated;
revoke execute on function public.images_sondage(uuid) from public, anon;
grant execute on function public.images_sondage(uuid) to authenticated;

commit;

-- ═══ 0027_lecons_statut.sql ═══
-- Migration 0027 : le statut d'une leçon et le rangement des sections et des leçons
-- (spec docs/superpowers/specs/2026-10-15-refonte-formations-design.md, §3 et §4, étape A).
--
-- Une leçon est « brouillon » ou « publiée » : les étudiants ne voient que les publiées (programme, accès, avis à 50 %,
-- suivi du formateur, statistiques) ; l'équipe et le formateur de la formation voient tout. La notification « Nouvelle
-- leçon » part à la publication de la leçon. `ranger` place une section ou une leçon à un rang donné, une leçon pouvant
-- changer de section dans sa formation. Rejouable.

-- ─── Les colonnes ──────────────────────────────────────────────────────────────────────────────────
-- Les leçons déjà là restent publiées ; ensuite, une leçon naît en brouillon (l'application choisit).
alter table public.lecons add column if not exists publiee boolean not null default true;
alter table public.lecons alter column publiee set default false;
alter table public.lecons add column if not exists commentaires_actifs boolean not null default true;

-- ─── Lire une leçon : publiée, ou l'équipe et le formateur de la formation ─────────────────────────
drop policy if exists "leçons d'un module visible" on public.lecons;
create policy "leçons d'un module visible" on public.lecons
  for select to anon, authenticated
  using (
    exists (select 1 from public.modules m where m.id = lecons.module_id)
    and (lecons.publiee or public.equipe_contenus() or public.formateur_de(public.formation_du_module(lecons.module_id)))
  );

-- ─── L'accès d'un étudiant : une leçon publiée ─────────────────────────────────────────────────────
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
        and l.publiee
        and (l.apercu or (f.gratuite and (select auth.uid()) is not null))
    )
  );
$$;

-- ─── Ne comptent que les leçons publiées ───────────────────────────────────────────────────────────
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
      where m.formation_id = p_formation and l.publiee
    );
$$;

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
      (select count(*) from public.lecons l join public.modules m on m.id = l.module_id where m.formation_id = f.id and l.publiee)::integer as nb_lecons
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
  join public.lecons l on l.module_id = m.id and l.publiee
  join public.progression_lecons p on p.lecon_id = l.id
  join public.profils pr on pr.id = p.profil_id
  where p.profil_id is distinct from mf.compte_id
    and not exists (select 1 from public.roles r where r.profil_id = p.profil_id and r.role in ('moderateur', 'admin', 'super_admin'))
  group by p.profil_id, pr.prenom, pr.nom, mf.id, mf.titre, mf.nb_lecons;
$$;

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
              where l.module_id = m.id and l.publiee
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
      where l.publiee
      group by p.profil_id, m.formation_id
    ),
    totaux as (
      select m.formation_id, count(*) as lecons
      from public.lecons l
      join public.modules m on m.id = l.module_id
      where l.publiee
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
          count(pl.terminee_le) filter (where l.publiee) as terminees,
          (select count(*) from public.lecons l2 join public.modules m2 on m2.id = l2.module_id where m2.formation_id = fo.id and l2.publiee) as total,
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

-- ─── Envoyer en relecture : au moins une leçon publiée ─────────────────────────────────────────────
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
    select 1 from public.lecons l join public.modules m on m.id = l.module_id where m.formation_id = p_formation and l.publiee
  ) then
    raise exception 'Publiez au moins une leçon avant d’envoyer la formation en relecture.';
  end if;
  update public.formations
  set envoyee_le = now(), renvoyee_le = null, remarque_relecture = null
  where id = p_formation;
end;
$$;

-- ─── « Nouvelle leçon » : à sa publication ─────────────────────────────────────────────────────────
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
  -- À la publication de la leçon (insérée publiée, ou passée de brouillon à publiée), pas à chaque modification.
  if found and v_formation.statut = 'publiee' and new.publiee and (tg_op = 'INSERT' or not old.publiee) then
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
  after insert or update of publiee on public.lecons
  for each row execute function public.notifications_lecons();

-- ─── Ranger une section ou une leçon ───────────────────────────────────────────────────────────────
-- Comme `deplacer` (0005), avec les droits de qui appelle : les règles d'écriture décident (équipe, ou formateur de
-- la formation) ; sans droit, rien ne bouge. Une leçon peut changer de section, dans sa formation seulement.
create or replace function public.ranger(p_table text, p_id uuid, p_parent uuid, p_position integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_groupe uuid;
  v_depart uuid;
  v_ids uuid[];
  v_rang integer;
begin
  if p_table = 'modules' then
    select formation_id into v_groupe from public.modules where id = p_id;
    if v_groupe is null then
      return;
    end if;
    select coalesce(array_agg(id order by ordre, cree_le, id), '{}') into v_ids
    from public.modules where formation_id = v_groupe and id <> p_id;
  elsif p_table = 'lecons' then
    select module_id into v_depart from public.lecons where id = p_id;
    if v_depart is null then
      return;
    end if;
    v_groupe := coalesce(p_parent, v_depart);
    if public.formation_du_module(v_groupe) is distinct from public.formation_du_module(v_depart) then
      raise exception 'Cette section n’est pas dans la même formation.';
    end if;
    if v_groupe <> v_depart then
      update public.lecons set module_id = v_groupe where id = p_id;
      if not found then
        return;
      end if;
    end if;
    select coalesce(array_agg(id order by ordre, cree_le, id), '{}') into v_ids
    from public.lecons where module_id = v_groupe and id <> p_id;
  else
    raise exception 'Table non prévue pour un rangement : %', p_table;
  end if;

  -- L'élément à son rang (borné), puis 1…n dans l'ordre.
  v_rang := least(greatest(coalesce(p_position, 1), 1), coalesce(array_length(v_ids, 1), 0) + 1);
  v_ids := v_ids[1:v_rang - 1] || p_id || v_ids[v_rang:];
  if p_table = 'modules' then
    update public.modules t set ordre = n.rang
    from unnest(v_ids) with ordinality as n(id, rang)
    where t.id = n.id and t.ordre is distinct from n.rang;
  else
    update public.lecons t set ordre = n.rang
    from unnest(v_ids) with ordinality as n(id, rang)
    where t.id = n.id and t.ordre is distinct from n.rang;
    -- La section quittée : 1…n, sans trou.
    if v_groupe <> v_depart then
      update public.lecons t set ordre = n.rang
      from (select id, row_number() over (order by ordre, cree_le, id) as rang from public.lecons where module_id = v_depart) as n
      where t.id = n.id and t.ordre is distinct from n.rang;
    end if;
  end if;
end;
$$;

revoke execute on function public.ranger(text, uuid, uuid, integer) from public, anon;
grant execute on function public.ranger(text, uuid, uuid, integer) to authenticated;

-- ═══ 0028_discussions_lecons.sql ═══
-- Étudium · migration 0028 : les discussions des leçons (refonte des formations, étape B,
-- spec docs/superpowers/specs/2026-10-15-refonte-formations-design.md, §1.6 et §4).
-- À appliquer dans Supabase, après la 0027 : SQL Editor → New query → coller tout le fichier → Run. Rejouable.
--
-- Sous une leçon, les comptes qui y ont accès commentent (un seul niveau de réponses), aiment, modifient et suppriment
-- les leurs ; le formateur de la formation et l'équipe suppriment. Le formateur est prévenu d'un nouveau commentaire,
-- l'auteur d'une réponse. « Signaler » envoie le commentaire dans la file de modération de l'équipe.

begin;

-- ─── Tables ─────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.commentaires_lecons (
  id uuid primary key default gen_random_uuid(),
  lecon_id uuid not null references public.lecons (id) on delete cascade,
  auteur uuid not null references public.profils (id) on delete cascade,
  -- Une réponse vise un commentaire de premier niveau ; supprimer un commentaire supprime ses réponses.
  parent_id uuid references public.commentaires_lecons (id) on delete cascade,
  texte text not null,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz,
  constraint commentaires_lecons_texte check (char_length(texte) between 1 and 1000)
);
create index if not exists commentaires_lecons_lecon_idx on public.commentaires_lecons (lecon_id, cree_le);
create index if not exists commentaires_lecons_parent_idx on public.commentaires_lecons (parent_id);
create index if not exists commentaires_lecons_auteur_idx on public.commentaires_lecons (auteur, cree_le);
alter table public.commentaires_lecons enable row level security;
revoke all on public.commentaires_lecons from anon, authenticated;

create table if not exists public.reactions_commentaires_lecons (
  commentaire_id uuid not null references public.commentaires_lecons (id) on delete cascade,
  profil_id uuid not null references public.profils (id) on delete cascade,
  cree_le timestamptz not null default now(),
  primary key (commentaire_id, profil_id)
);
create index if not exists reactions_commentaires_lecons_profil_idx on public.reactions_commentaires_lecons (profil_id);
alter table public.reactions_commentaires_lecons enable row level security;
revoke all on public.reactions_commentaires_lecons from anon, authenticated;

-- Les signalements visent aussi un commentaire de leçon : une seule cible par signalement.
alter table public.signalements add column if not exists commentaire_lecon_id uuid references public.commentaires_lecons (id) on delete cascade;
alter table public.signalements drop constraint if exists signalements_une_cible;
alter table public.signalements add constraint signalements_une_cible check (num_nonnulls(publication_id, commentaire_id, commentaire_lecon_id) = 1);
create unique index if not exists signalements_commentaire_lecon_unique on public.signalements (auteur, commentaire_lecon_id) where commentaire_lecon_id is not null;
create index if not exists signalements_commentaire_lecon_idx on public.signalements (commentaire_lecon_id) where traite_le is null;

-- ─── Une leçon ouverte à la discussion : un compte qui y a accès, commentaires activés ──────────────
create or replace function public.lecon_discutable(p_lecon uuid)
returns public.lecons
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.lecons%rowtype;
begin
  select * into v from public.lecons where id = p_lecon;
  if not found or (select auth.uid()) is null or not public.acces_lecon(p_lecon) then
    raise exception 'Cette leçon ne vous est pas ouverte.' using errcode = '42501';
  end if;
  if not v.commentaires_actifs then
    raise exception 'Les commentaires sont fermés sur cette leçon.';
  end if;
  return v;
end;
$$;

-- ─── La carte d'un commentaire ──────────────────────────────────────────────────────────────────────
create or replace function public.carte_commentaire_lecon(c public.commentaires_lecons)
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
    'parent_id', c.parent_id,
    'modifie', c.modifie_le is not null,
    'reactions', (select count(*)::int from public.reactions_commentaires_lecons r where r.commentaire_id = c.id),
    'j_aime', exists (select 1 from public.reactions_commentaires_lecons r where r.commentaire_id = c.id and r.profil_id = (select auth.uid())),
    'peut_modifier', c.auteur = (select auth.uid()),
    'peut_supprimer', c.auteur = (select auth.uid()) or public.equipe_contenus() or public.formateur_de(public.formation_de_la_lecon(c.lecon_id)),
    'peut_signaler', c.auteur <> (select auth.uid()) and not public.equipe_contenus(),
    -- L'étiquette « Formateur » : l'auteur est le formateur de la formation.
    'formateur', exists (
      select 1 from public.formations f join public.formateurs fo on fo.id = f.formateur_id
      where f.id = public.formation_de_la_lecon(c.lecon_id) and fo.compte_id = c.auteur
    )
  )
  from public.profils pr
  where pr.id = c.auteur;
$$;

-- ─── Lire : les 10 derniers commentaires de premier niveau et leurs réponses (ou tout), du plus ancien au plus récent ───
-- null sans accès (visiteur, leçon fermée ou en brouillon) ou commentaires fermés : la page n'affiche pas la section.
create or replace function public.discussion_lecon(p_lecon uuid, p_tout boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.acces_lecon(p_lecon)
    or not exists (select 1 from public.lecons where id = p_lecon and commentaires_actifs) then
    return null;
  end if;
  return jsonb_build_object(
    'total', (select count(*)::int from public.commentaires_lecons where lecon_id = p_lecon),
    'commentaires', coalesce((
      select jsonb_agg(public.carte_commentaire_lecon(c) order by c.cree_le, c.id)
      from public.commentaires_lecons c
      where c.lecon_id = p_lecon
        and (p_tout or coalesce(c.parent_id, c.id) in (
          select d.id from public.commentaires_lecons d
          where d.lecon_id = p_lecon and d.parent_id is null
          order by d.cree_le desc, d.id desc
          limit 10
        ))
    ), '[]'::jsonb)
  );
end;
$$;

-- ─── Commenter, ou répondre (un seul niveau) ────────────────────────────────────────────────────────
create or replace function public.commenter_lecon(p_lecon uuid, p_texte text, p_parent uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.lecons%rowtype;
  v_moi uuid := (select auth.uid());
  v_texte text := regexp_replace(coalesce(p_texte, ''), '^\s+|\s+$', '', 'g');
  v_parent public.commentaires_lecons%rowtype;
  v_nouveau public.commentaires_lecons%rowtype;
  v_formation record;
  v_nom text;
  v_lien text;
begin
  perform public.exiger_compte_actif();
  v := public.lecon_discutable(p_lecon);
  if char_length(v_texte) not between 1 and 1000 then
    raise exception 'Écrivez votre commentaire (1 000 caractères au plus).';
  end if;
  if p_parent is not null then
    select * into v_parent from public.commentaires_lecons where id = p_parent and lecon_id = p_lecon;
    if not found then
      raise exception 'Ce commentaire n’existe plus.';
    end if;
    -- Un seul niveau : répondre à une réponse répond au même commentaire.
    if v_parent.parent_id is not null then
      select * into v_parent from public.commentaires_lecons where id = v_parent.parent_id;
    end if;
  end if;
  if (select count(*) from public.commentaires_lecons where auteur = v_moi and cree_le > now() - interval '10 minutes') >= 30 then
    raise exception 'Vous publiez beaucoup en peu de temps. Réessayez dans quelques minutes.';
  end if;
  insert into public.commentaires_lecons (lecon_id, auteur, texte, parent_id)
  values (p_lecon, v_moi, v_texte, v_parent.id)
  returning * into v_nouveau;

  select f.slug, fo.compte_id into v_formation
  from public.modules m
  join public.formations f on f.id = m.formation_id
  left join public.formateurs fo on fo.id = f.formateur_id
  where m.id = v.module_id;
  v_lien := '/formations/' || v_formation.slug || '/lecons/' || v.id || '#commentaire-' || v_nouveau.id;
  select public.nom_avis(prenom, nom) into v_nom from public.profils where id = v_moi;
  -- L'auteur du commentaire auquel on répond ; puis le formateur, une seule fois.
  if v_parent.id is not null and v_parent.auteur <> v_moi then
    perform public.notifier(
      array[v_parent.auteur], 'communaute', 'Nouvelle réponse à votre commentaire',
      v_nom || ' a répondu à votre commentaire sur « ' || v.titre || ' ».', v_lien
    );
  end if;
  if v_formation.compte_id is not null and v_formation.compte_id <> v_moi and v_formation.compte_id is distinct from v_parent.auteur then
    perform public.notifier(
      array[v_formation.compte_id], 'communaute', 'Nouveau commentaire sur votre leçon',
      v_nom || ' a commenté « ' || v.titre || ' ».', v_lien
    );
  end if;
  return public.carte_commentaire_lecon(v_nouveau);
end;
$$;

-- ─── Modifier : son auteur ──────────────────────────────────────────────────────────────────────────
create or replace function public.modifier_commentaire_lecon(p_id uuid, p_texte text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.commentaires_lecons%rowtype;
  v_texte text := regexp_replace(coalesce(p_texte, ''), '^\s+|\s+$', '', 'g');
begin
  perform public.exiger_compte_actif();
  select * into v from public.commentaires_lecons where id = p_id for update;
  if not found then
    raise exception 'Ce commentaire n’existe plus.';
  end if;
  perform public.lecon_discutable(v.lecon_id);
  if v.auteur <> (select auth.uid()) then
    raise exception 'Ce commentaire n’est pas le vôtre.' using errcode = '42501';
  end if;
  if char_length(v_texte) not between 1 and 1000 then
    raise exception 'Écrivez votre commentaire (1 000 caractères au plus).';
  end if;
  if v_texte = v.texte then
    return;
  end if;
  update public.commentaires_lecons set texte = v_texte, modifie_le = now() where id = p_id;
end;
$$;

-- ─── Supprimer : son auteur, le formateur de la formation, l'équipe ; rend le nombre retiré (lui et ses réponses) ───
create or replace function public.supprimer_commentaire_lecon(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.commentaires_lecons%rowtype;
  v_nombre integer;
begin
  perform public.exiger_compte_actif();
  select * into v from public.commentaires_lecons where id = p_id;
  if not found then
    return 0;
  end if;
  if v.auteur <> (select auth.uid()) and not public.equipe_contenus() and not public.formateur_de(public.formation_de_la_lecon(v.lecon_id)) then
    raise exception 'Ce commentaire n’est pas le vôtre.' using errcode = '42501';
  end if;
  select count(*) + 1 into v_nombre from public.commentaires_lecons where parent_id = p_id;
  delete from public.commentaires_lecons where id = p_id;
  return v_nombre;
end;
$$;

-- ─── « J’aime » : le premier clic l'ajoute, le second le retire ────────────────────────────────────
create or replace function public.basculer_reaction_commentaire_lecon(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
  v_lecon uuid;
  v_aime boolean;
begin
  perform public.exiger_compte_actif();
  select lecon_id into v_lecon from public.commentaires_lecons where id = p_id;
  if not found then
    raise exception 'Ce commentaire n’existe plus.';
  end if;
  perform public.lecon_discutable(v_lecon);
  delete from public.reactions_commentaires_lecons where commentaire_id = p_id and profil_id = v_moi;
  if found then
    v_aime := false;
  else
    insert into public.reactions_commentaires_lecons (commentaire_id, profil_id) values (p_id, v_moi) on conflict do nothing;
    v_aime := true;
  end if;
  return jsonb_build_object(
    'j_aime', v_aime,
    'reactions', (select count(*)::int from public.reactions_commentaires_lecons where commentaire_id = p_id)
  );
end;
$$;

-- ─── Signaler (comme un commentaire de la communauté, migration 0020) ───────────────────────────────
create or replace function public.signaler_commentaire_lecon(p_id uuid, p_motif text, p_precisions text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.commentaires_lecons%rowtype;
  v_lecon public.lecons%rowtype;
  v_precisions text := regexp_replace(coalesce(p_precisions, ''), '^\s+|\s+$', '', 'g');
  v_dans_la_file boolean;
begin
  perform public.exiger_compte_actif();
  select * into v from public.commentaires_lecons where id = p_id;
  if not found then
    raise exception 'Ce contenu n’existe plus.';
  end if;
  v_lecon := public.lecon_discutable(v.lecon_id);
  if v.auteur = (select auth.uid()) then
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
  v_dans_la_file := exists (select 1 from public.signalements s where s.commentaire_lecon_id = p_id and s.traite_le is null);
  begin
    insert into public.signalements (commentaire_lecon_id, auteur, motif, precisions)
    values (p_id, (select auth.uid()), p_motif, v_precisions);
  exception when unique_violation then
    raise exception 'Vous avez déjà signalé ce contenu.';
  end;
  if not v_dans_la_file then
    perform public.prevenir_equipe('Un commentaire de la leçon « ' || v_lecon.titre || ' » attend votre examen.');
  end if;
end;
$$;

-- ─── Dans la file de l'équipe ───────────────────────────────────────────────────────────────────────
create or replace function public.element_commentaire_lecon(c public.commentaires_lecons)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with s as (select * from public.signalements where traite_le is null and commentaire_lecon_id = c.id)
  select jsonb_build_object(
    'type', 'commentaire_lecon',
    'id', c.id,
    'publication_id', null,
    'lien', '/formations/' || f.slug || '/lecons/' || l.id || '#commentaire-' || c.id,
    'espace', jsonb_build_object('id', null, 'nom', f.titre),
    'auteur', jsonb_build_object('id', c.auteur, 'prenom', coalesce(pr.prenom, ''), 'nom', coalesce(pr.nom, '')),
    'cree_le', c.cree_le,
    'titre', '',
    'texte', c.texte,
    'piece_jointe', null,
    'statut', 'publiee',
    'analyse', null,
    'extrait', l.titre,
    'signalements', jsonb_build_object(
      'nombre', (select count(*)::int from s),
      'motifs', coalesce((
        select jsonb_agg(jsonb_build_object('motif', m.motif, 'nombre', m.n) order by m.n desc, m.motif)
        from (select motif, count(*)::int as n from s group by motif) m
      ), '[]'::jsonb),
      'details', coalesce((
        select jsonb_agg(jsonb_build_object('motif', s.motif, 'precisions', s.precisions, 'par', public.nom_avis(p2.prenom, p2.nom), 'le', s.cree_le) order by s.cree_le, s.id)
        from s join public.profils p2 on p2.id = s.auteur
      ), '[]'::jsonb)
    )
  )
  from public.lecons l
  join public.modules m on m.id = l.module_id
  join public.formations f on f.id = m.formation_id
  join public.profils pr on pr.id = c.auteur
  where l.id = c.lecon_id;
$$;

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
      union all
      select public.element_commentaire_lecon(c), c.cree_le, c.id
      from public.commentaires_lecons c
      where exists (select 1 from public.signalements s where s.commentaire_lecon_id = c.id and s.traite_le is null)
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
  ) + (
    select count(*)::int from public.commentaires_lecons c
    where exists (select 1 from public.signalements s where s.commentaire_lecon_id = c.id and s.traite_le is null)
  );
end;
$$;

-- Garder : les signalements sont classés, le commentaire quitte la file.
create or replace function public.garder_commentaire_lecon(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_equipe_moderation();
  if not exists (select 1 from public.commentaires_lecons where id = p_id) then
    raise exception 'Ce contenu n’existe plus.';
  end if;
  update public.signalements set traite_le = now() where commentaire_lecon_id = p_id and traite_le is null;
end;
$$;

-- Retirer : le commentaire disparaît (avec ses réponses et ses signalements) et son auteur est prévenu.
create or replace function public.retirer_commentaire_lecon(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.commentaires_lecons%rowtype;
  v_lecon record;
begin
  perform public.exiger_equipe_moderation();
  select * into v from public.commentaires_lecons where id = p_id for update;
  if not found then
    raise exception 'Ce contenu n’existe plus.';
  end if;
  select l.id, l.titre, f.slug into v_lecon
  from public.lecons l join public.modules m on m.id = l.module_id join public.formations f on f.id = m.formation_id
  where l.id = v.lecon_id;
  delete from public.commentaires_lecons where id = p_id;
  perform public.notifier(
    array[v.auteur], 'service', 'Commentaire retiré',
    'Votre commentaire sur la leçon « ' || v_lecon.titre || ' » a été retiré par l’équipe Étudium : il ne respecte pas les règles de la communauté.',
    '/formations/' || v_lecon.slug || '/lecons/' || v_lecon.id
  );
end;
$$;

-- ─── Droits d'exécution ─────────────────────────────────────────────────────────────────────────────
revoke execute on function public.lecon_discutable(uuid) from public, anon, authenticated;
revoke execute on function public.carte_commentaire_lecon(public.commentaires_lecons) from public, anon, authenticated;
revoke execute on function public.element_commentaire_lecon(public.commentaires_lecons) from public, anon, authenticated;
-- Lire : null pour un visiteur (la page ne l'appelle pas) ; ouvert aussi à « anon » pour ne pas lever d'erreur.
grant execute on function public.discussion_lecon(uuid, boolean) to anon, authenticated;
revoke execute on function public.commenter_lecon(uuid, text, uuid) from public, anon;
grant execute on function public.commenter_lecon(uuid, text, uuid) to authenticated;
revoke execute on function public.modifier_commentaire_lecon(uuid, text) from public, anon;
grant execute on function public.modifier_commentaire_lecon(uuid, text) to authenticated;
revoke execute on function public.supprimer_commentaire_lecon(uuid) from public, anon;
grant execute on function public.supprimer_commentaire_lecon(uuid) to authenticated;
revoke execute on function public.basculer_reaction_commentaire_lecon(uuid) from public, anon;
grant execute on function public.basculer_reaction_commentaire_lecon(uuid) to authenticated;
revoke execute on function public.signaler_commentaire_lecon(uuid, text, text) from public, anon;
grant execute on function public.signaler_commentaire_lecon(uuid, text, text) to authenticated;
revoke execute on function public.garder_commentaire_lecon(uuid) from public, anon;
grant execute on function public.garder_commentaire_lecon(uuid) to authenticated;
revoke execute on function public.retirer_commentaire_lecon(uuid) from public, anon;
grant execute on function public.retirer_commentaire_lecon(uuid) to authenticated;

commit;

-- ═══ 0029_apprenants_formation.sql ═══
-- Étudium · migration 0029 : l'onglet « Apprenants » d'une formation (refonte des formations, étape C,
-- spec docs/superpowers/specs/2026-10-15-apprenants-formation-design.md).
-- À appliquer dans Supabase, après la 0028 : SQL Editor → New query → coller tout le fichier → Run. Rejouable.
--
-- Dans l'éditeur d'une formation, l'équipe et le formateur de la formation voient qui la suit : progression, première
-- leçon ouverte, dernière activité, état. Mêmes définitions que la page « Étudiants » (0015, reprise en 0027) :
-- apprenant = a ouvert une leçon publiée ; ni le formateur de la formation ni l'équipe ; à risque après 10 jours sans
-- activité ; terminée quand toutes les leçons publiées le sont. Jamais d'adresse e-mail.

begin;

-- ─── Une ligne par apprenant ────────────────────────────────────────────────────────────────────────
-- Interne : appelée seulement par apprenants_formation, jamais directement (aucun droit d'exécution).
create or replace function public.suivi_formation(p_formation uuid)
returns table (
  etudiant uuid,
  prenom text,
  nom text,
  terminees integer,
  total integer,
  premiere_ouverture timestamptz,
  derniere_activite timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with la_formation as (
    select
      f.id,
      fo.compte_id,
      (select count(*) from public.lecons l join public.modules m on m.id = l.module_id where m.formation_id = f.id and l.publiee)::integer as nb_lecons
    from public.formations f
    left join public.formateurs fo on fo.id = f.formateur_id
    where f.id = p_formation
  )
  select
    p.profil_id, pr.prenom, pr.nom,
    count(p.terminee_le)::integer,
    lf.nb_lecons,
    min(p.ouverte_le),
    max(greatest(p.vue_le, p.terminee_le, p.dernier_envoi))
  from la_formation lf
  join public.modules m on m.formation_id = lf.id
  join public.lecons l on l.module_id = m.id and l.publiee
  join public.progression_lecons p on p.lecon_id = l.id
  join public.profils pr on pr.id = p.profil_id
  where p.profil_id is distinct from lf.compte_id
    and not exists (select 1 from public.roles r where r.profil_id = p.profil_id and r.role in ('moderateur', 'admin', 'super_admin'))
  group by p.profil_id, pr.prenom, pr.nom, lf.nb_lecons;
$$;

-- ─── Les apprenants d'une formation ─────────────────────────────────────────────────────────────────
-- Une page de 25 apprenants, les plus récemment actifs d'abord, et le résumé de toute la formation. Filtres : l'état
-- (a_risque, terminees ; toute autre valeur : tous), le nom (sans accents ni majuscules, jamais de joker).
create or replace function public.apprenants_formation(
  p_formation uuid,
  p_recherche text default '',
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
  v_q text := public.sans_accents(btrim(coalesce(p_recherche, '')));
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_resultat jsonb;
begin
  if not (public.equipe_contenus() or public.formateur_de(p_formation)) then
    raise exception 'Cette formation n’est pas l’une de vos formations.' using errcode = '42501';
  end if;

  with lignes as (
    select s.*, public.etat_suivi(s.terminees, s.total, s.derniere_activite, p_maintenant) as etat
    from public.suivi_formation(p_formation) s
  ),
  retenues as (
    select * from lignes x
    where (v_q = '' or strpos(public.sans_accents(x.prenom || ' ' || x.nom), v_q) > 0)
      and case p_etat
        when 'a_risque' then x.etat = 'a_risque'
        when 'terminees' then x.etat = 'terminee'
        else true
      end
  ),
  page as (
    select * from retenues order by derniere_activite desc, etudiant limit 25 offset (v_page - 1) * 25
  )
  select jsonb_build_object(
    'resume', (
      select jsonb_build_object(
        'apprenants', count(*),
        'progression_moyenne', coalesce(round(avg(case when x.total > 0 then 100.0 * x.terminees / x.total else 0 end))::integer, 0),
        'terminees', count(*) filter (where x.etat = 'terminee'),
        'a_risque', count(*) filter (where x.etat = 'a_risque')
      )
      from lignes x
    ),
    'total', (select count(*) from retenues),
    'lignes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'etudiant_id', g.etudiant,
        'prenom', g.prenom,
        'nom', g.nom,
        'terminees', g.terminees,
        'total', g.total,
        'premiere_ouverture', g.premiere_ouverture,
        'derniere_activite', g.derniere_activite,
        'etat', g.etat
      ) order by g.derniere_activite desc, g.etudiant)
      from page g
    ), '[]'::jsonb)
  ) into v_resultat;
  return v_resultat;
end;
$$;

-- ─── Droits d'exécution ─────────────────────────────────────────────────────────────────────────────
revoke execute on function public.suivi_formation(uuid) from public, anon, authenticated;
revoke execute on function public.apprenants_formation(uuid, text, text, integer, timestamptz) from public, anon;
grant execute on function public.apprenants_formation(uuid, text, text, integer, timestamptz) to authenticated;

commit;

-- ═══ 0030_plateformes_video.sql ═══
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

-- ═══ 0031_quiz.sql ═══
-- Étudium · migration 0031 : les quiz (lot 3, étape A ; spec docs/superpowers/specs/2026-10-15-lot-3-quiz-exercices-certificats-design.md).
-- À appliquer dans Supabase, après la 0030 : SQL Editor → New query → coller tout le fichier → Run. Rejouable.
--
-- Un quiz est une leçon de type « quiz » dans le programme. Le formateur de la formation (ou l'équipe) en écrit les
-- questions : choix unique, réponses multiples, vrai ou faux, réponse courte. L'étudiant le passe autant de fois qu'il
-- veut ; la base corrige, garde le meilleur score et le compare au score minimal de la formation. Les bonnes réponses
-- ne quittent la base qu'avec le résultat. Quiz et exercices ne comptent pas dans la progression (R17).

begin;

-- ─── Le type d'un élément du programme ; le score minimal d'une formation ────────────────────────────
alter table public.lecons add column if not exists type text not null default 'lecon';
alter table public.lecons drop constraint if exists lecons_type;
alter table public.lecons add constraint lecons_type check (type in ('lecon', 'quiz', 'exercice'));

alter table public.formations add column if not exists score_quiz smallint not null default 70;
alter table public.formations drop constraint if exists formations_score_quiz;
alter table public.formations add constraint formations_score_quiz check (score_quiz between 0 and 100);

-- ─── Questions et tentatives (lues et écrites par les fonctions seulement) ─────────────────────────────
create table if not exists public.questions_quiz (
  id uuid primary key default gen_random_uuid(),
  lecon_id uuid not null references public.lecons (id) on delete cascade,
  ordre integer not null default 0,
  genre text not null,
  enonce text not null,
  -- [{ "texte": "Zotero", "correcte": true }, …] ; vide pour une réponse courte.
  choix jsonb not null default '[]'::jsonb,
  -- Les réponses acceptées d'une réponse courte.
  reponses text[] not null default '{}',
  explication text not null default '',
  constraint questions_quiz_genre check (genre in ('unique', 'multiple', 'vrai_faux', 'courte')),
  constraint questions_quiz_enonce check (char_length(enonce) between 1 and 1000),
  constraint questions_quiz_explication check (char_length(explication) <= 1000)
);
create index if not exists questions_quiz_lecon_idx on public.questions_quiz (lecon_id, ordre);
alter table public.questions_quiz enable row level security;
revoke all on public.questions_quiz from anon, authenticated;

create table if not exists public.tentatives_quiz (
  id uuid primary key default gen_random_uuid(),
  profil_id uuid not null references public.profils (id) on delete cascade,
  lecon_id uuid not null references public.lecons (id) on delete cascade,
  numero integer not null,
  bonnes integer not null,
  total integer not null,
  score smallint not null,
  -- La correction telle qu'elle a été rendue (les questions peuvent changer ensuite).
  detail jsonb not null default '[]'::jsonb,
  cree_le timestamptz not null default now(),
  constraint tentatives_quiz_score check (score between 0 and 100)
);
create index if not exists tentatives_quiz_profil_idx on public.tentatives_quiz (profil_id, lecon_id);
create index if not exists tentatives_quiz_lecon_idx on public.tentatives_quiz (lecon_id);
alter table public.tentatives_quiz enable row level security;
revoke all on public.tentatives_quiz from anon, authenticated;

-- ─── Outils ─────────────────────────────────────────────────────────────────────────────────────────
-- Le formateur de la formation de la leçon, ou l'équipe.
create or replace function public.editeur_de_lecon(p_lecon uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not public.compte_suspendu() and (public.equipe_contenus() or public.formateur_de(public.formation_de_la_lecon(p_lecon)));
$$;

-- Une réponse courte, sans majuscules, accents ni espaces en trop.
create or replace function public.normaliser_reponse(p_texte text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(btrim(public.sans_accents(coalesce(p_texte, ''))), '\s+', ' ', 'g');
$$;

-- ─── Écrire un quiz ─────────────────────────────────────────────────────────────────────────────────
-- Les questions avec leurs bonnes réponses, pour l'éditeur.
create or replace function public.quiz_editeur(p_lecon uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.editeur_de_lecon(p_lecon) then
    raise exception 'Cette formation n’est pas l’une de vos formations.' using errcode = '42501';
  end if;
  return jsonb_build_object('questions', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', q.id, 'genre', q.genre, 'enonce', q.enonce, 'choix', q.choix, 'reponses', to_jsonb(q.reponses), 'explication', q.explication
    ) order by q.ordre)
    from public.questions_quiz q
    where q.lecon_id = p_lecon
  ), '[]'::jsonb));
end;
$$;

-- Remplace les questions, après les avoir toutes vérifiées (rien ne change si l'une est mal formée). Une question
-- envoyée avec son identifiant est mise à jour et le garde : une tentative commencée reste valable. L'éditeur donne
-- aussi un identifiant aux nouvelles questions ; il est repris s'il n'est pas déjà pris.
create or replace function public.enregistrer_quiz(p_lecon uuid, p_questions jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_q jsonb;
  v_i integer := 0;
  v_genre text;
  v_enonce text;
  v_choix jsonb;
  v_nb integer;
  v_bonnes integer;
  v_id uuid;
  v_ord integer;
begin
  if not public.editeur_de_lecon(p_lecon) then
    raise exception 'Cette formation n’est pas l’une de vos formations.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.lecons where id = p_lecon and type = 'quiz') then
    raise exception 'Cette leçon n’est pas un quiz.';
  end if;
  if p_questions is null or jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) = 0 then
    raise exception 'Ajoutez au moins une question.';
  end if;
  if jsonb_array_length(p_questions) > 100 then
    raise exception 'Un quiz compte 100 questions au plus.';
  end if;

  for v_q in select value from jsonb_array_elements(p_questions) loop
    v_i := v_i + 1;
    v_genre := v_q ->> 'genre';
    v_enonce := btrim(coalesce(v_q ->> 'enonce', ''));
    if v_genre is null or v_genre not in ('unique', 'multiple', 'vrai_faux', 'courte') then
      raise exception 'La question % a un type inconnu.', v_i;
    end if;
    if v_enonce = '' then
      raise exception 'La question % n’a pas d’énoncé.', v_i;
    end if;
    if char_length(v_enonce) > 1000 then
      raise exception 'La question % : l’énoncé dépasse 1 000 caractères.', v_i;
    end if;
    if char_length(coalesce(v_q ->> 'explication', '')) > 1000 then
      raise exception 'La question % : l’explication dépasse 1 000 caractères.', v_i;
    end if;
    if v_genre = 'courte' then
      if jsonb_typeof(coalesce(v_q -> 'reponses', '[]'::jsonb)) <> 'array' or not exists (
        select 1 from jsonb_array_elements_text(coalesce(v_q -> 'reponses', '[]'::jsonb)) x where btrim(x) <> ''
      ) then
        raise exception 'La question % doit avoir au moins une réponse acceptée.', v_i;
      end if;
    else
      v_choix := coalesce(v_q -> 'choix', '[]'::jsonb);
      if jsonb_typeof(v_choix) <> 'array' then
        raise exception 'La question % doit proposer de 2 à 6 réponses.', v_i;
      end if;
      v_nb := jsonb_array_length(v_choix);
      if v_nb < 2 or v_nb > 6 then
        raise exception 'La question % doit proposer de 2 à 6 réponses.', v_i;
      end if;
      if exists (select 1 from jsonb_array_elements(v_choix) c where btrim(coalesce(c ->> 'texte', '')) = '') then
        raise exception 'La question % a une réponse vide.', v_i;
      end if;
      select count(*) filter (where c ->> 'correcte' = 'true') into v_bonnes from jsonb_array_elements(v_choix) c;
      if v_genre = 'multiple' and v_bonnes < 1 then
        raise exception 'La question % doit avoir au moins une bonne réponse.', v_i;
      end if;
      if v_genre <> 'multiple' and v_bonnes <> 1 then
        raise exception 'La question % doit avoir une seule bonne réponse.', v_i;
      end if;
      if v_genre = 'vrai_faux' and (v_nb <> 2 or v_choix -> 0 ->> 'texte' <> 'Vrai' or v_choix -> 1 ->> 'texte' <> 'Faux') then
        raise exception 'La question % : vrai ou faux attend les réponses « Vrai » et « Faux ».', v_i;
      end if;
    end if;
  end loop;

  if exists (
    select 1 from jsonb_array_elements(p_questions) e(q)
    where e.q ->> 'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    group by lower(e.q ->> 'id') having count(*) > 1
  ) then
    raise exception 'Deux questions ont le même identifiant.';
  end if;

  -- Les questions qui ne sont plus envoyées partent.
  delete from public.questions_quiz q
  where q.lecon_id = p_lecon
    and q.id not in (
      select (e.q ->> 'id')::uuid from jsonb_array_elements(p_questions) e(q) where e.q ->> 'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    );
  for v_q, v_ord in select e.q, e.ord from jsonb_array_elements(p_questions) with ordinality as e(q, ord) loop
    v_id := case when v_q ->> 'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (v_q ->> 'id')::uuid end;
    v_choix := case when v_q ->> 'genre' = 'courte' then '[]'::jsonb else (
      select jsonb_agg(jsonb_build_object('texte', btrim(c ->> 'texte'), 'correcte', c ->> 'correcte' = 'true') order by o)
      from jsonb_array_elements(v_q -> 'choix') with ordinality as t(c, o)
    ) end;
    update public.questions_quiz
    set ordre = v_ord,
        genre = v_q ->> 'genre',
        enonce = btrim(v_q ->> 'enonce'),
        choix = v_choix,
        reponses = case when v_q ->> 'genre' = 'courte' then array(
          select btrim(x) from jsonb_array_elements_text(v_q -> 'reponses') x where btrim(x) <> ''
        ) else '{}'::text[] end,
        explication = btrim(coalesce(v_q ->> 'explication', ''))
    where id = v_id and lecon_id = p_lecon;
    if not found then
      insert into public.questions_quiz (id, lecon_id, ordre, genre, enonce, choix, reponses, explication)
      values (
        case when v_id is not null and not exists (select 1 from public.questions_quiz where id = v_id) then v_id else gen_random_uuid() end,
        p_lecon,
        v_ord,
        v_q ->> 'genre',
        btrim(v_q ->> 'enonce'),
        v_choix,
        case when v_q ->> 'genre' = 'courte' then array(
          select btrim(x) from jsonb_array_elements_text(v_q -> 'reponses') x where btrim(x) <> ''
        ) else '{}'::text[] end,
        btrim(coalesce(v_q ->> 'explication', ''))
      );
    end if;
  end loop;
  return jsonb_array_length(p_questions);
end;
$$;

-- ─── Passer un quiz ─────────────────────────────────────────────────────────────────────────────────
-- Les questions, sans les bonnes réponses ni les explications ; null sans accès (ou si ce n'est pas un quiz).
create or replace function public.quiz_a_passer(p_lecon uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_score smallint;
begin
  if v_uid is null or not public.acces_lecon(p_lecon) then
    return null;
  end if;
  select f.score_quiz into v_score
  from public.lecons l
  join public.modules m on m.id = l.module_id
  join public.formations f on f.id = m.formation_id
  where l.id = p_lecon and l.type = 'quiz';
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'score_minimal', v_score,
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'genre', q.genre, 'enonce', q.enonce,
        'choix', (select coalesce(jsonb_agg(c ->> 'texte' order by o), '[]'::jsonb) from jsonb_array_elements(q.choix) with ordinality as t(c, o))
      ) order by q.ordre)
      from public.questions_quiz q
      where q.lecon_id = p_lecon
    ), '[]'::jsonb),
    'meilleur', (select max(t.score) from public.tentatives_quiz t where t.profil_id = v_uid and t.lecon_id = p_lecon),
    'tentatives', (select count(*) from public.tentatives_quiz t where t.profil_id = v_uid and t.lecon_id = p_lecon)
  );
end;
$$;

-- Corrige les réponses ({ "<question>": [indices] | "texte" }), enregistre la tentative et rend le détail.
-- Une question sans réponse est fausse ; des réponses multiples ne sont justes que si ce sont exactement les bonnes.
create or replace function public.envoyer_quiz(p_lecon uuid, p_reponses jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_score_min smallint;
  v_total integer;
  v_bonnes integer := 0;
  v_detail jsonb := '[]'::jsonb;
  v_q record;
  v_rep jsonb;
  v_ok boolean;
  v_votre text;
  v_bonne text;
  v_indices integer[];
  v_correctes integer[];
  v_numero integer;
  v_score smallint;
  v_meilleur smallint;
begin
  if v_uid is null or not public.acces_lecon(p_lecon) then
    raise exception 'Ce quiz ne vous est pas ouvert.' using errcode = '42501';
  end if;
  select f.score_quiz into v_score_min
  from public.lecons l
  join public.modules m on m.id = l.module_id
  join public.formations f on f.id = m.formation_id
  where l.id = p_lecon and l.type = 'quiz';
  if not found then
    raise exception 'Ce quiz ne vous est pas ouvert.' using errcode = '42501';
  end if;
  if (select count(*) from public.tentatives_quiz where profil_id = v_uid and cree_le > now() - interval '10 minutes') >= 30 then
    raise exception 'Trop de tentatives en peu de temps : réessayez dans quelques minutes.';
  end if;
  select count(*) into v_total from public.questions_quiz where lecon_id = p_lecon;
  if v_total = 0 then
    raise exception 'Ce quiz n’a pas encore de questions.';
  end if;
  if p_reponses is null or jsonb_typeof(p_reponses) <> 'object' then
    p_reponses := '{}'::jsonb;
  end if;
  -- Le formateur a modifié le quiz pendant la tentative : rien n'est enregistré, l'étudiant recharge la page.
  if exists (
    select 1 from jsonb_object_keys(p_reponses) k
    where not exists (select 1 from public.questions_quiz q where q.lecon_id = p_lecon and q.id::text = lower(k))
  ) then
    raise exception 'Ce quiz vient d’être modifié : rechargez la page pour le recommencer.';
  end if;

  for v_q in select * from public.questions_quiz where lecon_id = p_lecon order by ordre loop
    v_rep := p_reponses -> v_q.id::text;
    if v_q.genre = 'courte' then
      v_votre := case when jsonb_typeof(v_rep) = 'string' then left(v_rep #>> '{}', 500) else '' end;
      v_ok := public.normaliser_reponse(v_votre) <> ''
        and exists (select 1 from unnest(v_q.reponses) r where public.normaliser_reponse(r) = public.normaliser_reponse(v_votre));
      v_bonne := v_q.reponses[1];
    else
      v_indices := case when jsonb_typeof(v_rep) = 'array' then array(
        select distinct x::integer from jsonb_array_elements_text(v_rep) x where x ~ '^[0-9]{1,2}$' order by 1
      ) else '{}'::integer[] end;
      v_correctes := array(
        select (o - 1)::integer from jsonb_array_elements(v_q.choix) with ordinality as t(c, o) where c ->> 'correcte' = 'true' order by 1
      );
      v_ok := cardinality(v_indices) > 0 and v_indices = v_correctes;
      v_votre := coalesce((
        select string_agg(c ->> 'texte', ', ' order by o)
        from jsonb_array_elements(v_q.choix) with ordinality as t(c, o)
        where (o - 1)::integer = any (v_indices)
      ), '');
      v_bonne := (
        select string_agg(c ->> 'texte', ', ' order by o)
        from jsonb_array_elements(v_q.choix) with ordinality as t(c, o)
        where c ->> 'correcte' = 'true'
      );
    end if;
    if v_ok then
      v_bonnes := v_bonnes + 1;
    end if;
    v_detail := v_detail || jsonb_build_array(jsonb_build_object(
      'question_id', v_q.id, 'enonce', v_q.enonce, 'genre', v_q.genre, 'votre_reponse', v_votre,
      'correcte', v_ok, 'bonne_reponse', coalesce(v_bonne, ''), 'explication', v_q.explication
    ));
  end loop;

  v_score := round(100.0 * v_bonnes / v_total);
  select coalesce(max(numero), 0) + 1 into v_numero from public.tentatives_quiz where profil_id = v_uid and lecon_id = p_lecon;
  insert into public.tentatives_quiz (profil_id, lecon_id, numero, bonnes, total, score, detail)
  values (v_uid, p_lecon, v_numero, v_bonnes, v_total, v_score, v_detail);
  select max(score) into v_meilleur from public.tentatives_quiz where profil_id = v_uid and lecon_id = p_lecon;

  return jsonb_build_object(
    'score', v_score, 'bonnes', v_bonnes, 'total', v_total, 'reussi', v_score >= v_score_min,
    'meilleur', v_meilleur, 'numero', v_numero, 'score_minimal', v_score_min, 'detail', v_detail
  );
end;
$$;

-- Le meilleur score du compte à chaque quiz d'une formation : { "<leçon>": 75, … }.
create or replace function public.mes_scores_quiz(p_formation uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(s.lecon_id::text, s.meilleur), '{}'::jsonb)
  from (
    select t.lecon_id, max(t.score) as meilleur
    from public.tentatives_quiz t
    join public.lecons l on l.id = t.lecon_id
    join public.modules m on m.id = l.module_id
    where t.profil_id = (select auth.uid()) and m.formation_id = p_formation
    group by t.lecon_id
  ) s;
$$;

-- Le nombre de questions de chaque quiz d'une formation, pour le programme du back-office : { "<leçon>": 4, … }.
-- Vide hors de l'équipe et du formateur de la formation.
create or replace function public.questions_par_quiz(p_formation uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(l.id::text, (select count(*) from public.questions_quiz q where q.lecon_id = l.id)), '{}'::jsonb)
  from public.lecons l
  join public.modules m on m.id = l.module_id
  where m.formation_id = p_formation
    and l.type = 'quiz'
    and not public.compte_suspendu()
    and (public.equipe_contenus() or public.formateur_de(p_formation));
$$;

-- Un quiz sans question ne se publie pas (l'étudiant n'aurait rien à passer). Les questions ne s'effacent pas toutes :
-- enregistrer_quiz en exige au moins une.
create or replace function public.quiz_publiable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.publiee and new.type = 'quiz' and not exists (select 1 from public.questions_quiz where lecon_id = new.id) then
    raise exception 'Ajoutez au moins une question avant de publier ce quiz.';
  end if;
  return new;
end;
$$;

drop trigger if exists lecons_quiz_publiable on public.lecons;
create trigger lecons_quiz_publiable
  before insert or update of publiee, type on public.lecons
  for each row execute function public.quiz_publiable();

-- ─── Les comptages de leçons ignorent les quiz et les exercices (0027, 0029 reprises) ─────────────────
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
      where m.formation_id = p_formation and l.publiee and l.type = 'lecon'
    );
$$;

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
      (select count(*) from public.lecons l join public.modules m on m.id = l.module_id where m.formation_id = f.id and l.publiee and l.type = 'lecon')::integer as nb_lecons
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
  join public.lecons l on l.module_id = m.id and l.publiee and l.type = 'lecon'
  join public.progression_lecons p on p.lecon_id = l.id
  join public.profils pr on pr.id = p.profil_id
  where p.profil_id is distinct from mf.compte_id
    and not exists (select 1 from public.roles r where r.profil_id = p.profil_id and r.role in ('moderateur', 'admin', 'super_admin'))
  group by p.profil_id, pr.prenom, pr.nom, mf.id, mf.titre, mf.nb_lecons;
$$;

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
              where l.module_id = m.id and l.publiee and l.type = 'lecon'
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
      where l.publiee and l.type = 'lecon'
      group by p.profil_id, m.formation_id
    ),
    totaux as (
      select m.formation_id, count(*) as lecons
      from public.lecons l
      join public.modules m on m.id = l.module_id
      where l.publiee and l.type = 'lecon'
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
          count(pl.terminee_le) filter (where l.publiee and l.type = 'lecon') as terminees,
          (select count(*) from public.lecons l2 join public.modules m2 on m2.id = l2.module_id where m2.formation_id = fo.id and l2.publiee and l2.type = 'lecon') as total,
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
    select 1 from public.lecons l join public.modules m on m.id = l.module_id where m.formation_id = p_formation and l.publiee and l.type = 'lecon'
  ) then
    raise exception 'Publiez au moins une leçon avant d’envoyer la formation en relecture.';
  end if;
  update public.formations
  set envoyee_le = now(), renvoyee_le = null, remarque_relecture = null
  where id = p_formation;
end;
$$;

create or replace function public.suivi_formation(p_formation uuid)
returns table (
  etudiant uuid,
  prenom text,
  nom text,
  terminees integer,
  total integer,
  premiere_ouverture timestamptz,
  derniere_activite timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with la_formation as (
    select
      f.id,
      fo.compte_id,
      (select count(*) from public.lecons l join public.modules m on m.id = l.module_id where m.formation_id = f.id and l.publiee and l.type = 'lecon')::integer as nb_lecons
    from public.formations f
    left join public.formateurs fo on fo.id = f.formateur_id
    where f.id = p_formation
  )
  select
    p.profil_id, pr.prenom, pr.nom,
    count(p.terminee_le)::integer,
    lf.nb_lecons,
    min(p.ouverte_le),
    max(greatest(p.vue_le, p.terminee_le, p.dernier_envoi))
  from la_formation lf
  join public.modules m on m.formation_id = lf.id
  join public.lecons l on l.module_id = m.id and l.publiee and l.type = 'lecon'
  join public.progression_lecons p on p.lecon_id = l.id
  join public.profils pr on pr.id = p.profil_id
  where p.profil_id is distinct from lf.compte_id
    and not exists (select 1 from public.roles r where r.profil_id = p.profil_id and r.role in ('moderateur', 'admin', 'super_admin'))
  group by p.profil_id, pr.prenom, pr.nom, lf.nb_lecons;
$$;

-- ─── Droits d'exécution ─────────────────────────────────────────────────────────────────────────────
revoke execute on function public.editeur_de_lecon(uuid) from public, anon, authenticated;
revoke execute on function public.normaliser_reponse(text) from public, anon, authenticated;
revoke execute on function public.quiz_publiable() from public, anon, authenticated;
revoke execute on function public.quiz_editeur(uuid) from public, anon;
grant execute on function public.quiz_editeur(uuid) to authenticated;
revoke execute on function public.enregistrer_quiz(uuid, jsonb) from public, anon;
grant execute on function public.enregistrer_quiz(uuid, jsonb) to authenticated;
revoke execute on function public.quiz_a_passer(uuid) from public, anon;
grant execute on function public.quiz_a_passer(uuid) to authenticated;
revoke execute on function public.envoyer_quiz(uuid, jsonb) from public, anon;
grant execute on function public.envoyer_quiz(uuid, jsonb) to authenticated;
revoke execute on function public.mes_scores_quiz(uuid) from public, anon;
grant execute on function public.mes_scores_quiz(uuid) to authenticated;
revoke execute on function public.questions_par_quiz(uuid) from public, anon;
grant execute on function public.questions_par_quiz(uuid) to authenticated;

commit;

-- ═══ 0032_exercices.sql ═══
-- Étudium, migration 0032 : les exercices (lot 3, étape B ; spec du lot 3, §3).
--
-- Un exercice est une leçon de type « exercice » (0031) : sa consigne est le texte de la leçon, ses fichiers fournis sont
-- ses ressources. Il est « simple » (l'étudiant le marque comme terminé) ou « avec rendu » (l'étudiant dépose un
-- fichier, que le formateur de la formation ou l'équipe corrige). Chaque dépôt est une version, conservée ; un fichier
-- ne se remplace pas tant qu'il n'est pas corrigé. Tout passe par des fonctions : les tables restent fermées.
--
-- À coller dans l'éditeur SQL de Supabase, après la 0031. Rejouable.

begin;

-- ─── Le genre d'un exercice ───────────────────────────────────────────────────────────────────────────
alter table public.lecons add column if not exists genre_exercice text;
alter table public.lecons drop constraint if exists lecons_genre_exercice;
alter table public.lecons add constraint lecons_genre_exercice check (genre_exercice is null or genre_exercice in ('simple', 'rendu'));
update public.lecons set genre_exercice = 'rendu' where type = 'exercice' and genre_exercice is null;
update public.lecons set genre_exercice = null where type <> 'exercice' and genre_exercice is not null;

-- Un exercice est « avec rendu » sauf choix contraire ; les autres éléments du programme n'ont pas de genre.
create or replace function public.genre_exercice_par_defaut()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.type = 'exercice' then
    new.genre_exercice := coalesce(new.genre_exercice, 'rendu');
  else
    new.genre_exercice := null;
  end if;
  return new;
end;
$$;

drop trigger if exists lecons_genre_exercice on public.lecons;
create trigger lecons_genre_exercice
  before insert or update of type, genre_exercice on public.lecons
  for each row execute function public.genre_exercice_par_defaut();

-- ─── Les rendus (lus et écrits par les fonctions seulement) ───────────────────────────────────────────
create table if not exists public.rendus_exercices (
  id uuid primary key default gen_random_uuid(),
  lecon_id uuid not null references public.lecons (id) on delete cascade,
  profil_id uuid not null references public.profils (id) on delete cascade,
  version integer not null,
  -- Le chemin dans l'espace « rendus » ; null pour un exercice simple.
  fichier text,
  nom_fichier text not null default '',
  format text not null default '',
  taille_octets bigint not null default 0,
  message text not null default '',
  statut text not null default 'en_attente',
  -- La remarque (à corriger) ou le commentaire (validé) du correcteur.
  remarque text not null default '',
  corrige_par uuid references public.profils (id) on delete set null,
  corrige_le timestamptz,
  cree_le timestamptz not null default now(),
  constraint rendus_exercices_statut check (statut in ('en_attente', 'a_corriger', 'valide')),
  constraint rendus_exercices_message check (char_length(message) <= 1000),
  constraint rendus_exercices_remarque check (char_length(remarque) <= 2000),
  constraint rendus_exercices_version unique (profil_id, lecon_id, version)
);
create index if not exists rendus_exercices_statut_idx on public.rendus_exercices (statut, cree_le);
create index if not exists rendus_exercices_lecon_idx on public.rendus_exercices (lecon_id, profil_id, version desc);
create index if not exists rendus_exercices_fichier_idx on public.rendus_exercices (fichier);
alter table public.rendus_exercices enable row level security;
revoke all on public.rendus_exercices from anon, authenticated;

-- ─── Outils ─────────────────────────────────────────────────────────────────────────────────────────
-- PDF, Word, Excel, PowerPoint, image (JPG, PNG, WebP) ou ZIP (choix 7 de la spec).
create or replace function public.formats_rendu()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint',
    'application/zip'
  ]::text[];
$$;

-- « Aïcha Kpadé ».
create or replace function public.nom_du_profil(p_profil uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(btrim(p.prenom || ' ' || p.nom), '') from public.profils p where p.id = p_profil;
$$;

-- La dernière version de chaque étudiant à chaque exercice.
create or replace view public.derniers_rendus with (security_invoker = true) as
  select distinct on (r.lecon_id, r.profil_id) r.*
  from public.rendus_exercices r
  order by r.lecon_id, r.profil_id, r.version desc;
revoke all on public.derniers_rendus from anon, authenticated;

-- Une version en JSON, pour l'étudiant comme pour le correcteur.
create or replace function public.version_rendu(r public.rendus_exercices)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', r.id, 'version', r.version, 'nom_fichier', r.nom_fichier, 'format', r.format, 'taille_octets', r.taille_octets,
    'message', r.message, 'statut', r.statut, 'remarque', r.remarque, 'correcteur', public.nom_du_profil(r.corrige_par),
    'corrige_le', r.corrige_le, 'cree_le', r.cree_le, 'a_un_fichier', r.fichier is not null
  );
$$;

-- Le rang d'un module dans sa formation (« Module 3 »).
create or replace function public.rang_du_module(p_module uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*)::integer + 1 from public.modules m2 where m2.formation_id = m.formation_id and (m2.ordre, m2.id) < (m.ordre, m.id))
  from public.modules m
  where m.id = p_module;
$$;

-- ─── L'espace des fichiers rendus ───────────────────────────────────────────────────────────────────
-- Le fichier d'un rendu que l'on corrige (formateur de la formation, équipe).
create or replace function public.rendu_lisible(p_nom text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.rendus_exercices r where r.fichier = p_nom and public.editeur_de_lecon(r.lecon_id));
$$;

-- Un fichier attaché à un rendu ne s'efface plus.
create or replace function public.rendu_attache(p_nom text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.rendus_exercices r where r.fichier = p_nom);
$$;

-- Privé, 20 Mo, les formats acceptés. Chacun dépose dans son dossier (« <compte>/… ») ; on lit le sien, ou celui d'un
-- rendu que l'on corrige ; on supprime le sien tant qu'aucun rendu ne l'attache, et le correcteur ceux de ses rendus
-- (pour les retirer avant de supprimer la leçon).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rendus', 'rendus', false, 20971520, public.formats_rendu())
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "rendus : déposer dans son dossier" on storage.objects;
create policy "rendus : déposer dans son dossier" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'rendus'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not (select public.compte_suspendu())
  );

drop policy if exists "rendus : lire" on storage.objects;
create policy "rendus : lire" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'rendus'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.rendu_lisible(objects.name)))
  );

drop policy if exists "rendus : supprimer" on storage.objects;
create policy "rendus : supprimer" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'rendus'
    and (
      ((storage.foldername(name))[1] = (select auth.uid())::text and not (select public.rendu_attache(objects.name)))
      or (select public.rendu_lisible(objects.name))
    )
  );

-- ─── Côté étudiant ──────────────────────────────────────────────────────────────────────────────────
-- L'exercice et ses versions (de la plus récente à la plus ancienne) ; null sans accès ou si ce n'est pas un exercice.
create or replace function public.exercice_etudiant(p_lecon uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_genre text;
  v_statut text;
begin
  if v_uid is null or not public.acces_lecon(p_lecon) then
    return null;
  end if;
  select l.genre_exercice into v_genre from public.lecons l where l.id = p_lecon and l.type = 'exercice';
  if not found then
    return null;
  end if;
  select d.statut into v_statut from public.derniers_rendus d where d.lecon_id = p_lecon and d.profil_id = v_uid;
  return jsonb_build_object(
    'genre', v_genre,
    'statut', v_statut,
    'peut_deposer', v_genre = 'rendu' and (v_statut is null or v_statut = 'a_corriger'),
    'versions', coalesce((
      select jsonb_agg(public.version_rendu(r) order by r.version desc)
      from public.rendus_exercices r
      where r.lecon_id = p_lecon and r.profil_id = v_uid
    ), '[]'::jsonb)
  );
end;
$$;

-- Dépose un travail : le fichier, déjà dans le dossier du compte, devient la version suivante, en attente de correction.
create or replace function public.rendre_exercice(p_lecon uuid, p_fichier text, p_nom text, p_message text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_genre text;
  v_statut text;
  v_format text;
  v_taille bigint;
  v_version integer;
  v_id uuid;
  v_formateur uuid;
  v_titre text;
  v_message text := left(btrim(coalesce(p_message, '')), 1000);
  v_nom text := left(coalesce(nullif(btrim(coalesce(p_nom, '')), ''), 'travail'), 200);
begin
  if v_uid is null or not public.acces_lecon(p_lecon) then
    raise exception 'Cet exercice ne vous est pas ouvert.' using errcode = '42501';
  end if;
  select l.genre_exercice into v_genre from public.lecons l where l.id = p_lecon and l.type = 'exercice';
  if not found then
    raise exception 'Cet exercice ne vous est pas ouvert.' using errcode = '42501';
  end if;
  if v_genre <> 'rendu' then
    raise exception 'Cet exercice se termine sans dépôt.';
  end if;
  -- Un dépôt à la fois, par étudiant et par exercice (deux onglets).
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || p_lecon::text, 0));
  select d.statut into v_statut from public.derniers_rendus d where d.lecon_id = p_lecon and d.profil_id = v_uid;
  if v_statut = 'en_attente' then
    raise exception 'Votre travail attend déjà sa correction.';
  end if;
  if v_statut = 'valide' then
    raise exception 'Cet exercice est déjà validé.';
  end if;
  if (select count(*) from public.rendus_exercices r where r.profil_id = v_uid and r.cree_le > now() - interval '10 minutes') >= 20 then
    raise exception 'Trop de dépôts en peu de temps : réessayez dans quelques minutes.';
  end if;
  select o.metadata ->> 'mimetype', (o.metadata ->> 'size')::bigint into v_format, v_taille
  from storage.objects o
  -- Le dossier du compte suffit : seul le compte y dépose (« owner » n'est plus toujours rempli par Storage).
  where o.bucket_id = 'rendus' and o.name = p_fichier and (storage.foldername(o.name))[1] = v_uid::text;
  if not found or public.rendu_attache(p_fichier) then
    raise exception 'Ce fichier n’a pas été reçu. Déposez-le à nouveau.';
  end if;
  if v_format is null or not (v_format = any (public.formats_rendu())) then
    raise exception 'Ce format n’est pas accepté.';
  end if;
  if coalesce(v_taille, 0) > 20971520 then
    raise exception 'Le fichier dépasse 20 Mo.';
  end if;

  select coalesce(max(r.version), 0) + 1 into v_version from public.rendus_exercices r where r.lecon_id = p_lecon and r.profil_id = v_uid;
  insert into public.rendus_exercices (lecon_id, profil_id, version, fichier, nom_fichier, format, taille_octets, message)
  values (p_lecon, v_uid, v_version, p_fichier, v_nom, v_format, coalesce(v_taille, 0), v_message)
  returning id into v_id;

  -- Le formateur de la formation est prévenu (l'équipe voit la liste des corrections).
  select fo.compte_id, l.titre into v_formateur, v_titre
  from public.lecons l
  join public.modules m on m.id = l.module_id
  join public.formations f on f.id = m.formation_id
  left join public.formateurs fo on fo.id = f.formateur_id
  where l.id = p_lecon;
  if v_formateur is not null and v_formateur <> v_uid then
    perform public.notifier(
      array[v_formateur], 'exercices', 'Nouveau travail à corriger',
      coalesce(public.nom_du_profil(v_uid), 'Un étudiant') || ' · ' || v_titre, '/formateur/corrections/' || v_id
    );
  end if;
  return jsonb_build_object('id', v_id, 'version', v_version, 'statut', 'en_attente');
end;
$$;

-- « Marquer comme terminé » : un exercice simple est validé aussitôt (une fois).
create or replace function public.terminer_exercice(p_lecon uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_genre text;
begin
  if v_uid is null or not public.acces_lecon(p_lecon) then
    raise exception 'Cet exercice ne vous est pas ouvert.' using errcode = '42501';
  end if;
  select l.genre_exercice into v_genre from public.lecons l where l.id = p_lecon and l.type = 'exercice';
  if not found then
    raise exception 'Cet exercice ne vous est pas ouvert.' using errcode = '42501';
  end if;
  if v_genre <> 'simple' then
    raise exception 'Cet exercice demande un dépôt.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || p_lecon::text, 0));
  if not exists (select 1 from public.rendus_exercices r where r.lecon_id = p_lecon and r.profil_id = v_uid and r.statut = 'valide') then
    insert into public.rendus_exercices (lecon_id, profil_id, version, statut)
    values (p_lecon, v_uid, coalesce((select max(r.version) from public.rendus_exercices r where r.lecon_id = p_lecon and r.profil_id = v_uid), 0) + 1, 'valide');
  end if;
  return jsonb_build_object('statut', 'valide');
end;
$$;

-- La page « Exercices » : les exercices où le compte a rendu au moins une fois, le plus récent d'abord.
create or replace function public.mes_exercices()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(s.x order by s.quand desc), '[]'::jsonb)
  from (
    select
      jsonb_build_object(
        'lecon_id', l.id, 'titre', l.titre, 'genre', l.genre_exercice, 'formation', f.titre, 'slug', f.slug,
        'module', m.titre, 'module_rang', public.rang_du_module(m.id), 'statut', d.statut, 'version', d.version,
        'remarque', d.remarque, 'correcteur', public.nom_du_profil(d.corrige_par), 'corrige_le', d.corrige_le, 'cree_le', d.cree_le
      ) as x,
      coalesce(d.corrige_le, d.cree_le) as quand
    from public.derniers_rendus d
    join public.lecons l on l.id = d.lecon_id
    join public.modules m on m.id = l.module_id
    join public.formations f on f.id = m.formation_id
    where d.profil_id = (select auth.uid())
  ) s;
$$;

-- Le dernier statut du compte à chaque exercice d'une formation : { "<leçon>": "valide", … }.
create or replace function public.mes_statuts_exercices(p_formation uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(d.lecon_id::text, d.statut), '{}'::jsonb)
  from public.derniers_rendus d
  join public.lecons l on l.id = d.lecon_id
  join public.modules m on m.id = l.module_id
  where d.profil_id = (select auth.uid()) and m.formation_id = p_formation;
$$;

-- ─── Côté correcteur (formateur de la formation, équipe) ───────────────────────────────────────────
-- Les travaux en attente (la dernière version de chacun), les plus anciens d'abord.
create or replace function public.corrections_a_faire()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(s.x order by s.quand), '[]'::jsonb)
  from (
    select
      jsonb_build_object(
        'rendu_id', d.id, 'etudiant', coalesce(public.nom_du_profil(d.profil_id), 'Étudiant'), 'exercice', l.titre,
        'formation', f.titre, 'formation_id', f.id, 'module', m.titre, 'module_rang', public.rang_du_module(m.id),
        'version', d.version, 'nom_fichier', d.nom_fichier, 'depose_le', d.cree_le
      ) as x,
      d.cree_le as quand
    from public.derniers_rendus d
    join public.lecons l on l.id = d.lecon_id
    join public.modules m on m.id = l.module_id
    join public.formations f on f.id = m.formation_id
    where d.statut = 'en_attente'
      and not public.compte_suspendu()
      and (public.equipe_contenus() or public.formateur_de(f.id))
  ) s;
$$;

-- Un travail à corriger : l'étudiant, l'exercice et sa consigne, la version, l'historique, le travail suivant.
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
      'exercice', jsonb_build_object('id', l.id, 'titre', l.titre, 'genre', l.genre_exercice, 'consigne', coalesce(c.texte, '')),
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

-- Le fichier d'un rendu (chemin et nom), pour son auteur ou un correcteur : le lien de téléchargement se fait ensuite.
create or replace function public.fichier_rendu(p_rendu uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('chemin', r.fichier, 'nom', r.nom_fichier)
  from public.rendus_exercices r
  where r.id = p_rendu and r.fichier is not null and (r.profil_id = (select auth.uid()) or public.editeur_de_lecon(r.lecon_id));
$$;

-- « Valider l'exercice » (commentaire facultatif) ou « Demander une correction » (remarque exigée) ; l'étudiant est prévenu.
create or replace function public.corriger_rendu(p_rendu uuid, p_decision text, p_remarque text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.rendus_exercices;
  v_remarque text := left(btrim(coalesce(p_remarque, '')), 2000);
  v_titre text;
  v_lien text;
begin
  select * into v_r from public.rendus_exercices r where r.id = p_rendu for update;
  if not found or not public.editeur_de_lecon(v_r.lecon_id) then
    raise exception 'Cette formation n’est pas l’une de vos formations.' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('valide', 'a_corriger') then
    raise exception 'Décision inconnue.';
  end if;
  if v_r.statut <> 'en_attente' or exists (
    select 1 from public.rendus_exercices r where r.lecon_id = v_r.lecon_id and r.profil_id = v_r.profil_id and r.version > v_r.version
  ) then
    raise exception 'Ce travail a déjà été corrigé.';
  end if;
  if p_decision = 'a_corriger' and v_remarque = '' then
    raise exception 'Expliquez ce qu’il faut corriger.';
  end if;
  update public.rendus_exercices
  set statut = p_decision, remarque = v_remarque, corrige_par = (select auth.uid()), corrige_le = now()
  where id = p_rendu;

  select l.titre, '/formations/' || f.slug || '/lecons/' || l.id into v_titre, v_lien
  from public.lecons l
  join public.modules m on m.id = l.module_id
  join public.formations f on f.id = m.formation_id
  where l.id = v_r.lecon_id;
  perform public.notifier(
    array[v_r.profil_id], 'exercices',
    case when p_decision = 'valide' then 'Exercice validé' else 'Une correction est demandée' end,
    v_titre, v_lien
  );
  return jsonb_build_object('statut', p_decision);
end;
$$;

-- ─── Effacer les fichiers avec la leçon, ou avec le compte ─────────────────────────────────────────
-- Les chemins des fichiers rendus de ces leçons, pour leurs correcteurs : on les retire avant de supprimer les leçons.
create or replace function public.fichiers_rendus(p_lecons uuid[])
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(r.fichier), '{}'::text[])
  from public.rendus_exercices r
  where r.lecon_id = any (p_lecons) and r.fichier is not null and public.editeur_de_lecon(r.lecon_id);
$$;

-- Le compte s'efface : ses rendus partent, et les chemins de leurs fichiers reviennent pour que l'appli les retire.
create or replace function public.oublier_mes_rendus()
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chemins text[];
begin
  with partis as (
    delete from public.rendus_exercices r where r.profil_id = (select auth.uid()) returning r.fichier
  )
  select coalesce(array_agg(fichier) filter (where fichier is not null), '{}'::text[]) into v_chemins from partis;
  return v_chemins;
end;
$$;

-- ─── Droits d'exécution ─────────────────────────────────────────────────────────────────────────────
revoke execute on function public.genre_exercice_par_defaut() from public, anon, authenticated;
revoke execute on function public.formats_rendu() from public, anon;
grant execute on function public.formats_rendu() to authenticated;
revoke execute on function public.nom_du_profil(uuid) from public, anon, authenticated;
revoke execute on function public.version_rendu(public.rendus_exercices) from public, anon, authenticated;
revoke execute on function public.rang_du_module(uuid) from public, anon, authenticated;
revoke execute on function public.rendu_lisible(text) from public, anon;
grant execute on function public.rendu_lisible(text) to authenticated;
revoke execute on function public.rendu_attache(text) from public, anon;
grant execute on function public.rendu_attache(text) to authenticated;
revoke execute on function public.exercice_etudiant(uuid) from public, anon;
grant execute on function public.exercice_etudiant(uuid) to authenticated;
revoke execute on function public.rendre_exercice(uuid, text, text, text) from public, anon;
grant execute on function public.rendre_exercice(uuid, text, text, text) to authenticated;
revoke execute on function public.terminer_exercice(uuid) from public, anon;
grant execute on function public.terminer_exercice(uuid) to authenticated;
revoke execute on function public.mes_exercices() from public, anon;
grant execute on function public.mes_exercices() to authenticated;
revoke execute on function public.mes_statuts_exercices(uuid) from public, anon;
grant execute on function public.mes_statuts_exercices(uuid) to authenticated;
revoke execute on function public.corrections_a_faire() from public, anon;
grant execute on function public.corrections_a_faire() to authenticated;
revoke execute on function public.rendu_a_corriger(uuid) from public, anon;
grant execute on function public.rendu_a_corriger(uuid) to authenticated;
revoke execute on function public.fichier_rendu(uuid) from public, anon;
grant execute on function public.fichier_rendu(uuid) to authenticated;
revoke execute on function public.corriger_rendu(uuid, text, text) from public, anon;
grant execute on function public.corriger_rendu(uuid, text, text) to authenticated;
revoke execute on function public.fichiers_rendus(uuid[]) from public, anon;
grant execute on function public.fichiers_rendus(uuid[]) to authenticated;
revoke execute on function public.oublier_mes_rendus() from public, anon;
grant execute on function public.oublier_mes_rendus() to authenticated;

commit;

-- ═══ 0033_certificats.sql ═══
-- Étudium, migration 0033 : la validation des formations et les certificats (lot 3, étape C ; spec du lot 3, §4 à §7).
--
-- Une formation est validée quand toutes ses leçons publiées sont terminées, tous ses quiz publiés réussis (meilleur
-- score ≥ score minimal) et, si « Exercices obligatoires », tous ses exercices publiés validés. Le certificat est alors
-- délivré, une seule fois, avec ses informations figées (titulaire, formation, formateur, parcours, date) et un
-- identifiant tiré au hasard. Il reste vérifiable par tous, même si le compte est supprimé.
--
-- À coller dans l'éditeur SQL de Supabase, après la 0032. Rejouable.

begin;

-- ─── Le réglage de certification ────────────────────────────────────────────────────────────────────
alter table public.formations add column if not exists exercices_obligatoires boolean not null default true;

-- ─── Les certificats (lus et écrits par les fonctions seulement) ──────────────────────────────────────
create table if not exists public.certificats (
  id uuid primary key default gen_random_uuid(),
  -- « ET-2026-K7Q2-M9XD » : impossible à deviner, donc impossible de parcourir les certificats des autres.
  identifiant text not null,
  -- Le compte supprimé, le certificat reste (nom figé ci-dessous) ; la formation supprimée aussi.
  profil_id uuid references public.profils (id) on delete set null,
  formation_id uuid references public.formations (id) on delete set null,
  titulaire text not null,
  formation_titre text not null,
  formateur_nom text not null default '',
  parcours_nom text not null default '',
  delivre_le date not null,
  cree_le timestamptz not null default now(),
  -- La fenêtre « Félicitations » montrée une fois.
  vu_le timestamptz,
  constraint certificats_identifiant_unique unique (identifiant),
  constraint certificats_un_par_formation unique (profil_id, formation_id)
);
create index if not exists certificats_formation_idx on public.certificats (formation_id);
alter table public.certificats enable row level security;
revoke all on public.certificats from anon, authenticated;

-- ─── L'état de validation ───────────────────────────────────────────────────────────────────────────
-- Les conditions d'un compte pour une formation : leçons terminées, quiz réussis, exercices validés (publiés seulement).
create or replace function public.etat_validation(p_profil uuid, p_formation uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with elements as (
    select l.id, l.titre, l.type, l.ordre, m.ordre as module_ordre
    from public.lecons l
    join public.modules m on m.id = l.module_id
    where m.formation_id = p_formation and l.publiee
  ),
  lecons as (
    select
      count(*) filter (where e.type = 'lecon') as total,
      count(*) filter (where e.type = 'lecon' and exists (
        select 1 from public.progression_lecons p where p.profil_id = p_profil and p.lecon_id = e.id and p.terminee_le is not null
      )) as terminees
    from elements e
  ),
  quiz as (
    select e.id, e.titre, e.module_ordre, e.ordre,
      (select max(t.score) from public.tentatives_quiz t where t.profil_id = p_profil and t.lecon_id = e.id) as meilleur
    from elements e
    where e.type = 'quiz'
  ),
  exercices as (
    select e.id, e.titre, e.module_ordre, e.ordre,
      (select d.statut from public.derniers_rendus d where d.profil_id = p_profil and d.lecon_id = e.id) as statut
    from elements e
    where e.type = 'exercice'
  )
  select jsonb_build_object(
    'lecons', (select jsonb_build_object('terminees', l.terminees, 'total', l.total) from lecons l),
    'minimum', f.score_quiz,
    'exercices_obligatoires', f.exercices_obligatoires,
    'quiz', coalesce((
      select jsonb_agg(jsonb_build_object('id', q.id, 'titre', q.titre, 'meilleur', q.meilleur, 'reussi', coalesce(q.meilleur >= f.score_quiz, false))
        order by q.module_ordre, q.ordre)
      from quiz q
    ), '[]'::jsonb),
    'exercices', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'titre', x.titre, 'statut', x.statut, 'valide', x.statut is not distinct from 'valide')
        order by x.module_ordre, x.ordre)
      from exercices x
    ), '[]'::jsonb),
    'complet', (select l.total > 0 and l.terminees = l.total from lecons l)
      and not exists (select 1 from quiz q where coalesce(q.meilleur, -1) < f.score_quiz)
      and (not f.exercices_obligatoires or not exists (select 1 from exercices x where x.statut is distinct from 'valide'))
  )
  from public.formations f
  where f.id = p_formation;
$$;

-- « ET-2026-K7Q2-M9XD » : l'année, puis 8 caractères tirés au hasard (sans 0, O, 1, I, faciles à confondre).
create or replace function public.identifiant_certificat()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_octets bytea;
  v_code text := '';
  v_rang integer;
begin
  v_octets := uuid_send(gen_random_uuid());
  -- Les octets 6 et 8 portent la version et la variante de l'UUID : ils ne sont pas tirés au hasard.
  foreach v_rang in array array[0, 1, 2, 3, 4, 5, 10, 11] loop
    v_code := v_code || substr(v_alphabet, 1 + (get_byte(v_octets, v_rang) % 32), 1);
  end loop;
  return 'ET-' || extract(year from (now() at time zone 'Africa/Porto-Novo'))::integer || '-' || left(v_code, 4) || '-' || right(v_code, 4);
end;
$$;

-- Délivre le certificat si toutes les conditions sont remplies (formation publiée), une seule fois.
create or replace function public.delivrer_si_complet(p_profil uuid, p_formation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_f record;
  v_identifiant text;
begin
  if p_profil is null or p_formation is null then
    return;
  end if;
  if exists (select 1 from public.certificats c where c.profil_id = p_profil and c.formation_id = p_formation) then
    return;
  end if;
  select f.id, f.titre, f.slug, f.statut, f.formateur_id into v_f from public.formations f where f.id = p_formation;
  if not found or v_f.statut <> 'publiee' then
    return;
  end if;
  if not coalesce((public.etat_validation(p_profil, p_formation) ->> 'complet')::boolean, false) then
    return;
  end if;
  -- Deux événements au même instant (dernière leçon et quiz) : un seul certificat.
  perform pg_advisory_xact_lock(hashtextextended('certificat' || p_profil::text || p_formation::text, 0));
  if exists (select 1 from public.certificats c where c.profil_id = p_profil and c.formation_id = p_formation) then
    return;
  end if;
  loop
    v_identifiant := public.identifiant_certificat();
    exit when not exists (select 1 from public.certificats c where c.identifiant = v_identifiant);
  end loop;
  insert into public.certificats (identifiant, profil_id, formation_id, titulaire, formation_titre, formateur_nom, parcours_nom, delivre_le)
  values (
    v_identifiant,
    p_profil,
    p_formation,
    coalesce(public.nom_du_profil(p_profil), 'Étudiant Étudium'),
    v_f.titre,
    coalesce((select fo.nom from public.formateurs fo where fo.id = v_f.formateur_id), ''),
    coalesce((
      select p.nom from public.formations_parcours fp join public.parcours p on p.id = fp.parcours_id
      where fp.formation_id = p_formation order by fp.ordre, p.nom limit 1
    ), ''),
    (now() at time zone 'Africa/Porto-Novo')::date
  );
  -- Version à 6 paramètres : l'étudiant qui remplit lui-même la dernière condition est prévenu aussi.
  perform public.notifier(array[p_profil], 'service', 'Votre certificat est prêt', v_f.titre, '/formations/' || v_f.slug || '/validation', true);
end;
$$;

-- ─── Les événements qui peuvent remplir la dernière condition ───────────────────────────────────────
create or replace function public.certificat_apres_progression()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.delivrer_si_complet(new.profil_id, public.formation_de_la_lecon(new.lecon_id));
  return null;
end;
$$;

drop trigger if exists progression_certificat_insertion on public.progression_lecons;
create trigger progression_certificat_insertion
  after insert on public.progression_lecons
  for each row when (new.terminee_le is not null)
  execute function public.certificat_apres_progression();

drop trigger if exists progression_certificat_fin on public.progression_lecons;
create trigger progression_certificat_fin
  after update of terminee_le on public.progression_lecons
  for each row when (old.terminee_le is null and new.terminee_le is not null)
  execute function public.certificat_apres_progression();

create or replace function public.certificat_apres_tentative()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.delivrer_si_complet(new.profil_id, public.formation_de_la_lecon(new.lecon_id));
  return null;
end;
$$;

drop trigger if exists tentatives_certificat on public.tentatives_quiz;
create trigger tentatives_certificat
  after insert on public.tentatives_quiz
  for each row execute function public.certificat_apres_tentative();

create or replace function public.certificat_apres_rendu()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.delivrer_si_complet(new.profil_id, public.formation_de_la_lecon(new.lecon_id));
  return null;
end;
$$;

drop trigger if exists rendus_certificat on public.rendus_exercices;
create trigger rendus_certificat
  after insert or update of statut on public.rendus_exercices
  for each row when (new.statut = 'valide')
  execute function public.certificat_apres_rendu();

-- ─── Côté étudiant ──────────────────────────────────────────────────────────────────────────────────
-- Un certificat en JSON (ce que montre le certificat, et rien d'autre).
create or replace function public.certificat_json(c public.certificats)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'identifiant', c.identifiant, 'titulaire', c.titulaire, 'formation', c.formation_titre, 'formateur', c.formateur_nom,
    'parcours', c.parcours_nom, 'delivre_le', c.delivre_le
  );
$$;

-- La page « Validation de votre formation » : l'état, et le certificat (délivré ici si une condition a changé depuis).
create or replace function public.validation_formation(p_formation uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_etat jsonb;
begin
  if v_uid is null then
    return null;
  end if;
  perform public.delivrer_si_complet(v_uid, p_formation);
  v_etat := public.etat_validation(v_uid, p_formation);
  if v_etat is null then
    return null;
  end if;
  return v_etat || jsonb_build_object('certificat', (
    select public.certificat_json(c) || jsonb_build_object('vu', c.vu_le is not null)
    from public.certificats c
    where c.profil_id = v_uid and c.formation_id = p_formation
  ));
end;
$$;

-- La page « Certificats » : les certificats obtenus, et les formations commencées encore « en préparation ». Un
-- certificat devenu dû (un réglage changé depuis : score, exercices facultatifs) y est délivré au passage.
create or replace function public.mes_certificats()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_formation uuid;
begin
  if v_uid is null then
    return jsonb_build_object('obtenus', '[]'::jsonb, 'en_preparation', '[]'::jsonb);
  end if;
  for v_formation in
    select distinct m.formation_id
    from public.progression_lecons p
    join public.lecons l on l.id = p.lecon_id
    join public.modules m on m.id = l.module_id
    where p.profil_id = v_uid
  loop
    perform public.delivrer_si_complet(v_uid, v_formation);
  end loop;
  return (
    with commencees as (
      select distinct m.formation_id
      from public.progression_lecons p
      join public.lecons l on l.id = p.lecon_id
      join public.modules m on m.id = l.module_id
      where p.profil_id = v_uid
    ),
    etats as (
      select f.id, f.titre, f.slug, public.etat_validation(v_uid, f.id) as etat
      from commencees c
      join public.formations f on f.id = c.formation_id
      where f.statut = 'publiee'
        and not exists (select 1 from public.certificats x where x.profil_id = v_uid and x.formation_id = f.id)
    )
    select jsonb_build_object(
      -- La fiche n'est liée que si la formation est encore publiée (archivée, elle ne s'ouvre plus).
      'obtenus', coalesce((
        select jsonb_agg(public.certificat_json(c) || jsonb_build_object('slug', case when f.statut = 'publiee' then f.slug end)
          order by c.delivre_le desc, c.cree_le desc)
        from public.certificats c
        left join public.formations f on f.id = c.formation_id
        where c.profil_id = v_uid
      ), '[]'::jsonb),
      'en_preparation', coalesce((
        select jsonb_agg(jsonb_build_object(
          'formation_id', e.id, 'titre', e.titre, 'slug', e.slug,
          'terminees', (e.etat -> 'lecons' ->> 'terminees')::integer,
          'total', (e.etat -> 'lecons' ->> 'total')::integer,
          'quiz_restants', (select count(*) from jsonb_array_elements(e.etat -> 'quiz') q where not (q ->> 'reussi')::boolean),
          'exercices_restants', case when (e.etat ->> 'exercices_obligatoires')::boolean
            then (select count(*) from jsonb_array_elements(e.etat -> 'exercices') x where not (x ->> 'valide')::boolean) else 0 end
        ) order by e.titre)
        from etats e
      ), '[]'::jsonb)
    )
  );
end;
$$;

-- Le certificat à télécharger (image, PDF) : pour son titulaire seulement.
create or replace function public.mon_certificat(p_identifiant text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.certificat_json(c)
  from public.certificats c
  where c.identifiant = upper(btrim(p_identifiant)) and c.profil_id = (select auth.uid());
$$;

-- La fenêtre « Félicitations » a été montrée.
create or replace function public.marquer_certificat_vu(p_identifiant text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.certificats
  set vu_le = now()
  where identifiant = upper(btrim(p_identifiant)) and profil_id = (select auth.uid()) and vu_le is null;
$$;

-- ─── La vérification publique (sans compte) ─────────────────────────────────────────────────────────
create or replace function public.verifier_certificat(p_identifiant text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.certificat_json(c) from public.certificats c where c.identifiant = upper(btrim(coalesce(p_identifiant, '')));
$$;

-- ─── Côté formateur et équipe ───────────────────────────────────────────────────────────────────────
-- Les certificats délivrés dans ses formations (toutes pour l'équipe).
create or replace function public.certificats_formateur()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.certificats c
  where c.formation_id is not null
    and not public.compte_suspendu()
    and (public.equipe_contenus() or public.formateur_de(c.formation_id));
$$;

-- La fiche d'un étudiant : ses scores, ses exercices et son certificat, dans chaque formation du formateur qu'il a commencée.
create or replace function public.lot3_etudiant(p_etudiant uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with formations as (
    select distinct m.formation_id as id
    from public.progression_lecons p
    join public.lecons l on l.id = p.lecon_id
    join public.modules m on m.id = l.module_id
    where p.profil_id = p_etudiant
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'formation_id', f.id,
    'quiz', e.etat -> 'quiz',
    'exercices', e.etat -> 'exercices',
    'certificat', (select c.identifiant from public.certificats c where c.profil_id = p_etudiant and c.formation_id = f.id)
  )), '[]'::jsonb)
  from formations f
  cross join lateral (select public.etat_validation(p_etudiant, f.id) as etat) e
  where not public.compte_suspendu() and (public.equipe_contenus() or public.formateur_de(f.id));
$$;

-- ─── Droits d'exécution ─────────────────────────────────────────────────────────────────────────────
revoke execute on function public.etat_validation(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.identifiant_certificat() from public, anon, authenticated;
revoke execute on function public.delivrer_si_complet(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.certificat_apres_progression() from public, anon, authenticated;
revoke execute on function public.certificat_apres_tentative() from public, anon, authenticated;
revoke execute on function public.certificat_apres_rendu() from public, anon, authenticated;
revoke execute on function public.certificat_json(public.certificats) from public, anon, authenticated;
revoke execute on function public.validation_formation(uuid) from public, anon;
grant execute on function public.validation_formation(uuid) to authenticated;
revoke execute on function public.mes_certificats() from public, anon;
grant execute on function public.mes_certificats() to authenticated;
revoke execute on function public.mon_certificat(text) from public, anon;
grant execute on function public.mon_certificat(text) to authenticated;
revoke execute on function public.marquer_certificat_vu(text) from public, anon;
grant execute on function public.marquer_certificat_vu(text) to authenticated;
revoke execute on function public.verifier_certificat(text) from public;
grant execute on function public.verifier_certificat(text) to anon, authenticated;
revoke execute on function public.certificats_formateur() from public, anon;
grant execute on function public.certificats_formateur() to authenticated;
revoke execute on function public.lot3_etudiant(uuid) from public, anon;
grant execute on function public.lot3_etudiant(uuid) to authenticated;

commit;

-- ═══ 0034_finitions_lot_3.sql ═══
-- Étudium, migration 0034 : finitions du lot 3 (défauts reportés des étapes A et B).
--
-- - Un quiz se réussit et un exercice se termine depuis sa page : « Terminer la leçon » (terminer_lecon) les refuse,
--   même appelé directement, pour qu'un étudiant ne fausse pas sa propre progression.
-- - La notification de publication dit ce qui paraît : « Nouveau quiz », « Nouvel exercice » ou « Nouvelle leçon ».
-- - L'aperçu gratuit concerne les leçons seulement : un quiz ou un exercice coché « aperçu » avant ce lot restait
--   ouvert sans abonnement (acces_lecon). Les anciens sont décochés, et la base ne l'accepte plus.
-- - Garde-fous : un choix ou une réponse acceptée d'un quiz tient en 300 caractères (comme dans l'appli) ; un fichier
--   déposé ne s'attache qu'à un seul rendu.
--
-- Rien de nouveau à lire pour l'appli : elle marche avant comme après. À coller dans l'éditeur SQL de Supabase, après
-- la 0033. Rejouable.

begin;

-- ─── Terminer une leçon (reprise de la 0030) : jamais un quiz ni un exercice ─────────────────────────
create or replace function public.terminer_lecon(p_lecon uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text;
begin
  if (select auth.uid()) is null or not public.acces_lecon(p_lecon) then
    raise exception 'Leçon inaccessible.' using errcode = '42501';
  end if;
  select l.type into v_type from public.lecons l where l.id = p_lecon;
  if v_type = 'quiz' then
    raise exception 'Un quiz se réussit, il ne se termine pas.' using errcode = '22023';
  end if;
  if v_type = 'exercice' then
    raise exception 'Un exercice se termine depuis sa page.' using errcode = '22023';
  end if;
  -- YouTube et Vimeo se terminent en les regardant (seuil). Une vidéo sans mesure (Drive, Loom, ScreenPal) se
  -- termine d'un clic ; TikTok et Tella aussi, en secours quand leur lecteur ne répond pas.
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

-- ─── La notification de publication (reprise de la 0027) : selon ce qui paraît ──────────────────────
create or replace function public.notifications_lecons()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_formation record;
  v_titre text;
begin
  select f.id, f.titre, f.slug, f.statut into v_formation
  from public.modules m
  join public.formations f on f.id = m.formation_id
  where m.id = new.module_id;
  -- À la publication (insérée publiée, ou passée de brouillon à publiée), pas à chaque modification.
  if found and v_formation.statut = 'publiee' and new.publiee and (tg_op = 'INSERT' or not old.publiee) then
    v_titre := case new.type
      when 'quiz' then 'Nouveau quiz dans '
      when 'exercice' then 'Nouvel exercice dans '
      else 'Nouvelle leçon dans '
    end || v_formation.titre;
    perform public.notifier(
      public.suiveurs_formation(v_formation.id), 'nouveaux_contenus', v_titre,
      new.titre, '/formations/' || v_formation.slug || '/lecons/' || new.id
    );
  end if;
  return null;
end;
$$;

-- ─── L'aperçu gratuit : les leçons seulement ────────────────────────────────────────────────────────
-- La case a disparu de l'éditeur d'un quiz et d'un exercice ; ceux qui étaient cochés sont décochés (seul le
-- déclencheur de date de modification réagit), puis la base refuse un quiz ou un exercice « aperçu ».
update public.lecons set apercu = false where apercu and type <> 'lecon';
alter table public.lecons drop constraint if exists lecons_apercu_lecons;
alter table public.lecons add constraint lecons_apercu_lecons check (not apercu or type = 'lecon');

-- ─── Les réponses d'un quiz : 300 caractères au plus (comme dans l'appli) ────────────────────────────
create or replace function public.longueurs_quiz_ok(p_choix jsonb, p_reponses text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce((
      select bool_and(char_length(coalesce(c ->> 'texte', '')) <= 300)
      from jsonb_array_elements(case when jsonb_typeof(p_choix) = 'array' then p_choix else '[]'::jsonb end) c
    ), true)
    and coalesce((select bool_and(char_length(r) <= 300) from unnest(p_reponses) r), true);
$$;

-- « not valid » : vérifiée pour toute question écrite ou réécrite, sans bloquer une ancienne ligne laissée telle quelle.
alter table public.questions_quiz drop constraint if exists questions_quiz_longueurs;
alter table public.questions_quiz add constraint questions_quiz_longueurs check (public.longueurs_quiz_ok(choix, reponses)) not valid;

-- ─── Un fichier déposé ne s'attache qu'à un seul rendu ───────────────────────────────────────────────
create unique index if not exists rendus_exercices_fichier_unique on public.rendus_exercices (fichier) where fichier is not null;

revoke execute on function public.longueurs_quiz_ok(jsonb, text[]) from public, anon, authenticated;

commit;
