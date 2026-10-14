-- Étudium · migration 0020 : la modération (spec de la modération, 14 octobre 2026).
-- À appliquer dans Supabase, après la 0019 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancé sur une base qui l'a déjà, il ne change rien et ne casse rien (le jeton est conservé). Si la 0019
-- est rejouée un jour, rejouer celle-ci ensuite.
-- L'analyse automatique se fait sur le serveur de l'application, qui transmet le verdict avec le jeton de modération :
-- la base n'applique qu'un verdict qui le porte. Analyse active, une publication sans verdict valide attend l'équipe.

begin;

-- ─── Publications : statut et verdict de l'analyse ───────────────────────────────────────────────────────────────
-- « publiee » (en ligne), « en_attente » (vue par son auteur et l'équipe), « bloquee » (vue par l'équipe seule).
alter table public.publications add column if not exists statut text not null default 'publiee';
alter table public.publications add column if not exists verdict jsonb;
-- Signalée par l'analyse, ou analyse impossible : dans la file de l'équipe.
alter table public.publications add column if not exists a_examiner boolean not null default false;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'publications_statut_valeurs') then
    alter table public.publications add constraint publications_statut_valeurs check (statut in ('publiee', 'en_attente', 'bloquee'));
  end if;
end;
$$;
create index if not exists publications_moderation_idx on public.publications (cree_le) where statut <> 'publiee' or a_examiner;
create index if not exists publications_auteur_recent_idx on public.publications (auteur, cree_le);
create index if not exists commentaires_auteur_recent_idx on public.commentaires_publications (auteur, cree_le);

-- ─── Réglages : le jeton et l'analyse active ────────────────────────────────────────────────────────
-- Une seule ligne, fermée à tous : seules les fonctions plus bas la lisent. L'utilisateur lit le jeton dans l'éditeur
-- SQL (select jeton from public.reglages_moderation;) et le recopie dans web/.env.local (MODERATION_JETON).
create table if not exists public.reglages_moderation (
  id boolean primary key default true check (id),
  jeton text not null,
  analyse_active boolean not null default false,
  derniere_analyse timestamptz
);
alter table public.reglages_moderation enable row level security;
revoke all on public.reglages_moderation from anon, authenticated;
insert into public.reglages_moderation (id, jeton)
values (true, replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
on conflict (id) do nothing;

create or replace function public.moderation_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select analyse_active from public.reglages_moderation where id), false);
$$;

create or replace function public.exiger_equipe_moderation()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  if not public.equipe_contenus() then
    raise exception 'Réservé à l’équipe.' using errcode = '42501';
  end if;
end;
$$;

-- L'état de l'analyse pour le back-office ; « jeton_reconnu » dit si le jeton du serveur est le bon (nul sans jeton).
create or replace function public.etat_moderation(p_jeton text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.reglages_moderation%rowtype;
begin
  perform public.exiger_equipe_moderation();
  select * into r from public.reglages_moderation where id;
  return jsonb_build_object(
    'active', coalesce(r.analyse_active, false),
    'jeton_reconnu', case when coalesce(p_jeton, '') = '' then null else p_jeton = r.jeton end,
    'derniere_analyse', r.derniere_analyse,
    'en_attente', (select count(*)::int from public.publications where statut = 'en_attente')
  );
end;
$$;

-- Activer demande le jeton du serveur : la preuve que l'application saura analyser.
create or replace function public.regler_analyse(p_active boolean, p_jeton text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_equipe_moderation();
  if coalesce(p_active, false) and (coalesce(p_jeton, '') = '' or p_jeton is distinct from (select jeton from public.reglages_moderation where id)) then
    raise exception 'Le jeton de modération n’est pas reconnu.';
  end if;
  update public.reglages_moderation set analyse_active = coalesce(p_active, false) where id;
end;
$$;

-- Un verdict porte le bon jeton et une décision connue.
create or replace function public.verdict_valide(p_analyse jsonb)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_analyse is not null
    and jsonb_typeof(p_analyse) = 'object'
    and coalesce(p_analyse ->> 'jeton', '') <> ''
    and p_analyse ->> 'jeton' = (select jeton from public.reglages_moderation where id)
    and p_analyse ->> 'decision' in ('autoriser', 'signaler', 'bloquer', 'echec');
$$;

-- Ce que la base garde d'un verdict (sans le jeton).
create or replace function public.analyse_retenue(p_analyse jsonb)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'decision', p_analyse ->> 'decision',
    'categorie', case
      when p_analyse ->> 'categorie' in ('spam', 'harcelement', 'haine', 'sexuel', 'arnaque', 'hameconnage', 'publicite', 'illegal', 'hors_sujet', 'autre', 'aucune')
        then p_analyse ->> 'categorie'
      else 'autre'
    end,
    'raison', left(coalesce(p_analyse ->> 'raison', ''), 300),
    'le', now()
  );
$$;

-- « général » ou le nom court du parcours.
create or replace function public.nom_espace_communaute(p_parcours uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select pa.nom_court from public.parcours pa where pa.id = p_parcours), 'général');
$$;

-- « À modérer » à toute l'équipe (catégorie service : toujours envoyée).
create or replace function public.prevenir_equipe(p_texte text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notifier(
    array(select distinct r.profil_id from public.roles r where r.role in ('moderateur', 'admin', 'super_admin')),
    'service', 'À modérer', p_texte, '/admin/moderation'
  );
end;
$$;

-- Au plus 5 publications ou 30 réponses par compte toutes les 10 minutes.
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
    where auteur = (select auth.uid()) and cree_le > now() - interval '10 minutes';
  end if;
  if v_nombre >= v_limite then
    raise exception 'Vous publiez beaucoup en peu de temps. Réessayez dans quelques minutes.';
  end if;
end;
$$;

-- Visible du compte qui demande : en ligne, ou la sienne en attente.
create or replace function public.publication_visible(p public.publications)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p.statut = 'publiee' or (p.statut = 'en_attente' and p.auteur = (select auth.uid()));
$$;

-- ─── Les cartes : statut et « Signaler » ────────────────────────────────────────────────────────────
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
    'peut_supprimer', c.auteur = (select auth.uid()) or public.equipe_contenus(),
    'peut_signaler', c.auteur <> (select auth.uid()) and not public.equipe_contenus()
  )
  from public.profils pr
  where pr.id = c.auteur;
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
    'espace', jsonb_build_object('id', p.parcours_id, 'nom', public.nom_espace_communaute(p.parcours_id)),
    'titre', p.titre,
    'texte', p.texte,
    'piece_jointe', p.piece_jointe,
    'cree_le', p.cree_le,
    'modifiee', p.modifiee,
    'statut', p.statut,
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

-- ─── Lectures : seulement les publications visibles ─────────────────────────────────────────────────
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
      and public.publication_visible(p)
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

-- La page d'une publication : visible, ou pour l'équipe quel que soit son statut (depuis la file).
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
  if not found or not public.peut_lire_espace(v.parcours_id) or not (public.publication_visible(v) or public.equipe_contenus()) then
    return null;
  end if;
  return public.carte_publication(v) || jsonb_build_object('toutes_reponses', coalesce((
    select jsonb_agg(public.carte_reponse(c) order by c.cree_le, c.id)
    from public.commentaires_publications c
    where c.publication_id = v.id
  ), '[]'::jsonb));
end;
$$;

-- Répondre, aimer, supprimer une réponse : une publication en ligne (l'équipe, toutes).
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
  return v;
end;
$$;

create or replace function public.membres_actifs()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  return coalesce((
    with ecrits as (
      select p.auteur, p.parcours_id, p.cree_le
      from public.publications p
      where p.cree_le > now() - interval '7 days' and p.statut = 'publiee' and public.peut_lire_espace(p.parcours_id)
      union all
      select c.auteur, p.parcours_id, c.cree_le
      from public.commentaires_publications c
      join public.publications p on p.id = c.publication_id
      where c.cree_le > now() - interval '7 days' and p.statut = 'publiee' and public.peut_lire_espace(p.parcours_id)
    ),
    par_espace as (
      select auteur, parcours_id,
             row_number() over (partition by auteur order by count(*) desc, max(cree_le) desc) as rang
      from ecrits
      group by auteur, parcours_id
    ),
    totaux as (
      select auteur, count(*) as n, max(cree_le) as dernier from ecrits group by auteur
    ),
    premiers as (
      select t.auteur, t.n, t.dernier from totaux t order by t.n desc, t.dernier desc limit 3
    )
    select jsonb_agg(
      jsonb_build_object(
        'prenom', coalesce(pr.prenom, ''),
        'nom_court', public.nom_avis(pr.prenom, pr.nom),
        'initiales', public.initiales_avis(pr.prenom, pr.nom),
        'espace', coalesce((select pa.nom_court from public.parcours pa where pa.id = e.parcours_id), 'Général')
      )
      order by pm.n desc, pm.dernier desc
    )
    from premiers pm
    join public.profils pr on pr.id = pm.auteur
    join par_espace e on e.auteur = pm.auteur and e.rang = 1
  ), '[]'::jsonb);
end;
$$;

-- Un fichier se lit si une publication en ligne, d'un espace ouvert au compte, l'attache.
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
  );
$$;

-- ─── Publier, modifier : le verdict, la limite de débit ─────────────────────────────────────────────
-- Le type et la taille sont ceux que le stockage a enregistrés, pas ceux qu'annonce le navigateur.
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
     or exists (select 1 from public.publications p where p.piece_jointe ->> 'chemin' = v_chemin) then
    raise exception 'Ce fichier n’est pas le vôtre.';
  end if;
  return jsonb_build_object('chemin', v_chemin, 'nom', left(coalesce(nullif(btrim(p_piece ->> 'nom'), ''), 'fichier'), 200), 'type', v_type, 'taille', v_taille);
end;
$$;

drop function if exists public.publier(uuid, text, text, jsonb);
create or replace function public.publier(p_parcours uuid, p_titre text, p_texte text, p_piece jsonb default null, p_analyse jsonb default null)
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
    v_analyse := public.analyse_retenue(p_analyse);
    v_statut := case when v_analyse ->> 'decision' = 'bloquer' then 'bloquee' else 'publiee' end;
    v_examen := v_analyse ->> 'decision' in ('signaler', 'echec');
    update public.reglages_moderation set derniere_analyse = now() where id;
  elsif public.moderation_active() then
    v_statut := 'en_attente';
  end if;
  insert into public.publications (auteur, parcours_id, titre, texte, piece_jointe, statut, verdict, a_examiner)
  values ((select auth.uid()), p_parcours, v_titre, v_texte, public.verifier_piece(p_piece), v_statut, v_analyse, v_examen)
  returning id into v_id;
  if v_examen or v_statut = 'en_attente' then
    perform public.prevenir_equipe('Une publication de l’espace ' || public.nom_espace_communaute(p_parcours) || ' attend votre examen.');
  end if;
  return jsonb_build_object('id', v_id, 'statut', v_statut, 'categorie', v_analyse ->> 'categorie');
end;
$$;

-- Son auteur seulement ; le titre et le texte sont réanalysés. Bloquée, la modification n'est pas appliquée.
drop function if exists public.modifier_publication(uuid, text, text);
create or replace function public.modifier_publication(p_id uuid, p_titre text, p_texte text, p_analyse jsonb default null)
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
    v_statut := 'publiee';
    v_examen := v.a_examiner or v_analyse ->> 'decision' in ('signaler', 'echec');
  elsif public.moderation_active() then
    v_statut := 'en_attente';
  end if;
  update public.publications
  set titre = v_titre, texte = v_texte, modifiee = true, modifie_le = now(),
      statut = v_statut, a_examiner = v_examen, verdict = coalesce(v_analyse, verdict)
  where id = p_id;
  if (v_statut = 'en_attente' and v.statut <> 'en_attente') or (v_examen and not v.a_examiner) then
    perform public.prevenir_equipe('Une publication de l’espace ' || public.nom_espace_communaute(v.parcours_id) || ' attend votre examen.');
  end if;
  return jsonb_build_object('statut', v_statut, 'categorie', v_analyse ->> 'categorie');
end;
$$;

-- Répondre : la limite de débit en plus (le reste comme la 0019).
create or replace function public.commenter(p_publication uuid, p_texte text)
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
begin
  if char_length(v_texte) not between 1 and 1000 then
    raise exception 'Écrivez votre réponse (1 000 caractères au plus).';
  end if;
  perform public.limiter_debit(true);
  insert into public.commentaires_publications (publication_id, auteur, texte)
  values (p_publication, (select auth.uid()), v_texte)
  returning id into v_id;
  select public.nom_avis(prenom, nom) into v_nom from public.profils where id = (select auth.uid());
  perform public.notifier(
    array[v.auteur], 'communaute', 'Nouvelle réponse',
    v_nom || ' a répondu à votre publication dans l’espace ' || public.nom_espace_communaute(v.parcours_id) || '.',
    '/communaute/publications/' || v.id
  );
  return v_id;
end;
$$;

-- ─── Signalements ───────────────────────────────────────────────────────────────────────────────────
-- Une publication ou une réponse ; un seul par compte et par contenu. Fermés : l'équipe les lit par la file.
create table if not exists public.signalements (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid references public.publications (id) on delete cascade,
  commentaire_id uuid references public.commentaires_publications (id) on delete cascade,
  auteur uuid not null references public.profils (id) on delete cascade,
  motif text not null,
  precisions text not null default '',
  cree_le timestamptz not null default now(),
  traite_le timestamptz,
  constraint signalements_une_cible check ((publication_id is null) <> (commentaire_id is null)),
  constraint signalements_motif check (motif in ('inapproprie', 'spam', 'harcelement', 'autre')),
  constraint signalements_precisions check (char_length(precisions) <= 500)
);
create unique index if not exists signalements_publication_unique on public.signalements (auteur, publication_id) where publication_id is not null;
create unique index if not exists signalements_commentaire_unique on public.signalements (auteur, commentaire_id) where commentaire_id is not null;
create index if not exists signalements_publication_idx on public.signalements (publication_id) where traite_le is null;
create index if not exists signalements_commentaire_idx on public.signalements (commentaire_id) where traite_le is null;
alter table public.signalements enable row level security;
revoke all on public.signalements from anon, authenticated;

-- Signaler : qui lit l'espace du contenu, sauf son auteur et l'équipe. L'équipe est prévenue au premier signalement d'un
-- contenu qui n'était pas déjà dans sa file.
create or replace function public.signaler(p_publication uuid, p_commentaire uuid, p_motif text, p_precisions text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_publication public.publications%rowtype;
  v_commentaire public.commentaires_publications%rowtype;
  v_auteur uuid;
  v_precisions text := regexp_replace(coalesce(p_precisions, ''), '^\s+|\s+$', '', 'g');
  v_dans_la_file boolean;
begin
  perform public.exiger_compte_actif();
  if (p_publication is null) = (p_commentaire is null) then
    raise exception 'Ce contenu n’existe plus.';
  end if;
  if p_commentaire is not null then
    select * into v_commentaire from public.commentaires_publications where id = p_commentaire;
    if not found then
      raise exception 'Ce contenu n’existe plus.';
    end if;
    v_publication := public.publication_ouverte(v_commentaire.publication_id);
    v_auteur := v_commentaire.auteur;
    v_dans_la_file := exists (select 1 from public.signalements s where s.commentaire_id = p_commentaire and s.traite_le is null);
  else
    v_publication := public.publication_ouverte(p_publication);
    v_auteur := v_publication.auteur;
    v_dans_la_file := v_publication.a_examiner or v_publication.statut <> 'publiee'
      or exists (select 1 from public.signalements s where s.publication_id = p_publication and s.traite_le is null);
  end if;
  if v_auteur = (select auth.uid()) then
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
  begin
    insert into public.signalements (publication_id, commentaire_id, auteur, motif, precisions)
    values (case when p_commentaire is null then p_publication end, p_commentaire, (select auth.uid()), p_motif, v_precisions);
  exception when unique_violation then
    raise exception 'Vous avez déjà signalé ce contenu.';
  end;
  if not v_dans_la_file then
    perform public.prevenir_equipe(
      case when p_commentaire is null then 'Une publication' else 'Une réponse' end
      || ' de l’espace ' || public.nom_espace_communaute(v_publication.parcours_id) || ' attend votre examen.'
    );
  end if;
end;
$$;

-- ─── La file de l'équipe ────────────────────────────────────────────────────────────────────────────
-- Les signalements non traités d'un contenu : leur nombre, les motifs comptés, le détail (nom court de qui signale).
create or replace function public.resume_signalements(p_publication uuid, p_commentaire uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with s as (
    select * from public.signalements
    where traite_le is null and (publication_id = p_publication or commentaire_id = p_commentaire)
  )
  select jsonb_build_object(
    'nombre', (select count(*)::int from s),
    'motifs', coalesce((
      select jsonb_agg(jsonb_build_object('motif', m.motif, 'nombre', m.n) order by m.n desc, m.motif)
      from (select motif, count(*)::int as n from s group by motif) m
    ), '[]'::jsonb),
    'details', coalesce((
      select jsonb_agg(jsonb_build_object('motif', s.motif, 'precisions', s.precisions, 'par', public.nom_avis(pr.prenom, pr.nom), 'le', s.cree_le) order by s.cree_le, s.id)
      from s join public.profils pr on pr.id = s.auteur
    ), '[]'::jsonb)
  );
$$;

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
    'statut', p.statut,
    'analyse', p.verdict,
    'extrait', null,
    'signalements', public.resume_signalements(p.id, null)
  )
  from public.profils pr
  where pr.id = p.auteur;
$$;

create or replace function public.element_reponse(c public.commentaires_publications)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'type', 'reponse',
    'id', c.id,
    'publication_id', c.publication_id,
    'espace', jsonb_build_object('id', p.parcours_id, 'nom', public.nom_espace_communaute(p.parcours_id)),
    'auteur', jsonb_build_object('id', c.auteur, 'prenom', coalesce(pr.prenom, ''), 'nom', coalesce(pr.nom, '')),
    'cree_le', c.cree_le,
    'titre', '',
    'texte', c.texte,
    'piece_jointe', null,
    'statut', p.statut,
    'analyse', null,
    'extrait', left(coalesce(nullif(p.titre, ''), p.texte), 140),
    'signalements', public.resume_signalements(null, c.id)
  )
  from public.publications p
  join public.profils pr on pr.id = c.auteur
  where p.id = c.publication_id;
$$;

-- « À examiner » : publications en attente, signalées par l'analyse ou par des membres, et réponses signalées, les plus
-- anciennes d'abord. « Bloquées » : refusées par l'analyse, les plus récentes d'abord. 50 au plus.
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
  );
end;
$$;

-- « Publication en ligne » à son auteur, après vérification par l'équipe.
create or replace function public.annoncer_mise_en_ligne(p public.publications)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notifier(
    array[p.auteur], 'service', 'Publication en ligne',
    'Votre publication dans l’espace ' || public.nom_espace_communaute(p.parcours_id) || ' a été vérifiée par l’équipe Étudium et mise en ligne.',
    '/communaute/publications/' || p.id
  );
end;
$$;

-- Garder : les signalements sont classés et le contenu quitte la file ; une publication en attente est mise en ligne.
create or replace function public.garder_contenu(p_publication uuid, p_commentaire uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.publications%rowtype;
begin
  perform public.exiger_equipe_moderation();
  if p_commentaire is not null then
    if not exists (select 1 from public.commentaires_publications where id = p_commentaire) then
      raise exception 'Ce contenu n’existe plus.';
    end if;
    update public.signalements set traite_le = now() where commentaire_id = p_commentaire and traite_le is null;
    return;
  end if;
  select * into v from public.publications where id = p_publication for update;
  if not found then
    raise exception 'Ce contenu n’existe plus.';
  end if;
  update public.signalements set traite_le = now() where publication_id = p_publication and traite_le is null;
  update public.publications
  set a_examiner = false, statut = case when statut = 'en_attente' then 'publiee' else statut end
  where id = p_publication;
  if v.statut = 'en_attente' then
    perform public.annoncer_mise_en_ligne(v);
  end if;
end;
$$;

-- Supprimer : le contenu disparaît (avec ses signalements) et son auteur est prévenu, sauf pour une publication bloquée,
-- qu'il n'a jamais vue en ligne. Rend le chemin du fichier à retirer du stockage.
create or replace function public.supprimer_contenu(p_publication uuid, p_commentaire uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.publications%rowtype;
  v_commentaire public.commentaires_publications%rowtype;
  v_regles text := ' a été retirée par l’équipe Étudium : elle ne respecte pas les règles de la communauté.';
begin
  perform public.exiger_equipe_moderation();
  if p_commentaire is not null then
    select * into v_commentaire from public.commentaires_publications where id = p_commentaire for update;
    if not found then
      raise exception 'Ce contenu n’existe plus.';
    end if;
    select * into v from public.publications where id = v_commentaire.publication_id;
    delete from public.commentaires_publications where id = p_commentaire;
    perform public.notifier(
      array[v_commentaire.auteur], 'service', 'Réponse retirée',
      'Votre réponse dans l’espace ' || public.nom_espace_communaute(v.parcours_id) || v_regles, '/communaute'
    );
    return null;
  end if;
  select * into v from public.publications where id = p_publication for update;
  if not found then
    raise exception 'Ce contenu n’existe plus.';
  end if;
  delete from public.publications where id = p_publication;
  if v.statut <> 'bloquee' then
    perform public.notifier(
      array[v.auteur], 'service', 'Publication retirée',
      'Votre publication dans l’espace ' || public.nom_espace_communaute(v.parcours_id) || v_regles, '/communaute'
    );
  end if;
  return v.piece_jointe ->> 'chemin';
end;
$$;

-- Rétablir une publication bloquée par erreur : elle est mise en ligne et son auteur est prévenu.
create or replace function public.retablir_publication(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.publications%rowtype;
begin
  perform public.exiger_equipe_moderation();
  select * into v from public.publications where id = p_id for update;
  if not found then
    raise exception 'Ce contenu n’existe plus.';
  end if;
  if v.statut <> 'bloquee' then
    return;
  end if;
  update public.publications set statut = 'publiee', a_examiner = false where id = p_id;
  perform public.annoncer_mise_en_ligne(v);
end;
$$;

-- ─── Droits d'exécution ─────────────────────────────────────────────────────────────────────────────
revoke execute on function public.exiger_equipe_moderation() from public, anon, authenticated;
revoke execute on function public.verdict_valide(jsonb) from public, anon, authenticated;
revoke execute on function public.analyse_retenue(jsonb) from public, anon, authenticated;
revoke execute on function public.nom_espace_communaute(uuid) from public, anon, authenticated;
revoke execute on function public.prevenir_equipe(text) from public, anon, authenticated;
revoke execute on function public.limiter_debit(boolean) from public, anon, authenticated;
revoke execute on function public.publication_visible(public.publications) from public, anon, authenticated;
revoke execute on function public.moderation_active() from public, anon;
revoke execute on function public.etat_moderation(text) from public, anon;
revoke execute on function public.regler_analyse(boolean, text) from public, anon;
revoke execute on function public.publier(uuid, text, text, jsonb, jsonb) from public, anon;
revoke execute on function public.modifier_publication(uuid, text, text, jsonb) from public, anon;
grant execute on function public.moderation_active() to authenticated;
grant execute on function public.etat_moderation(text) to authenticated;
grant execute on function public.regler_analyse(boolean, text) to authenticated;
grant execute on function public.publier(uuid, text, text, jsonb, jsonb) to authenticated;
grant execute on function public.modifier_publication(uuid, text, text, jsonb) to authenticated;

revoke execute on function public.signaler(uuid, uuid, text, text) from public, anon;
revoke execute on function public.resume_signalements(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.element_publication(public.publications) from public, anon, authenticated;
revoke execute on function public.element_reponse(public.commentaires_publications) from public, anon, authenticated;
revoke execute on function public.annoncer_mise_en_ligne(public.publications) from public, anon, authenticated;
revoke execute on function public.file_moderation(text) from public, anon;
revoke execute on function public.nombre_a_examiner() from public, anon;
revoke execute on function public.garder_contenu(uuid, uuid) from public, anon;
revoke execute on function public.supprimer_contenu(uuid, uuid) from public, anon;
revoke execute on function public.retablir_publication(uuid) from public, anon;
grant execute on function public.signaler(uuid, uuid, text, text) to authenticated;
grant execute on function public.file_moderation(text) to authenticated;
grant execute on function public.nombre_a_examiner() to authenticated;
grant execute on function public.garder_contenu(uuid, uuid) to authenticated;
grant execute on function public.supprimer_contenu(uuid, uuid) to authenticated;
grant execute on function public.retablir_publication(uuid) to authenticated;

commit;
