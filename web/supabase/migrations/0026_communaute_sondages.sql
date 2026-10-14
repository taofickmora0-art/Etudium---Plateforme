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
