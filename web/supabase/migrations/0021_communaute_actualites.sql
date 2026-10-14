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
