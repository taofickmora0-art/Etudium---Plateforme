-- Étudium · base de production · partie 4 sur 5 (migrations 0056 à 0068).
-- Fichier produit par scripts/assembler-migrations.mjs : ne pas le modifier à la main.
-- Supabase › SQL Editor › New query : colle tout ce fichier, puis Run. Attends « Success » avant la partie suivante.
-- Ensuite : partie 5.

-- ═══ 0056_brouillons.sql ═══
-- Migration 0056 : les brouillons et la sauvegarde automatique (fin du lot 4, spec §2 ; demande du 1er novembre 2026).
-- L'éditeur enregistre tout seul. Une leçon visible des étudiants (formation en ligne, leçon publiée), ou qui a déjà
-- un brouillon, s'enregistre dans son brouillon : les étudiants gardent l'ancienne version jusqu'à « Publier les
-- modifications ». Sinon, elle s'enregistre directement. De même pour les informations générales d'une formation.
-- Chaque enregistrement donne la révision qu'il a vue : si quelqu'un a enregistré entre-temps, il est refusé (conflit),
-- sans rien écraser. Les brouillons ne s'écrivent que par ces fonctions. Rejouable.

begin;

-- ─── Révisions ──────────────────────────────────────────────────────────────────────────────────────
alter table public.lecons add column if not exists revision integer not null default 0;
alter table public.lecons add column if not exists revise_par uuid references public.profils (id) on delete set null;
alter table public.formations add column if not exists revision integer not null default 0;
alter table public.formations add column if not exists revise_par uuid references public.profils (id) on delete set null;

-- ─── Les brouillons ─────────────────────────────────────────────────────────────────────────────────
create table if not exists public.brouillons_lecons (
  lecon_id uuid primary key references public.lecons (id) on delete cascade,
  donnees jsonb not null,
  revision integer not null,
  modifie_par uuid references public.profils (id) on delete set null,
  modifie_le timestamptz not null default now()
);
create table if not exists public.brouillons_formations (
  formation_id uuid primary key references public.formations (id) on delete cascade,
  donnees jsonb not null,
  revision integer not null,
  modifie_par uuid references public.profils (id) on delete set null,
  modifie_le timestamptz not null default now()
);
alter table public.brouillons_lecons enable row level security;
alter table public.brouillons_formations enable row level security;
revoke all on public.brouillons_lecons from anon, authenticated;
revoke all on public.brouillons_formations from anon, authenticated;
grant select on public.brouillons_lecons to authenticated;
grant select on public.brouillons_formations to authenticated;

-- Lus par l'équipe et le formateur de la formation (l'aperçu, les repères « Modifiée, non publiée »).
drop policy if exists "brouillons_lecons : lecture par les éditeurs" on public.brouillons_lecons;
create policy "brouillons_lecons : lecture par les éditeurs" on public.brouillons_lecons
  for select to authenticated
  using ((select public.equipe_contenus()) or public.formateur_de(public.formation_de_la_lecon(lecon_id)));
drop policy if exists "brouillons_formations : lecture par les éditeurs" on public.brouillons_formations;
create policy "brouillons_formations : lecture par les éditeurs" on public.brouillons_formations
  for select to authenticated
  using ((select public.equipe_contenus()) or public.formateur_de(formation_id));

-- ─── Outils ─────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.editeur_de_formation(p_formation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not public.compte_suspendu() and (public.equipe_contenus() or public.formateur_de(p_formation));
$$;

-- Visible des étudiants : la formation n'est plus un brouillon (en ligne ou archivée), la leçon est publiée.
create or replace function public.lecon_visible(p_lecon uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.lecons l
    join public.modules m on m.id = l.module_id
    join public.formations f on f.id = m.formation_id
    where l.id = p_lecon and l.publiee and f.statut <> 'brouillon'
  );
$$;

create or replace function public.formation_visible(p_formation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.formations f where f.id = p_formation and f.statut <> 'brouillon');
$$;

-- Ce qui est en ligne, dans la forme des brouillons.
create or replace function public.donnees_lecon(p_lecon uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'titre', l.titre,
    'titre_court', l.titre_court,
    'resume', l.resume,
    'points_cles', to_jsonb(l.points_cles),
    'video_fournisseur', c.video_fournisseur,
    'video_id', c.video_id,
    'duree_secondes', l.duree_secondes,
    'document', c.document,
    'texte', coalesce(c.texte, '')
  )
  from public.lecons l
  left join public.lecons_contenus c on c.lecon_id = l.id
  where l.id = p_lecon;
$$;

create or replace function public.donnees_formation(p_formation uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'titre', f.titre,
    'resume', f.resume,
    'description', f.description,
    'objectifs', to_jsonb(f.objectifs),
    'competences', to_jsonb(f.competences),
    'niveau', f.niveau
  )
  from public.formations f
  where f.id = p_formation;
$$;

-- Une liste de lignes (points clés, objectifs, compétences) : 20 lignes de 200 caractères au plus.
create or replace function public.lignes_valides(p jsonb, p_nom text)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v jsonb := coalesce(p, '[]'::jsonb);
begin
  if jsonb_typeof(v) <> 'array' or exists (select 1 from jsonb_array_elements(v) e where jsonb_typeof(e) <> 'string') then
    raise exception 'La liste « % » est illisible.', p_nom;
  end if;
  if jsonb_array_length(v) > 20 then
    raise exception '20 % au plus.', p_nom;
  end if;
  if exists (select 1 from jsonb_array_elements_text(v) t where char_length(t) > 200) then
    raise exception '200 caractères au plus par ligne (%).', p_nom;
  end if;
  return v;
end;
$$;

-- Les données d'une leçon, vérifiées et mises en forme ; un refus donne son message.
create or replace function public.donnees_lecon_valides(p jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_titre text := btrim(coalesce(p ->> 'titre', ''));
  v_court text := nullif(btrim(coalesce(p ->> 'titre_court', '')), '');
  v_resume text := coalesce(p ->> 'resume', '');
  v_fournisseur text := nullif(p ->> 'video_fournisseur', '');
  v_video text := nullif(p ->> 'video_id', '');
  v_duree integer;
  v_texte text := coalesce(p ->> 'texte', '');
  v_document jsonb := p -> 'document';
begin
  if jsonb_typeof(p) is distinct from 'object' then
    raise exception 'Les données de la leçon sont illisibles.';
  end if;
  if char_length(v_titre) not between 1 and 120 then
    raise exception 'Le titre est obligatoire (120 caractères au plus).';
  end if;
  if char_length(coalesce(v_court, '')) > 40 then
    raise exception 'Le titre court : 40 caractères au plus.';
  end if;
  if char_length(v_resume) > 1000 then
    raise exception 'Le résumé : 1 000 caractères au plus.';
  end if;
  if (v_fournisseur is null) <> (v_video is null) then
    raise exception 'La vidéo est incomplète.';
  end if;
  begin
    v_duree := coalesce((p ->> 'duree_secondes')::integer, 0);
  exception when others then
    raise exception 'La durée est illisible.';
  end;
  if v_duree < 0 then
    raise exception 'La durée ne peut pas être négative.';
  end if;
  if char_length(v_texte) > 20000 then
    raise exception 'Le texte dépasse 20 000 caractères.';
  end if;
  if jsonb_typeof(v_document) = 'null' then
    v_document := null;
  end if;
  if v_document is not null and (jsonb_typeof(v_document) <> 'object' or octet_length(v_document::text) > 307200) then
    raise exception 'Le contenu est trop lourd (300 Ko au plus).';
  end if;
  return jsonb_build_object(
    'titre', v_titre,
    'titre_court', v_court,
    'resume', v_resume,
    'points_cles', public.lignes_valides(p -> 'points_cles', 'points clés'),
    'video_fournisseur', v_fournisseur,
    'video_id', v_video,
    'duree_secondes', v_duree,
    'document', v_document,
    'texte', v_texte
  );
end;
$$;

create or replace function public.donnees_formation_valides(p jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_titre text := btrim(coalesce(p ->> 'titre', ''));
  v_resume text := btrim(coalesce(p ->> 'resume', ''));
  v_description text := btrim(coalesce(p ->> 'description', ''));
  v_niveau text := coalesce(p ->> 'niveau', 'debutant');
begin
  if jsonb_typeof(p) is distinct from 'object' then
    raise exception 'Les informations sont illisibles.';
  end if;
  if char_length(v_titre) not between 1 and 120 then
    raise exception 'Le titre est obligatoire (120 caractères au plus).';
  end if;
  if char_length(v_resume) > 160 then
    raise exception 'Le résumé : 160 caractères au plus.';
  end if;
  if char_length(v_description) > 2000 then
    raise exception 'La description : 2 000 caractères au plus.';
  end if;
  if v_niveau not in ('debutant', 'intermediaire', 'avance') then
    raise exception 'Le niveau n’est pas reconnu.';
  end if;
  return jsonb_build_object(
    'titre', v_titre,
    'resume', v_resume,
    'description', v_description,
    'objectifs', public.lignes_valides(p -> 'objectifs', 'objectifs'),
    'competences', public.lignes_valides(p -> 'competences', 'compétences'),
    'niveau', v_niveau
  );
end;
$$;

-- Écrit des données vérifiées dans la leçon (et son contenu) ou dans la formation.
create or replace function public.appliquer_donnees_lecon(p_lecon uuid, d jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.lecons set
    titre = d ->> 'titre',
    titre_court = d ->> 'titre_court',
    resume = d ->> 'resume',
    points_cles = array(select jsonb_array_elements_text(d -> 'points_cles')),
    duree_secondes = (d ->> 'duree_secondes')::integer
  where id = p_lecon;
  insert into public.lecons_contenus (lecon_id, video_fournisseur, video_id, texte, document)
  values (
    p_lecon,
    (d ->> 'video_fournisseur')::public.fournisseur_video,
    d ->> 'video_id',
    d ->> 'texte',
    case when jsonb_typeof(d -> 'document') = 'object' then d -> 'document' end
  )
  on conflict (lecon_id) do update set
    video_fournisseur = excluded.video_fournisseur,
    video_id = excluded.video_id,
    texte = excluded.texte,
    document = excluded.document;
end;
$$;

create or replace function public.appliquer_donnees_formation(p_formation uuid, d jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.formations set
    titre = d ->> 'titre',
    resume = d ->> 'resume',
    description = d ->> 'description',
    objectifs = array(select jsonb_array_elements_text(d -> 'objectifs')),
    competences = array(select jsonb_array_elements_text(d -> 'competences')),
    niveau = (d ->> 'niveau')::public.niveau_formation
  where id = p_formation;
end;
$$;

-- ─── Ce que l'éditeur affiche ───────────────────────────────────────────────────────────────────────
create or replace function public.edition_lecon(p_lecon uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_b public.brouillons_lecons;
  v_revision integer;
begin
  if not public.editeur_de_lecon(p_lecon) then
    raise exception 'Vous ne pouvez pas modifier cette leçon.' using errcode = '42501';
  end if;
  select l.revision into v_revision from public.lecons l where l.id = p_lecon;
  if not found then
    raise exception 'Leçon introuvable.';
  end if;
  select * into v_b from public.brouillons_lecons b where b.lecon_id = p_lecon;
  if found then
    return jsonb_build_object(
      'donnees', v_b.donnees, 'revision', v_b.revision, 'brouillon', true, 'en_ligne', public.lecon_visible(p_lecon),
      'modifie_par', public.nom_du_profil(v_b.modifie_par), 'modifie_le', v_b.modifie_le
    );
  end if;
  return jsonb_build_object(
    'donnees', public.donnees_lecon(p_lecon), 'revision', v_revision, 'brouillon', false, 'en_ligne', public.lecon_visible(p_lecon),
    'modifie_par', null, 'modifie_le', null
  );
end;
$$;

create or replace function public.edition_formation(p_formation uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_b public.brouillons_formations;
  v_revision integer;
begin
  if not public.editeur_de_formation(p_formation) then
    raise exception 'Vous ne pouvez pas modifier cette formation.' using errcode = '42501';
  end if;
  select f.revision into v_revision from public.formations f where f.id = p_formation;
  if not found then
    raise exception 'Formation introuvable.';
  end if;
  select * into v_b from public.brouillons_formations b where b.formation_id = p_formation;
  if found then
    return jsonb_build_object(
      'donnees', v_b.donnees, 'revision', v_b.revision, 'brouillon', true, 'en_ligne', public.formation_visible(p_formation),
      'modifie_par', public.nom_du_profil(v_b.modifie_par), 'modifie_le', v_b.modifie_le
    );
  end if;
  return jsonb_build_object(
    'donnees', public.donnees_formation(p_formation), 'revision', v_revision, 'brouillon', false,
    'en_ligne', public.formation_visible(p_formation), 'modifie_par', null, 'modifie_le', null
  );
end;
$$;

-- ─── Enregistrer (sauvegarde automatique) ───────────────────────────────────────────────────────────
create or replace function public.enregistrer_lecon(p_lecon uuid, p_donnees jsonb, p_revision integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
  v_d jsonb;
  v_l public.lecons;
  v_b public.brouillons_lecons;
  v_formation uuid;
begin
  -- Supprimée pendant qu'un autre membre l'avait ouverte : un refus clair, sans nouvel essai (P0001).
  if not exists (select 1 from public.lecons where id = p_lecon) then
    raise exception 'Cette leçon n’existe plus : elle a été supprimée. Revenez au programme de la formation.' using errcode = 'P0001';
  end if;
  if not public.editeur_de_lecon(p_lecon) then
    raise exception 'Vous ne pouvez pas modifier cette leçon.' using errcode = '42501';
  end if;
  v_d := public.donnees_lecon_valides(p_donnees);
  select * into v_l from public.lecons l where l.id = p_lecon for update;
  v_formation := public.formation_de_la_lecon(p_lecon);
  if exists (
    select 1 from jsonb_path_query(coalesce(v_d -> 'document', 'null'::jsonb), 'lax $.**.chemin') c
    where jsonb_typeof(c) = 'string' and split_part(c #>> '{}', '/', 1) <> v_formation::text
  ) then
    raise exception 'Une image vient d’une autre formation : ajoutez-la de nouveau dans cette leçon.';
  end if;

  select * into v_b from public.brouillons_lecons b where b.lecon_id = p_lecon for update;
  if found then
    if v_b.revision <> p_revision then
      return jsonb_build_object('etat', 'conflit', 'par', public.nom_du_profil(v_b.modifie_par));
    end if;
    update public.brouillons_lecons set donnees = v_d, revision = revision + 1, modifie_par = v_moi, modifie_le = now()
    where lecon_id = p_lecon;
    return jsonb_build_object('etat', 'enregistre', 'revision', v_b.revision + 1, 'brouillon', true, 'enregistre_le', now());
  end if;

  if v_l.revision <> p_revision then
    return jsonb_build_object('etat', 'conflit', 'par', public.nom_du_profil(v_l.revise_par));
  end if;
  if public.lecon_visible(p_lecon) then
    insert into public.brouillons_lecons (lecon_id, donnees, revision, modifie_par) values (p_lecon, v_d, v_l.revision + 1, v_moi);
    return jsonb_build_object('etat', 'enregistre', 'revision', v_l.revision + 1, 'brouillon', true, 'enregistre_le', now());
  end if;

  perform public.appliquer_donnees_lecon(p_lecon, v_d);
  update public.lecons set revision = revision + 1, revise_par = v_moi where id = p_lecon;
  if not public.equipe_contenus() then
    perform public.marquer_modifiee_par_formateur(v_formation);
  end if;
  return jsonb_build_object('etat', 'enregistre', 'revision', v_l.revision + 1, 'brouillon', false, 'enregistre_le', now());
end;
$$;

create or replace function public.enregistrer_infos_formation(p_formation uuid, p_donnees jsonb, p_revision integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
  v_d jsonb;
  v_f public.formations;
  v_b public.brouillons_formations;
begin
  if not public.editeur_de_formation(p_formation) then
    raise exception 'Vous ne pouvez pas modifier cette formation.' using errcode = '42501';
  end if;
  v_d := public.donnees_formation_valides(p_donnees);
  select * into v_f from public.formations f where f.id = p_formation for update;

  select * into v_b from public.brouillons_formations b where b.formation_id = p_formation for update;
  if found then
    if v_b.revision <> p_revision then
      return jsonb_build_object('etat', 'conflit', 'par', public.nom_du_profil(v_b.modifie_par));
    end if;
    update public.brouillons_formations set donnees = v_d, revision = revision + 1, modifie_par = v_moi, modifie_le = now()
    where formation_id = p_formation;
    return jsonb_build_object('etat', 'enregistre', 'revision', v_b.revision + 1, 'brouillon', true, 'enregistre_le', now());
  end if;

  if v_f.revision <> p_revision then
    return jsonb_build_object('etat', 'conflit', 'par', public.nom_du_profil(v_f.revise_par));
  end if;
  if public.formation_visible(p_formation) then
    insert into public.brouillons_formations (formation_id, donnees, revision, modifie_par) values (p_formation, v_d, v_f.revision + 1, v_moi);
    return jsonb_build_object('etat', 'enregistre', 'revision', v_f.revision + 1, 'brouillon', true, 'enregistre_le', now());
  end if;

  perform public.appliquer_donnees_formation(p_formation, v_d);
  update public.formations set revision = revision + 1, revise_par = v_moi where id = p_formation;
  if not public.equipe_contenus() then
    perform public.marquer_modifiee_par_formateur(p_formation);
  end if;
  return jsonb_build_object('etat', 'enregistre', 'revision', v_f.revision + 1, 'brouillon', false, 'enregistre_le', now());
end;
$$;

-- ─── Ce qui attend d'être publié ────────────────────────────────────────────────────────────────────
create or replace function public.modifications_en_attente(p_formation uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.editeur_de_formation(p_formation) then
    raise exception 'Vous ne pouvez pas modifier cette formation.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(x.ligne order by x.tri, x.rang)
    from (
      select 0 as tri, 0 as rang, jsonb_build_object(
        'type', 'formation', 'id', b.formation_id, 'titre', 'Informations générales', 'rang', null,
        'modifie_par', public.nom_du_profil(b.modifie_par), 'modifie_le', b.modifie_le
      ) as ligne
      from public.brouillons_formations b
      where b.formation_id = p_formation
      union all
      select 1, r.rang, jsonb_build_object(
        'type', 'lecon', 'id', b.lecon_id, 'titre', coalesce(b.donnees ->> 'titre', r.titre), 'rang', r.rang,
        'modifie_par', public.nom_du_profil(b.modifie_par), 'modifie_le', b.modifie_le
      )
      from public.brouillons_lecons b
      join (
        select l.id, l.titre, row_number() over (order by m.ordre, m.cree_le, l.ordre, l.cree_le)::integer as rang
        from public.lecons l
        join public.modules m on m.id = l.module_id
        where m.formation_id = p_formation
      ) r on r.id = b.lecon_id
    ) x
  ), '[]'::jsonb);
end;
$$;

-- ─── Publier ou abandonner ──────────────────────────────────────────────────────────────────────────
create or replace function public.publier_modifications(p_formation uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
  v_n integer := 0;
  v_bf public.brouillons_formations;
  v_bl public.brouillons_lecons;
begin
  if not public.editeur_de_formation(p_formation) then
    raise exception 'Vous ne pouvez pas modifier cette formation.' using errcode = '42501';
  end if;
  if not public.equipe_contenus() and not public.formation_visible(p_formation) then
    raise exception 'Cette formation n’est pas encore en ligne : envoyez-la en relecture.';
  end if;
  perform 1 from public.formations f where f.id = p_formation for update;

  select * into v_bf from public.brouillons_formations b where b.formation_id = p_formation for update;
  if found then
    perform public.appliquer_donnees_formation(p_formation, v_bf.donnees);
    update public.formations set revision = greatest(revision, v_bf.revision) + 1, revise_par = v_moi where id = p_formation;
    delete from public.brouillons_formations where formation_id = p_formation;
    v_n := v_n + 1;
  end if;

  for v_bl in
    select b.* from public.brouillons_lecons b
    join public.lecons l on l.id = b.lecon_id
    join public.modules m on m.id = l.module_id
    where m.formation_id = p_formation
    for update of b
  loop
    perform public.appliquer_donnees_lecon(v_bl.lecon_id, v_bl.donnees);
    update public.lecons set revision = greatest(revision, v_bl.revision) + 1, revise_par = v_moi where id = v_bl.lecon_id;
    delete from public.brouillons_lecons where lecon_id = v_bl.lecon_id;
    v_n := v_n + 1;
  end loop;

  if v_n > 0 and not public.equipe_contenus() then
    perform public.marquer_modifiee_par_formateur(p_formation);
  end if;
  return jsonb_build_object('publiees', v_n, 'version', null);
end;
$$;

create or replace function public.abandonner_modifications(p_formation uuid, p_lecon uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
  v_n integer;
  v_m integer := 0;
begin
  if not public.editeur_de_formation(p_formation) then
    raise exception 'Vous ne pouvez pas modifier cette formation.' using errcode = '42501';
  end if;
  -- La révision avance au-delà du brouillon abandonné : un éditeur resté ouvert dessus sera en conflit, sans écraser
  -- le travail qui suivra (le prochain brouillon ne reprend jamais le même numéro).
  if p_lecon is not null then
    update public.lecons l set revision = greatest(l.revision, b.revision) + 1, revise_par = v_moi
    from public.brouillons_lecons b
    where b.lecon_id = l.id and l.id = p_lecon and public.formation_de_la_lecon(l.id) = p_formation;
    delete from public.brouillons_lecons b
    where b.lecon_id = p_lecon and public.formation_de_la_lecon(b.lecon_id) = p_formation;
    get diagnostics v_n = row_count;
    return v_n;
  end if;
  update public.formations f set revision = greatest(f.revision, b.revision) + 1, revise_par = v_moi
  from public.brouillons_formations b
  where b.formation_id = f.id and f.id = p_formation;
  delete from public.brouillons_formations where formation_id = p_formation;
  get diagnostics v_m = row_count;
  update public.lecons l set revision = greatest(l.revision, b.revision) + 1, revise_par = v_moi
  from public.brouillons_lecons b, public.modules m
  where b.lecon_id = l.id and m.id = l.module_id and m.formation_id = p_formation;
  delete from public.brouillons_lecons b
  using public.lecons l, public.modules m
  where l.id = b.lecon_id and m.id = l.module_id and m.formation_id = p_formation;
  get diagnostics v_n = row_count;
  return v_n + v_m;
end;
$$;

-- ─── Droits ─────────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public.editeur_de_formation(uuid) from public, anon, authenticated;
revoke execute on function public.lecon_visible(uuid) from public, anon, authenticated;
revoke execute on function public.formation_visible(uuid) from public, anon, authenticated;
revoke execute on function public.donnees_lecon(uuid) from public, anon, authenticated;
revoke execute on function public.donnees_formation(uuid) from public, anon, authenticated;
revoke execute on function public.lignes_valides(jsonb, text) from public, anon, authenticated;
revoke execute on function public.donnees_lecon_valides(jsonb) from public, anon, authenticated;
revoke execute on function public.donnees_formation_valides(jsonb) from public, anon, authenticated;
revoke execute on function public.appliquer_donnees_lecon(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.appliquer_donnees_formation(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.edition_lecon(uuid) from public, anon;
revoke execute on function public.edition_formation(uuid) from public, anon;
revoke execute on function public.enregistrer_lecon(uuid, jsonb, integer) from public, anon;
revoke execute on function public.enregistrer_infos_formation(uuid, jsonb, integer) from public, anon;
revoke execute on function public.modifications_en_attente(uuid) from public, anon;
revoke execute on function public.publier_modifications(uuid) from public, anon;
revoke execute on function public.abandonner_modifications(uuid, uuid) from public, anon;
grant execute on function public.edition_lecon(uuid) to authenticated;
grant execute on function public.edition_formation(uuid) to authenticated;
grant execute on function public.enregistrer_lecon(uuid, jsonb, integer) to authenticated;
grant execute on function public.enregistrer_infos_formation(uuid, jsonb, integer) to authenticated;
grant execute on function public.modifications_en_attente(uuid) to authenticated;
grant execute on function public.publier_modifications(uuid) to authenticated;
grant execute on function public.abandonner_modifications(uuid, uuid) to authenticated;

commit;

-- ═══ 0057_versions_formations.sql ═══
-- Migration 0057 : l'historique des versions d'une formation (fin du lot 4, spec §3 ; demande du 1er novembre 2026).
-- Une version (numéro, date, auteur, résumé, instantané du contenu) naît à la mise en ligne, à chaque « Publier les
-- modifications », et quand une leçon est publiée ou retirée d'une formation en ligne. Restaurer remet le contenu d'une
-- version dans les brouillons (ou directement pour ce que les étudiants ne voient pas) : rien ne change pour eux avant
-- « Publier les modifications ». Une leçon supprimée depuis revient, non publiée (un quiz, sans ses questions). Les
-- questions des quiz, les fichiers, la couverture et les réglages de l'équipe ne sont pas versionnés. Rejouable.

begin;

-- ─── L'origine d'une leçon recréée par une restauration ─────────────────────────────────────────────
alter table public.lecons add column if not exists restauree_de uuid;

-- ─── Les versions ───────────────────────────────────────────────────────────────────────────────────
create table if not exists public.versions_formations (
  id uuid primary key default gen_random_uuid(),
  formation_id uuid not null references public.formations (id) on delete cascade,
  numero integer not null,
  cree_le timestamptz not null default now(),
  auteur_id uuid references public.profils (id) on delete set null,
  resume text not null,
  contenu jsonb not null,
  constraint versions_formations_numero unique (formation_id, numero)
);
alter table public.versions_formations enable row level security;
revoke all on public.versions_formations from anon, authenticated;
grant select on public.versions_formations to authenticated;
drop policy if exists "versions_formations : lecture par les éditeurs" on public.versions_formations;
create policy "versions_formations : lecture par les éditeurs" on public.versions_formations
  for select to authenticated
  using ((select public.equipe_contenus()) or public.formateur_de(formation_id));

-- L'instantané : les informations générales, puis les modules et leurs leçons (contenu, ordre, publiée ou non).
create or replace function public.instantane_formation(p_formation uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'infos', public.donnees_formation(p_formation),
    'modules', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'titre', m.titre,
          'ordre', m.ordre,
          'lecons', coalesce((
            select jsonb_agg(
              public.donnees_lecon(l.id) || jsonb_build_object('id', l.id, 'type', l.type, 'ordre', l.ordre, 'publiee', l.publiee)
              order by l.ordre, l.cree_le
            )
            from public.lecons l
            where l.module_id = m.id
          ), '[]'::jsonb)
        )
        order by m.ordre, m.cree_le
      )
      from public.modules m
      where m.formation_id = p_formation
    ), '[]'::jsonb)
  );
$$;

-- Une nouvelle version, numérotée à la suite ; l'auteur est le compte qui agit.
create or replace function public.noter_version(p_formation uuid, p_resume text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_numero integer;
begin
  perform 1 from public.formations f where f.id = p_formation for update;
  select coalesce(max(v.numero), 0) + 1 into v_numero from public.versions_formations v where v.formation_id = p_formation;
  insert into public.versions_formations (formation_id, numero, auteur_id, resume, contenu)
  values (p_formation, v_numero, (select auth.uid()), p_resume, public.instantane_formation(p_formation));
  return v_numero;
end;
$$;

-- ─── Quand une version naît ─────────────────────────────────────────────────────────────────────────
create or replace function public.version_mise_en_ligne()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.statut = 'publiee' and old.statut is distinct from 'publiee' then
    perform public.noter_version(new.id, 'Mise en ligne');
  end if;
  return null;
end;
$$;
drop trigger if exists formations_version_mise_en_ligne on public.formations;
create trigger formations_version_mise_en_ligne
  after update of statut on public.formations
  for each row execute function public.version_mise_en_ligne();

create or replace function public.version_publication_lecon()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_formation uuid;
begin
  if new.publiee is distinct from old.publiee then
    select m.formation_id into v_formation from public.modules m where m.id = new.module_id;
    if v_formation is not null and public.formation_visible(v_formation) then
      perform public.noter_version(
        v_formation,
        format('Leçon « %s » %s', new.titre, case when new.publiee then 'mise en ligne' else 'retirée' end)
      );
    end if;
  end if;
  return null;
end;
$$;
drop trigger if exists lecons_version_publication on public.lecons;
create trigger lecons_version_publication
  after update of publiee on public.lecons
  for each row execute function public.version_publication_lecon();

-- ─── Publier les modifications : une version (même corps qu'en 0056, plus la version et son résumé) ──
create or replace function public.publier_modifications(p_formation uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
  v_n integer := 0;
  v_infos boolean := false;
  v_lecons integer := 0;
  v_titre text;
  v_resume text;
  v_version integer;
  v_bf public.brouillons_formations;
  v_bl public.brouillons_lecons;
begin
  if not public.editeur_de_formation(p_formation) then
    raise exception 'Vous ne pouvez pas modifier cette formation.' using errcode = '42501';
  end if;
  if not public.equipe_contenus() and not public.formation_visible(p_formation) then
    raise exception 'Cette formation n’est pas encore en ligne : envoyez-la en relecture.';
  end if;
  perform 1 from public.formations f where f.id = p_formation for update;

  select * into v_bf from public.brouillons_formations b where b.formation_id = p_formation for update;
  if found then
    perform public.appliquer_donnees_formation(p_formation, v_bf.donnees);
    update public.formations set revision = greatest(revision, v_bf.revision) + 1, revise_par = v_moi where id = p_formation;
    delete from public.brouillons_formations where formation_id = p_formation;
    v_n := v_n + 1;
    v_infos := true;
  end if;

  for v_bl in
    select b.* from public.brouillons_lecons b
    join public.lecons l on l.id = b.lecon_id
    join public.modules m on m.id = l.module_id
    where m.formation_id = p_formation
    for update of b
  loop
    perform public.appliquer_donnees_lecon(v_bl.lecon_id, v_bl.donnees);
    update public.lecons set revision = greatest(revision, v_bl.revision) + 1, revise_par = v_moi where id = v_bl.lecon_id;
    delete from public.brouillons_lecons where lecon_id = v_bl.lecon_id;
    v_n := v_n + 1;
    v_lecons := v_lecons + 1;
    v_titre := v_bl.donnees ->> 'titre';
  end loop;

  if v_n = 0 then
    return jsonb_build_object('publiees', 0, 'version', null);
  end if;
  if not public.equipe_contenus() then
    perform public.marquer_modifiee_par_formateur(p_formation);
  end if;
  v_resume := case
    when v_infos and v_lecons = 0 then 'Informations générales modifiées'
    when v_infos then format('Informations générales et %s %s modifiées', v_lecons, case when v_lecons > 1 then 'leçons' else 'leçon' end)
    when v_lecons = 1 then format('Leçon « %s » modifiée', v_titre)
    else format('%s leçons modifiées', v_lecons)
  end;
  v_version := public.noter_version(p_formation, v_resume);
  return jsonb_build_object('publiees', v_n, 'version', v_version);
end;
$$;

-- ─── L'historique ───────────────────────────────────────────────────────────────────────────────────
create or replace function public.versions_formation(p_formation uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_derniere integer;
begin
  if not public.editeur_de_formation(p_formation) then
    raise exception 'Vous ne pouvez pas modifier cette formation.' using errcode = '42501';
  end if;
  select max(v.numero) into v_derniere from public.versions_formations v where v.formation_id = p_formation;
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', v.id, 'numero', v.numero, 'cree_le', v.cree_le, 'auteur', public.nom_du_profil(v.auteur_id),
        'resume', v.resume, 'en_ligne', v.numero = v_derniere
      )
      order by v.numero desc
    )
    from public.versions_formations v
    where v.formation_id = p_formation
  ), '[]'::jsonb);
end;
$$;

-- ─── Restaurer ──────────────────────────────────────────────────────────────────────────────────────
-- Écrire des données vérifiées comme le ferait l'éditeur : dans le brouillon si la leçon (ou la formation) est visible
-- ou en a déjà un, directement sinon. La révision augmente : un éditeur resté ouvert sera en conflit, sans rien écraser.
create or replace function public.ecrire_lecon(p_lecon uuid, d jsonb, p_auteur uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.brouillons_lecons b where b.lecon_id = p_lecon) then
    update public.brouillons_lecons set donnees = d, revision = revision + 1, modifie_par = p_auteur, modifie_le = now() where lecon_id = p_lecon;
  elsif public.lecon_visible(p_lecon) then
    insert into public.brouillons_lecons (lecon_id, donnees, revision, modifie_par)
    select p_lecon, d, l.revision + 1, p_auteur from public.lecons l where l.id = p_lecon;
  else
    perform public.appliquer_donnees_lecon(p_lecon, d);
    update public.lecons set revision = revision + 1, revise_par = p_auteur where id = p_lecon;
  end if;
end;
$$;

create or replace function public.ecrire_formation(p_formation uuid, d jsonb, p_auteur uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.brouillons_formations b where b.formation_id = p_formation) then
    update public.brouillons_formations set donnees = d, revision = revision + 1, modifie_par = p_auteur, modifie_le = now() where formation_id = p_formation;
  elsif public.formation_visible(p_formation) then
    insert into public.brouillons_formations (formation_id, donnees, revision, modifie_par)
    select p_formation, d, f.revision + 1, p_auteur from public.formations f where f.id = p_formation;
  else
    perform public.appliquer_donnees_formation(p_formation, d);
    update public.formations set revision = revision + 1, revise_par = p_auteur where id = p_formation;
  end if;
end;
$$;

create or replace function public.restaurer_version(p_version uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
  v public.versions_formations;
  v_infos boolean := false;
  v_modifiees integer := 0;
  v_recreees integer := 0;
  v_module jsonb;
  v_lecon jsonb;
  v_id_module uuid;
  v_id_lecon uuid;
  v_d jsonb;
  v_actuel jsonb;
begin
  select * into v from public.versions_formations x where x.id = p_version;
  if not found then
    raise exception 'Version introuvable.';
  end if;
  if not public.editeur_de_formation(v.formation_id) then
    raise exception 'Vous ne pouvez pas modifier cette formation.' using errcode = '42501';
  end if;
  perform 1 from public.formations f where f.id = v.formation_id for update;

  -- Les informations générales : seulement si elles diffèrent de ce que l'éditeur affiche (brouillon ou en ligne).
  v_d := public.donnees_formation_valides(v.contenu -> 'infos');
  v_actuel := coalesce(
    (select b.donnees from public.brouillons_formations b where b.formation_id = v.formation_id),
    public.donnees_formation(v.formation_id)
  );
  if public.donnees_formation_valides(v_actuel) is distinct from v_d then
    perform public.ecrire_formation(v.formation_id, v_d, v_moi);
    v_infos := true;
  end if;

  for v_module in select * from jsonb_array_elements(coalesce(v.contenu -> 'modules', '[]'::jsonb)) loop
    v_id_module := null;
    for v_lecon in select * from jsonb_array_elements(coalesce(v_module -> 'lecons', '[]'::jsonb)) loop
      v_d := public.donnees_lecon_valides(v_lecon);
      -- La leçon de la version, ou celle qu'une restauration précédente a recréée à sa place.
      select l.id into v_id_lecon
      from public.lecons l join public.modules m on m.id = l.module_id
      where (l.id = (v_lecon ->> 'id')::uuid or l.restauree_de = (v_lecon ->> 'id')::uuid) and m.formation_id = v.formation_id
      order by (l.id = (v_lecon ->> 'id')::uuid) desc
      limit 1;
      if found then
        v_actuel := coalesce((select b.donnees from public.brouillons_lecons b where b.lecon_id = v_id_lecon), public.donnees_lecon(v_id_lecon));
        if public.donnees_lecon_valides(v_actuel) is distinct from v_d then
          perform public.ecrire_lecon(v_id_lecon, v_d, v_moi);
          v_modifiees := v_modifiees + 1;
        end if;
        continue;
      end if;
      -- Son module : le même, ou un module du même titre, ou recréé à la fin.
      if v_id_module is null then
        select m.id into v_id_module from public.modules m
        where m.formation_id = v.formation_id and (m.id = (v_module ->> 'id')::uuid or m.titre = v_module ->> 'titre')
        order by (m.id = (v_module ->> 'id')::uuid) desc
        limit 1;
        if v_id_module is null then
          insert into public.modules (formation_id, titre, ordre)
          select v.formation_id, coalesce(nullif(v_module ->> 'titre', ''), 'Module'), coalesce(max(m.ordre), 0) + 1
          from public.modules m where m.formation_id = v.formation_id
          returning id into v_id_module;
        end if;
      end if;
      insert into public.lecons (module_id, titre, type, ordre, publiee, restauree_de)
      select v_id_module, v_d ->> 'titre', coalesce(v_lecon ->> 'type', 'lecon'), coalesce(max(l.ordre), 0) + 1, false, (v_lecon ->> 'id')::uuid
      from public.lecons l where l.module_id = v_id_module
      returning id into v_id_lecon;
      perform public.appliquer_donnees_lecon(v_id_lecon, v_d);
      v_recreees := v_recreees + 1;
    end loop;
  end loop;

  return jsonb_build_object('numero', v.numero, 'infos', v_infos, 'lecons_modifiees', v_modifiees, 'lecons_recreees', v_recreees,
    -- En ligne : ce qui est visible est passé par le brouillon (à publier) ; sinon, tout s'est écrit directement.
    'en_ligne', exists (select 1 from public.formations f where f.id = v.formation_id and f.statut <> 'brouillon'));
end;
$$;

-- ─── Droits ─────────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public.instantane_formation(uuid) from public, anon, authenticated;
revoke execute on function public.noter_version(uuid, text) from public, anon, authenticated;
revoke execute on function public.version_mise_en_ligne() from public, anon, authenticated;
revoke execute on function public.version_publication_lecon() from public, anon, authenticated;
revoke execute on function public.ecrire_lecon(uuid, jsonb, uuid) from public, anon, authenticated;
revoke execute on function public.ecrire_formation(uuid, jsonb, uuid) from public, anon, authenticated;
revoke execute on function public.publier_modifications(uuid) from public, anon;
revoke execute on function public.versions_formation(uuid) from public, anon;
revoke execute on function public.restaurer_version(uuid) from public, anon;
grant execute on function public.publier_modifications(uuid) to authenticated;
grant execute on function public.versions_formation(uuid) to authenticated;
grant execute on function public.restaurer_version(uuid) to authenticated;

-- ─── Les formations déjà en ligne : une version de départ ───────────────────────────────────────────
-- Leur historique commence ici (sans elle, il resterait vide jusqu'à la première publication). Rejouée, la migration
-- n'en ajoute pas d'autre.
do $depart$
declare
  v_formation uuid;
begin
  for v_formation in
    select f.id from public.formations f
    where f.statut = 'publiee' and not exists (select 1 from public.versions_formations v where v.formation_id = f.id)
  loop
    perform public.noter_version(v_formation, 'Version de départ');
  end loop;
end
$depart$;

commit;

-- ═══ 0058_push_emails.sql ═══
-- Migration 0058 : les notifications push et les e-mails importants (lot 5, étape B ; spec du 15 octobre 2026, mise à
-- jour le 1er novembre). Une file d'envoi en base :
--   - le push suit les notifications de l'appli, pour qui a enregistré un appareil et n'a pas coupé « Notifications
--     push » ;
--   - l'e-mail part pour ce qui est important (abonnement, paiement, compte), même si l'appli est coupée ;
--   - le serveur de l'appli prend la file avec un jeton (la base n'en garde que l'empreinte), envoie, puis termine
--     chaque envoi : 4 essais au plus (1, 5, 15 minutes d'écart), abandon après 24 heures.
-- Un paiement en ligne confirmé crée maintenant la notification « Paiement reçu ». Rejouable : le jeton n'est créé
-- qu'une fois (affiché à la fin) ; select public.nouveau_jeton_envois(); en crée un autre.

begin;

-- ─── Les appareils (push) ───────────────────────────────────────────────────────────────────────────
create table if not exists public.appareils_push (
  id uuid primary key default gen_random_uuid(),
  profil_id uuid not null references public.profils (id) on delete cascade,
  adresse text not null unique,
  cle_p256dh text not null,
  cle_auth text not null,
  cree_le timestamptz not null default now(),
  vu_le timestamptz not null default now(),
  constraint appareils_push_adresse check (adresse ~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*notify\.windows\.com)/' and char_length(adresse) <= 1000),
  constraint appareils_push_cles check (char_length(cle_p256dh) between 1 and 200 and char_length(cle_auth) between 1 and 100)
);
create index if not exists appareils_push_profil on public.appareils_push (profil_id, vu_le desc);
-- Services de push : Chrome, Edge, Opera, Samsung (Google), Firefox (Mozilla), Safari (Apple), Windows (WNS).
alter table public.appareils_push drop constraint if exists appareils_push_adresse;
alter table public.appareils_push add constraint appareils_push_adresse check (adresse ~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*notify\.windows\.com)/' and char_length(adresse) <= 1000);
alter table public.appareils_push enable row level security;
revoke all on public.appareils_push from anon, authenticated;
grant select on public.appareils_push to authenticated;
drop policy if exists "appareils_push : chacun les siens" on public.appareils_push;
create policy "appareils_push : chacun les siens" on public.appareils_push
  for select to authenticated using (profil_id = (select auth.uid()));

-- ─── La file d'envoi ────────────────────────────────────────────────────────────────────────────────
create table if not exists public.envois (
  id bigint generated always as identity primary key,
  canal text not null,
  destinataire uuid not null references public.profils (id) on delete cascade,
  titre text not null,
  texte text not null default '',
  lien text,
  statut text not null default 'a_envoyer',
  essais integer not null default 0,
  prochain_essai timestamptz not null default now(),
  pris_le timestamptz,
  prise uuid,
  erreur text,
  cree_le timestamptz not null default now(),
  constraint envois_canal check (canal in ('push', 'email')),
  constraint envois_statut check (statut in ('a_envoyer', 'envoye', 'abandonne'))
);
alter table public.envois add column if not exists prise uuid;
create index if not exists envois_a_envoyer on public.envois (prochain_essai) where statut = 'a_envoyer';
alter table public.envois enable row level security;
revoke all on public.envois from anon, authenticated;

-- ─── Le jeton du serveur (empreinte seulement) ──────────────────────────────────────────────────────
create table if not exists public.reglages_envois (
  id boolean primary key default true check (id),
  empreinte text
);
insert into public.reglages_envois (id) values (true) on conflict (id) do nothing;
alter table public.reglages_envois enable row level security;
revoke all on public.reglages_envois from anon, authenticated;

create or replace function public.nouveau_jeton_envois()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jeton text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  update public.reglages_envois set empreinte = encode(sha256(convert_to(v_jeton, 'UTF8')), 'hex') where id;
  return v_jeton;
end;
$$;

create or replace function public.exiger_jeton_envois(p_jeton text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_jeton is null or char_length(p_jeton) < 32
     or encode(sha256(convert_to(p_jeton, 'UTF8')), 'hex') is distinct from (select r.empreinte from public.reglages_envois r where r.id) then
    raise exception 'Jeton d’envoi non reconnu.' using errcode = '42501';
  end if;
end;
$$;

-- ─── Enregistrer ou retirer un appareil ─────────────────────────────────────────────────────────────
create or replace function public.enregistrer_appareil(p_adresse text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
begin
  if v_moi is null or public.compte_suspendu() then
    raise exception 'Connectez-vous pour recevoir les notifications push.' using errcode = '42501';
  end if;
  insert into public.appareils_push (profil_id, adresse, cle_p256dh, cle_auth)
  values (v_moi, p_adresse, p_p256dh, p_auth)
  on conflict (adresse) do update
    set profil_id = excluded.profil_id, cle_p256dh = excluded.cle_p256dh, cle_auth = excluded.cle_auth, vu_le = now();
  -- 10 appareils au plus par compte : les plus anciens partent.
  delete from public.appareils_push a
  where a.profil_id = v_moi
    and a.id not in (select b.id from public.appareils_push b where b.profil_id = v_moi order by b.vu_le desc, b.cree_le desc limit 10);
end;
$$;

create or replace function public.retirer_appareil(p_adresse text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.appareils_push where adresse = p_adresse and profil_id = (select auth.uid());
$$;

-- ─── Ce qui part par e-mail ─────────────────────────────────────────────────────────────────────────
-- L'abonnement et le paiement : les rappels d'expiration, et les notifications de service qui mènent à l'abonnement.
create or replace function public.notification_importante(p_categorie text, p_lien text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_categorie = 'expiration_renouvellement' or (p_categorie = 'service' and coalesce(p_lien, '') like '/abonnement%');
$$;

-- notifier : même définition qu'en 0036, plus l'e-mail d'une notification importante, mis dans la file avant les
-- filtres de préférences (« Toujours actif »).
create or replace function public.notifier(
  p_destinataires uuid[],
  p_categorie text,
  p_titre text,
  p_texte text,
  p_lien text,
  p_auteur_inclus boolean
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre integer;
begin
  delete from public.notifications
  where destinataire = any (p_destinataires) and cree_le < now() - interval '6 months';

  if public.notification_importante(p_categorie, p_lien) then
    insert into public.envois (canal, destinataire, titre, texte, lien)
    select 'email', p.id, left(p_titre, 200), left(coalesce(p_texte, ''), 400), p_lien
    from public.profils p
    where p.id = any (p_destinataires)
      and (coalesce(p_auteur_inclus, false) or p.id is distinct from (select auth.uid()));
  end if;

  insert into public.notifications (destinataire, categorie, titre, texte, lien)
  select p.id, p_categorie, left(p_titre, 200), left(coalesce(p_texte, ''), 400), p_lien
  from public.profils p
  where p.id = any (p_destinataires)
    and (coalesce(p_auteur_inclus, false) or p.id is distinct from (select auth.uid()))
    and (p.preferences_notifications ->> 'canal_appli') is distinct from 'false'
    and (p_categorie = 'service' or (p.preferences_notifications ->> p_categorie) is distinct from 'false')
    and not (
      p_categorie in ('sessions_live', 'nouveaux_contenus', 'rappels_apprentissage', 'recommandations', 'expiration_renouvellement')
      and exists (select 1 from public.roles r where r.profil_id = p.id and r.role = 'formateur')
    );
  get diagnostics v_nombre = row_count;
  return v_nombre;
end;
$$;

-- ─── Le push : chaque notification écrite, pour qui a un appareil ───────────────────────────────────
create or replace function public.pousser_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.envois (canal, destinataire, titre, texte, lien)
  select 'push', n.destinataire, n.titre, n.texte, n.lien
  from lignes n
  join public.profils p on p.id = n.destinataire
  where (p.preferences_notifications ->> 'canal_push') is distinct from 'false'
    and exists (select 1 from public.appareils_push a where a.profil_id = n.destinataire);
  return null;
end;
$$;
drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push
  after insert on public.notifications
  referencing new table as lignes
  for each statement execute function public.pousser_notifications();

-- ─── « Paiement reçu » : un abonnement payé en ligne (ou offert par un code) ────────────────────────
-- Un abonnement attribué à la main a déjà sa notification (0054).
create or replace function public.notifier_paiement_recu()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paiement public.paiements;
  v_formule text;
begin
  select * into v_paiement from public.paiements p where p.id = new.paiement_id;
  if not found or v_paiement.source = 'manuel' then
    return null;
  end if;
  select f.nom into v_formule from public.formules f where f.id = new.formule_id;
  perform public.notifier(
    array[new.profil_id],
    'service',
    case when v_paiement.montant > 0
      then format('Paiement reçu : votre abonnement %s est actif', v_formule)
      else format('Votre abonnement %s est actif', v_formule) end,
    case when v_paiement.montant > 0
      then format('Jusqu’au %s.', public.date_longue(new.fin)) || coalesce(format(' Votre reçu : %s.', v_paiement.numero_recu), '')
      else format('Offert par votre code promo, jusqu’au %s.', public.date_longue(new.fin)) end,
    case when v_paiement.numero_recu is not null then '/abonnement/recus/' || v_paiement.numero_recu else '/abonnement' end,
    true
  );
  return null;
end;
$$;
drop trigger if exists abonnements_paiement_recu on public.abonnements;
create trigger abonnements_paiement_recu
  after insert on public.abonnements
  for each row when (new.paiement_id is not null)
  execute function public.notifier_paiement_recu();

-- ─── Le compte suspendu ou réactivé : un e-mail (un compte suspendu ne voit plus l'appli) ───────────
create or replace function public.email_suspension()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.envois (canal, destinataire, titre, texte, lien)
    values ('email', new.profil_id, 'Votre compte Étudium est suspendu', 'Pour en savoir plus, répondez à cet e-mail : l’équipe Étudium vous lira.', null);
  else
    -- Le compte est supprimé (la suspension part avec lui) : personne à prévenir.
    if not exists (select 1 from public.profils where id = old.profil_id) then
      return null;
    end if;
    insert into public.envois (canal, destinataire, titre, texte, lien)
    values ('email', old.profil_id, 'Votre compte Étudium est réactivé', 'Vous retrouvez tous vos accès.', '/accueil');
  end if;
  return null;
end;
$$;
drop trigger if exists suspensions_email on public.suspensions;
create trigger suspensions_email
  after insert or delete on public.suspensions
  for each row execute function public.email_suspension();

-- ─── Le serveur prend la file, puis termine chaque envoi ────────────────────────────────────────────
create or replace function public.prendre_envois(p_jeton text, p_canaux text[], p_limite integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resultat jsonb;
  v_prise uuid := gen_random_uuid();
begin
  perform public.exiger_jeton_envois(p_jeton);
  -- Plus de 24 heures : trop tard pour prévenir.
  update public.envois set statut = 'abandonne', erreur = coalesce(erreur, 'Trop ancien'), pris_le = null
  where statut = 'a_envoyer' and cree_le < now() - interval '24 hours';
  -- Un compte sans adresse e-mail : rien à essayer.
  update public.envois e set statut = 'abandonne', erreur = 'Pas d’adresse e-mail', pris_le = null
  where e.statut = 'a_envoyer' and e.canal = 'email'
    and not exists (select 1 from auth.users u where u.id = e.destinataire and coalesce(btrim(u.email), '') <> '');

  with pris as (
    select e.id from public.envois e
    where e.statut = 'a_envoyer'
      and e.canal = any (coalesce(p_canaux, '{}'))
      and e.prochain_essai <= now()
      and (e.pris_le is null or e.pris_le < now() - interval '2 minutes')
    order by e.id
    limit greatest(1, least(coalesce(p_limite, 20), 50))
    for update skip locked
  ),
  reserves as (
    update public.envois e set pris_le = now(), prise = v_prise, essais = e.essais + 1
    from pris where e.id = pris.id
    returning e.*
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'prise', r.prise,
      'cree_le', r.cree_le,
      'canal', r.canal,
      'titre', r.titre,
      'texte', r.texte,
      'lien', r.lien,
      'email', case when r.canal = 'email' then (select u.email from auth.users u where u.id = r.destinataire) end,
      'prenom', (select nullif(btrim(p.prenom), '') from public.profils p where p.id = r.destinataire),
      'appareils', case when r.canal = 'push' then coalesce((
        select jsonb_agg(jsonb_build_object('adresse', a.adresse, 'p256dh', a.cle_p256dh, 'auth', a.cle_auth))
        from public.appareils_push a where a.profil_id = r.destinataire
      ), '[]'::jsonb) else '[]'::jsonb end
    )
    order by r.id
  ), '[]'::jsonb) into v_resultat
  from reserves r;
  return v_resultat;
end;
$$;

drop function if exists public.terminer_envoi(text, bigint, boolean, text, text[]);
create or replace function public.terminer_envoi(p_jeton text, p_id bigint, p_prise uuid, p_reussi boolean, p_erreur text, p_disparus text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_jeton_envois(p_jeton);
  delete from public.appareils_push where adresse = any (coalesce(p_disparus, '{}'));
  -- Seule la prise en cours compte : après 2 minutes, un autre serveur a pu reprendre (et faire) l'envoi.
  if p_reussi then
    update public.envois set statut = 'envoye', pris_le = null, erreur = null
    where id = p_id and statut = 'a_envoyer' and prise = p_prise;
    return;
  end if;
  -- 4 essais au plus : un nouvel essai 1, 5 puis 15 minutes plus tard, puis abandon.
  update public.envois
  set statut = case when essais >= 4 then 'abandonne' else 'a_envoyer' end,
      pris_le = null,
      erreur = left(coalesce(p_erreur, 'Échec'), 500),
      prochain_essai = now() + case essais when 1 then interval '1 minute' when 2 then interval '5 minutes' else interval '15 minutes' end
  where id = p_id and statut = 'a_envoyer' and prise = p_prise;
end;
$$;

create or replace function public.purger_envois()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.envois where cree_le < now() - interval '7 days';
$$;

-- ─── Droits ─────────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public.nouveau_jeton_envois() from public, anon, authenticated;
revoke execute on function public.exiger_jeton_envois(text) from public, anon, authenticated;
revoke execute on function public.notification_importante(text, text) from public, anon, authenticated;
revoke execute on function public.pousser_notifications() from public, anon, authenticated;
revoke execute on function public.notifier_paiement_recu() from public, anon, authenticated;
revoke execute on function public.email_suspension() from public, anon, authenticated;
revoke execute on function public.purger_envois() from public, anon, authenticated;
revoke execute on function public.notifier(uuid[], text, text, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.enregistrer_appareil(text, text, text) from public, anon;
revoke execute on function public.retirer_appareil(text) from public, anon;
revoke execute on function public.prendre_envois(text, text[], integer) from public;
revoke execute on function public.terminer_envoi(text, bigint, uuid, boolean, text, text[]) from public;
grant execute on function public.enregistrer_appareil(text, text, text) to authenticated;
grant execute on function public.retirer_appareil(text) to authenticated;
-- Le serveur appelle avec ou sans session : le jeton fait foi.
grant execute on function public.prendre_envois(text, text[], integer) to anon, authenticated;
grant execute on function public.terminer_envoi(text, bigint, uuid, boolean, text, text[]) to anon, authenticated;

commit;

-- ─── La purge, chaque jour à 4 h 10 ─────────────────────────────────────────────────────────────────
do $cron$
begin
  begin
    create extension if not exists pg_cron with schema pg_catalog;
  exception when others then
    raise notice 'pg_cron indisponible (%) : activez Cron dans Supabase, puis relancez ce bloc.', sqlerrm;
    return;
  end;
  begin
    perform cron.schedule('etudium-envois-purge', '10 4 * * *', 'select public.purger_envois()');
  exception when others then
    raise notice 'Tâche planifiée non créée (%) : voir le guide « Ce qui te revient », section 59.', sqlerrm;
  end;
end
$cron$;

-- ─── Le jeton : affiché une seule fois. Recopie-le dans web/.env.local (ENVOIS_JETON=…). ────────────
select case
  when (select empreinte from public.reglages_envois where id) is null then public.nouveau_jeton_envois()
  else 'Jeton déjà créé. Pour en créer un autre : select public.nouveau_jeton_envois();'
end as jeton_envois;

-- ═══ 0059_desactivation_formations.sql ═══
-- Migration 0059 : désactiver une formation (lot 5, étape C ; spec du 15 octobre, Q12 et Q13).
-- Une formation désactivée n'ouvre plus rien aux étudiants, tout de suite : la règle d'accès aux leçons (0050) n'ouvre
-- que les formations publiées (leçons, quiz, exercices, visionnage, discussions, images suivent). Elle reste dans
-- « Mes formations » de qui l'a commencée ; progression, certificats et avis sont gardés. L'équipe seule désactive et
-- réactive (0047 refuse tout changement d'état au formateur). Ceux qui la suivent sont prévenus : appli, push (0058)
-- et e-mail (message important).
-- Rejouable.

-- ─── Le nouvel état ─────────────────────────────────────────────────────────────────────────────────
-- Il ne sert pas dans cette migration (Postgres l'interdit avant sa validation, comme en 0030) : les fonctions
-- comparent le texte du statut.
alter type public.statut_formation add value if not exists 'desactivee';

begin;

-- ─── Les étudiants qui suivent une formation ────────────────────────────────────────────────────────
-- Ceux qui en ont ouvert une leçon, sans les comptes suspendus ni l'équipe et les formateurs (qui ouvrent des leçons
-- pour les relire, sans être des étudiants).
create or replace function public.suiveurs_actifs_formation(p_formation uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(s), '{}')
  from unnest(public.suiveurs_formation(p_formation)) s
  where not exists (select 1 from public.suspensions su where su.profil_id = s)
    and not exists (select 1 from public.roles r where r.profil_id = s and r.role in ('admin', 'moderateur', 'super_admin', 'formateur'));
$$;

-- Pour la fenêtre de confirmation du back-office : « N étudiants suivent cette formation ».
create or replace function public.nombre_suiveurs_formation(p_formation uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.equipe_contenus() then
    raise exception 'Réservé à l’équipe.' using errcode = '42501';
  end if;
  return cardinality(public.suiveurs_actifs_formation(p_formation));
end;
$$;

-- ─── Les passages permis ────────────────────────────────────────────────────────────────────────────
-- Désactiver : une formation publiée seulement. Une formation désactivée se réactive (elle redevient publiée) ou
-- s'archive (aucun accès étudiant non plus ; 0016 prévient ceux qui la suivent).
create or replace function public.desactivation_regle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.statut::text = 'desactivee' and old.statut::text not in ('desactivee', 'publiee') then
    raise exception 'Seule une formation publiée peut être désactivée.' using errcode = 'P0001';
  end if;
  if old.statut::text = 'desactivee' and new.statut::text not in ('desactivee', 'publiee', 'archivee') then
    raise exception 'Une formation désactivée se réactive (elle redevient publiée) ou s’archive.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists formations_desactivation_regle on public.formations;
create trigger formations_desactivation_regle
  before update of statut on public.formations
  for each row execute function public.desactivation_regle();

-- ─── Prévenir : les étudiants (appli, push, e-mail) et le formateur ─────────────────────────────────
create or replace function public.notifier_desactivation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_suiveurs uuid[];
  v_formateur uuid;
  v_titre text;
  v_texte text;
  v_lien text;
  v_titre_formateur text;
begin
  if new.statut::text = 'desactivee' and old.statut::text <> 'desactivee' then
    v_titre := format('« %s » est momentanément indisponible', new.titre);
    v_texte := 'Votre progression et vos certificats sont conservés.';
    v_lien := '/mes-formations';
    v_titre_formateur := format('Votre formation « %s » est désactivée par l’équipe', new.titre);
  elsif old.statut::text = 'desactivee' and new.statut::text = 'publiee' then
    v_titre := format('« %s » est de nouveau disponible', new.titre);
    v_texte := 'Elle est de nouveau dans le catalogue.';
    v_lien := '/formations/' || new.slug;
    v_titre_formateur := format('Votre formation « %s » est de nouveau en ligne', new.titre);
  else
    return null;
  end if;

  v_suiveurs := public.suiveurs_actifs_formation(new.id);
  perform public.notifier(v_suiveurs, 'service', v_titre, v_texte, v_lien, true);
  -- Un message important (Q10) : l'e-mail part, quelles que soient les préférences.
  insert into public.envois (canal, destinataire, titre, texte, lien)
  select 'email', s, v_titre, v_texte, v_lien from unnest(v_suiveurs) s;

  select compte_id into v_formateur from public.formateurs where id = new.formateur_id;
  if v_formateur is not null then
    perform public.notifier(array[v_formateur], 'service', v_titre_formateur, '', '/formateur/formations/' || new.id, true);
  end if;
  return null;
end;
$$;
drop trigger if exists formations_desactivation on public.formations;
create trigger formations_desactivation
  after update of statut on public.formations
  for each row execute function public.notifier_desactivation();

-- ─── L'historique (0057) : réactiver ne crée pas de version (le contenu n'a pas changé) ─────────────
create or replace function public.version_mise_en_ligne()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.statut = 'publiee' and old.statut is distinct from 'publiee' and old.statut::text <> 'desactivee' then
    perform public.noter_version(new.id, 'Mise en ligne');
  end if;
  return null;
end;
$$;

-- ─── Droits ─────────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public.suiveurs_actifs_formation(uuid) from public, anon, authenticated;
-- anon a sa propre autorisation par défaut chez Supabase : retirée aussi (point reporté du lot 5 C).
revoke execute on function public.nombre_suiveurs_formation(uuid) from public, anon;
revoke execute on function public.desactivation_regle() from public, anon, authenticated;
revoke execute on function public.notifier_desactivation() from public, anon, authenticated;
grant execute on function public.nombre_suiveurs_formation(uuid) to authenticated;

commit;

-- ═══ 0060_domaines_equipe.sql ═══
-- Migration 0060 : les domaines du back-office par rôle (lot 6, partie A ; spec du 2 novembre 2026, §1).
-- Rôles fixes : le modérateur gère la communauté ; l'admin, tout sauf les rôles et le journal ; le super admin, tout.
-- Un compte suspendu n'a plus aucun domaine. La même table existe dans l'appli (src/lib/auth/domaines.ts), comparée
-- à celle-ci par un test.
--
-- equipe_contenus() passe aux admins : toutes les règles des contenus, des paiements et des comptes qui l'appellent se
-- ferment aux modérateurs. La communauté passe par equipe_communaute() : ses fonctions sont redéfinies à l'identique,
-- recopiées depuis leur dernière définition (seul l'appel change). Les lectures des paiements qui passaient par
-- exiger_equipe_moderation() passent par exiger_equipe_admin().
-- Rejouable.

begin;

-- ─── Les domaines ───────────────────────────────────────────────────────────────────────────────────
create or replace function public.domaines_role(p_role text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_role
    when 'moderateur' then array['communaute']
    when 'admin' then array['communaute', 'contenus', 'utilisateurs', 'paiements', 'statistiques']
    when 'super_admin' then array['communaute', 'contenus', 'utilisateurs', 'paiements', 'statistiques', 'roles', 'journal']
    else array[]::text[]
  end;
$$;

-- Le compte appelant a-t-il ce domaine ? Jamais pour un compte suspendu.
create or replace function public.a_domaine(p_domaine text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not public.compte_suspendu() and exists (
    select 1 from public.roles r
    where r.profil_id = (select auth.uid()) and p_domaine = any (public.domaines_role(r.role::text))
  );
$$;

-- L'équipe de la communauté : modérateurs, admins, super admins (l'ancien sens de equipe_contenus()).
create or replace function public.equipe_communaute()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.a_domaine('communaute');
$$;

-- L'équipe des contenus (et du reste du back-office) : admins et super admins.
create or replace function public.equipe_contenus()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.a_domaine('contenus');
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
  if not public.equipe_communaute() then
    raise exception 'Réservé à l’équipe.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.exiger_equipe_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  if not public.equipe_contenus() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.domaines_role(text) from public, anon;
revoke execute on function public.a_domaine(text) from public, anon;
revoke execute on function public.equipe_communaute() from public;
revoke execute on function public.exiger_equipe_admin() from public, anon;
grant execute on function public.domaines_role(text) to authenticated;
grant execute on function public.a_domaine(text) to authenticated;
-- Les règles des tables et des fichiers l'appellent aussi sans compte, comme equipe_contenus() (0004).
grant execute on function public.equipe_communaute() to anon, authenticated;
grant execute on function public.exiger_equipe_admin() to authenticated;

-- ─── La communauté et les lectures des paiements, redéfinies à l'identique ──────────────────────────

-- carte_publication : dernière définition en 0046_replays.sql
create or replace function public.carte_publication(p public.publications)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'auteur', jsonb_build_object('prenom', coalesce(pr.prenom, ''), 'nom', coalesce(pr.nom, ''), 'role', public.role_communaute(p.auteur), 'photo', pr.photo_url),
    'est_moi', p.auteur = (select auth.uid()),
    'espace', case when p.replay then jsonb_build_object('id', 'replays', 'nom', 'Replays de live')
      else jsonb_build_object('id', p.parcours_id, 'nom', public.nom_espace_communaute(p.parcours_id)) end,
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
      select jsonb_agg(jsonb_build_object('initiales', public.initiales_avis(pr2.prenom, pr2.nom), 'photo', pr2.photo_url) order by d.cree_le desc, d.profil_id)
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
    'peut_supprimer', p.auteur = (select auth.uid()) or public.equipe_communaute(),
    'peut_signaler', p.statut = 'publiee' and p.auteur <> (select auth.uid()) and not public.equipe_communaute()
  )
  from public.profils pr
  where pr.id = p.auteur;
$$;

-- carte_reponse : dernière définition en 0038_photos_communaute.sql
create or replace function public.carte_reponse(c public.commentaires_publications)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'auteur', jsonb_build_object('prenom', coalesce(pr.prenom, ''), 'nom_court', public.nom_avis(pr.prenom, pr.nom), 'photo', pr.photo_url),
    'est_moi', c.auteur = (select auth.uid()),
    'texte', c.texte,
    'cree_le', c.cree_le,
    'parent_id', c.parent_id,
    'modifie', c.modifie_le is not null,
    'reactions', (select count(*)::int from public.reactions_commentaires r where r.commentaire_id = c.id),
    'j_aime', exists (select 1 from public.reactions_commentaires r where r.commentaire_id = c.id and r.profil_id = (select auth.uid())),
    'peut_modifier', c.auteur = (select auth.uid()) or public.equipe_communaute(),
    'peut_supprimer', c.auteur = (select auth.uid()) or public.equipe_communaute(),
    'peut_signaler', c.auteur <> (select auth.uid()) and not public.equipe_communaute()
  )
  from public.profils pr
  where pr.id = c.auteur;
$$;

-- carte_commentaire_lecon : dernière définition en 0038_photos_communaute.sql
create or replace function public.carte_commentaire_lecon(c public.commentaires_lecons)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'auteur', jsonb_build_object('prenom', coalesce(pr.prenom, ''), 'nom_court', public.nom_avis(pr.prenom, pr.nom), 'photo', pr.photo_url),
    'est_moi', c.auteur = (select auth.uid()),
    'texte', c.texte,
    'cree_le', c.cree_le,
    'parent_id', c.parent_id,
    'modifie', c.modifie_le is not null,
    'reactions', (select count(*)::int from public.reactions_commentaires_lecons r where r.commentaire_id = c.id),
    'j_aime', exists (select 1 from public.reactions_commentaires_lecons r where r.commentaire_id = c.id and r.profil_id = (select auth.uid())),
    'peut_modifier', c.auteur = (select auth.uid()),
    'peut_supprimer', c.auteur = (select auth.uid()) or public.equipe_communaute() or public.formateur_de(public.formation_de_la_lecon(c.lecon_id)),
    'peut_signaler', c.auteur <> (select auth.uid()) and not public.equipe_communaute(),
    -- L'étiquette « Formateur » : l'auteur est le formateur de la formation.
    'formateur', exists (
      select 1 from public.formations f join public.formateurs fo on fo.id = f.formateur_id
      where f.id = public.formation_de_la_lecon(c.lecon_id) and fo.compte_id = c.auteur
    )
  )
  from public.profils pr
  where pr.id = c.auteur;
$$;

-- supprimer_publication : dernière définition en 0019_communaute.sql
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
  if v.auteur <> (select auth.uid()) and not public.equipe_communaute() then
    raise exception 'Cette publication n’est pas la vôtre.' using errcode = '42501';
  end if;
  delete from public.publications where id = p_id;
  return v.piece_jointe ->> 'chemin';
end;
$$;

-- supprimer_commentaire : dernière définition en 0025_communaute_commentaires.sql
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
  if v.auteur <> (select auth.uid()) and not public.equipe_communaute() then
    raise exception 'Cette réponse n’est pas la vôtre.' using errcode = '42501';
  end if;
  select count(*) + 1 into v_nombre from public.commentaires_publications where parent_id = p_id;
  delete from public.commentaires_publications where id = p_id;
  return v_nombre;
end;
$$;

-- supprimer_commentaire_lecon : dernière définition en 0028_discussions_lecons.sql
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
  if v.auteur <> (select auth.uid()) and not public.equipe_communaute() and not public.formateur_de(public.formation_de_la_lecon(v.lecon_id)) then
    raise exception 'Ce commentaire n’est pas le vôtre.' using errcode = '42501';
  end if;
  select count(*) + 1 into v_nombre from public.commentaires_lecons where parent_id = p_id;
  delete from public.commentaires_lecons where id = p_id;
  return v_nombre;
end;
$$;

-- modifier_commentaire : dernière définition en 0025_communaute_commentaires.sql
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
  if v.auteur <> (select auth.uid()) and not public.equipe_communaute() then
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

-- signaler : dernière définition en 0020_moderation.sql
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
  if public.equipe_communaute() then
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

-- signaler_commentaire_lecon : dernière définition en 0028_discussions_lecons.sql
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
  if public.equipe_communaute() then
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

-- bloc_sondage : dernière définition en 0026_communaute_sondages.sql
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
  v_voit := v_repondu or v_ferme or public.equipe_communaute()
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

-- reprogrammer : dernière définition en 0026_communaute_sondages.sql
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
  if v.auteur <> (select auth.uid()) and not public.equipe_communaute() then
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

-- images_sondage : dernière définition en 0026_communaute_sondages.sql
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
    and (p.auteur = (select auth.uid()) or public.equipe_communaute());
$$;

-- publication_communaute : dernière définition en 0050_acces_abonnes.sql
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
  if not found or not public.peut_lire_publication(v) or not (public.publication_visible(v) or public.equipe_communaute()) then
    return null;
  end if;
  return public.carte_publication(v) || jsonb_build_object('toutes_reponses', coalesce((
    select jsonb_agg(public.carte_reponse(c) order by c.cree_le, c.id)
    from public.commentaires_publications c
    where c.publication_id = v.id
  ), '[]'::jsonb));
end;
$$;

-- publication_ouverte : dernière définition en 0050_acces_abonnes.sql
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
  if not public.peut_lire_publication(v) then
    raise exception 'Cet espace ne vous est pas ouvert.' using errcode = '42501';
  end if;
  if v.statut <> 'publiee' and not public.equipe_communaute() then
    if v.statut = 'en_attente' and v.auteur = (select auth.uid()) then
      raise exception 'Cette publication attend sa vérification.';
    end if;
    raise exception 'Cette publication n’existe plus.';
  end if;
  -- Programmée : rien avant son heure (l'auteur le sait ; pour les autres, elle n'existe pas encore).
  if v.cree_le > now() and not public.equipe_communaute() then
    if v.auteur = (select auth.uid()) then
      raise exception 'Cette publication n’est pas encore parue.';
    end if;
    raise exception 'Cette publication n’existe plus.';
  end if;
  return v;
end;
$$;

-- peut_lire_espace : dernière définition en 0050_acces_abonnes.sql
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
      or public.equipe_communaute()
      or exists (
        select 1 from public.parcours pa
        where pa.id = p_parcours and pa.actif
          and (
            public.abonne((select auth.uid()))
            or exists (
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

-- acces_abonne : dernière définition en 0050_acces_abonnes.sql
create or replace function public.acces_abonne()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.equipe_communaute() or public.abonne((select auth.uid()));
$$;

-- avis_equipe : dernière définition en 0010_avis.sql
create or replace function public.avis_equipe()
returns table (
  id uuid,
  formation_titre text,
  formation_slug text,
  auteur text,
  note smallint,
  commentaire text,
  masque boolean,
  cree_le timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, f.titre, f.slug, public.nom_avis(p.prenom, p.nom), a.note, a.commentaire, a.masque, a.cree_le
  from public.avis a
  join public.formations f on f.id = a.formation_id
  join public.profils p on p.id = a.profil_id
  where public.equipe_communaute()
  order by a.cree_le desc;
$$;

-- masquer_avis : dernière définition en 0010_avis.sql
create or replace function public.masquer_avis(p_avis uuid, p_masque boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.equipe_communaute() then
    raise exception 'Le masquage des avis est réservé à l’équipe.' using errcode = '42501';
  end if;
  update public.avis set masque = coalesce(p_masque, false) where id = p_avis;
end;
$$;

-- cote_conversation : dernière définition en 0035_messagerie.sql
create or replace function public.cote_conversation(p_conversation uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when c.etudiant_id = (select auth.uid()) then 'etudiant'
    when c.formateur_id is not null and c.formateur_id = (select auth.uid()) and public.a_role('formateur') then 'formateur'
    when c.formateur_id is null and public.equipe_communaute() then 'equipe'
  end
  from public.conversations c
  where c.id = p_conversation;
$$;

-- conversations_de : dernière définition en 0035_messagerie.sql
create or replace function public.conversations_de(p_espace text)
returns setof public.conversations
language sql
stable
security definer
set search_path = ''
as $$
  select c.*
  from public.conversations c
  where (
      (p_espace = 'etudiant' and c.etudiant_id = (select auth.uid()))
      or (p_espace = 'formateur' and c.formateur_id = (select auth.uid()) and public.a_role('formateur'))
      or (p_espace = 'equipe' and c.formateur_id is null and public.equipe_communaute())
    )
    and exists (select 1 from public.messages m where m.conversation_id = c.id);
$$;

-- droit_session : dernière définition en 0018_sessions_live.sql
create or replace function public.droit_session(p_formateur uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- coalesce : sans fiche (étudiant), la comparaison est « inconnue », jamais « vraie » ni ignorée.
  select public.equipe_communaute() or coalesce(p_formateur = public.ma_fiche_formateur(), false);
$$;

-- creer_session : dernière définition en 0036_formateur_sans_espace_etudiant.sql
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
  v_equipe boolean := public.equipe_communaute();
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
  -- L'animateur (un formateur, qui ne reçoit plus les sessions live) est prévenu dans son espace ; pas s'il l'a créée.
  perform public.notifier(
    array(select fo.compte_id from public.formateurs fo where fo.id = v_formateur and fo.compte_id is not null), 'service',
    'Session live programmée : ' || v_titre, public.majuscule(public.quand_session(p_debut)) || '.', '/formateur/sessions'
  );
  return v_id;
end;
$$;

-- modifier_session : dernière définition en 0024_sessions_promotion.sql
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
  v_equipe boolean := public.equipe_communaute();
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

-- annuler_session : dernière définition en 0018_sessions_live.sql
create or replace function public.annuler_session(p_session uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.sessions_live%rowtype;
begin
  if not public.equipe_communaute() and public.ma_fiche_formateur() is null then
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
  update public.sessions_live set statut = 'annulee', annulee_le = now() where id = p_session;
  perform public.notifier(
    array(select profil_id from public.inscriptions_sessions where session_id = p_session), 'sessions_live',
    'Session live annulée', v.titre || ', prévue ' || public.quand_session(v.debut) || '.', '/evenements'
  );
end;
$$;

-- sessions_equipe : dernière définition en 0018_sessions_live.sql
create or replace function public.sessions_equipe()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.equipe_communaute() then
    raise exception 'Accès réservé à l’équipe.' using errcode = '42501';
  end if;
  return public.liste_sessions_edition(null);
end;
$$;

-- peut_publier_replay : dernière définition en 0046_replays.sql
create or replace function public.peut_publier_replay()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.equipe_communaute() or public.ma_fiche_formateur() is not null;
$$;

-- codes_promo_equipe : dernière définition en 0051_paiements_equipe.sql
create or replace function public.codes_promo_equipe()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_equipe_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id,
      'code', c.code,
      'type', c.type,
      'valeur', c.valeur,
      'debut', c.debut,
      'fin', c.fin,
      'limite', c.limite,
      'actif', c.actif,
      'cree_le', c.cree_le,
      -- Seuls les paiements réussis consomment un code.
      'utilisations', (select count(*)::integer from public.paiements p where p.code_promo_id = c.id and p.statut = 'reussi')
    ) order by c.cree_le desc, c.code)
    from public.codes_promo c
  ), '[]'::jsonb);
end;
$$;

-- paiements_equipe : dernière définition en 0054_abonnements_manuels.sql
create or replace function public.paiements_equipe(p_statut text, p_recherche text, p_page integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := lower(btrim(coalesce(p_recherche, '')));
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_resultat jsonb;
begin
  perform public.exiger_equipe_admin();
  with lignes as (
    select p.id, p.cree_le, p.montant, p.statut, p.operateur, p.telephone_masque, p.numero_recu, p.profil_id, p.source, p.moyen_manuel,
           coalesce(pr.prenom, '') as prenom, coalesce(pr.nom, '') as nom, coalesce(u.email, '') as email,
           f.code as formule_code, f.nom as formule_nom, f.duree_mois
    from public.paiements p
    join public.formules f on f.id = p.formule_id
    left join public.profils pr on pr.id = p.profil_id
    left join auth.users u on u.id = p.profil_id
    where not (p.source = 'payiz' and p.payiz_id is null and p.montant > 0)
      and case
        when coalesce(p_statut, '') = '' then true
        when p_statut = 'expire' then p.statut in ('expire', 'annule')
        else p.statut = p_statut
      end
      and (
        v_q = ''
        or strpos(lower(coalesce(p.numero_recu, '')), v_q) > 0
        or strpos(lower(coalesce(u.email, '')), v_q) > 0
        or strpos(public.sans_accents(coalesce(pr.prenom, '') || ' ' || coalesce(pr.nom, '')), public.sans_accents(v_q)) > 0
      )
  ),
  page as (
    select * from lignes order by cree_le desc, id limit 20 offset (v_page - 1) * 20
  )
  select jsonb_build_object(
    'total', (select count(*) from lignes),
    'lignes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'cree_le', g.cree_le,
        'compte', jsonb_build_object('id', g.profil_id, 'prenom', g.prenom, 'nom', g.nom, 'email', g.email),
        'formule', jsonb_build_object('code', g.formule_code, 'nom', g.formule_nom, 'duree_mois', g.duree_mois),
        'montant', g.montant,
        'statut', g.statut,
        'operateur', g.operateur,
        'telephone_masque', g.telephone_masque,
        'numero_recu', g.numero_recu,
        'source', g.source,
        'moyen_manuel', g.moyen_manuel
      ) order by g.cree_le desc, g.id)
      from page g
    ), '[]'::jsonb)
  ) into v_resultat;
  return v_resultat;
end;
$$;

-- paiement_equipe : dernière définition en 0051_paiements_equipe.sql
create or replace function public.paiement_equipe(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.paiements%rowtype;
begin
  perform public.exiger_equipe_admin();
  select * into v from public.paiements where id = p_id;
  if not found then
    return null;
  end if;
  return public.carte_paiement(v) || jsonb_build_object(
    'compte', (
      select jsonb_build_object('id', pr.id, 'prenom', pr.prenom, 'nom', pr.nom, 'email', coalesce(u.email, ''))
      from public.profils pr left join auth.users u on u.id = pr.id
      where pr.id = v.profil_id
    ),
    'abonnement', (
      select jsonb_build_object('id', a.id, 'debut', a.debut, 'fin', a.fin, 'annule_le', a.annule_le, 'motif_annulation', a.motif_annulation)
      from public.abonnements a where a.paiement_id = v.id
    )
  );
end;
$$;

-- resume_paiements : dernière définition en 0051_paiements_equipe.sql
create or replace function public.resume_paiements()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_mois timestamptz := date_trunc('month', now() at time zone 'Africa/Porto-Novo') at time zone 'Africa/Porto-Novo';
begin
  perform public.exiger_equipe_admin();
  return jsonb_build_object(
    'revenus_mois', coalesce((select sum(p.montant) from public.paiements p where p.statut = 'reussi' and p.confirme_le >= v_mois), 0),
    'reussis_mois', (select count(*) from public.paiements p where p.statut = 'reussi' and p.confirme_le >= v_mois),
    'echoues_mois', (select count(*) from public.paiements p where p.statut = 'echoue' and p.cree_le >= v_mois),
    'abonnes_actifs', (
      select count(distinct a.profil_id) from public.abonnements a
      where a.annule_le is null and a.debut <= now() and now() < a.fin
    )
  );
end;
$$;

-- abonnements_compte : dernière définition en 0054_abonnements_manuels.sql
create or replace function public.abonnements_compte(p_compte uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_equipe_admin();
  return jsonb_build_object(
    'etat', public.etat_abonnement(p_compte),
    'abonnements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'formule', jsonb_build_object('code', f.code, 'nom', f.nom, 'duree_mois', f.duree_mois),
        'debut', a.debut,
        'fin', a.fin,
        'annule_le', a.annule_le,
        'motif_annulation', a.motif_annulation,
        'paiement_id', p.id,
        'source', p.source,
        'moyen_manuel', p.moyen_manuel,
        'operateur', p.operateur,
        'montant', p.montant,
        'numero_recu', p.numero_recu
      ) order by a.debut desc)
      from public.abonnements a
      join public.formules f on f.id = a.formule_id
      join public.paiements p on p.id = a.paiement_id
      where a.profil_id = p_compte
    ), '[]'::jsonb)
  );
end;
$$;

-- politique « communaute : lire » : 0019_communaute.sql
drop policy if exists "communaute : lire" on storage.objects;
create policy "communaute : lire" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'communaute'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.fichier_communaute_lisible(objects.name))
      or (select public.equipe_communaute())
    )
  );

-- politique « communaute : supprimer » : 0019_communaute.sql
drop policy if exists "communaute : supprimer" on storage.objects;
create policy "communaute : supprimer" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'communaute'
    and (
      ((storage.foldername(name))[1] = (select auth.uid())::text and not (select public.fichier_communaute_attache(objects.name)))
      or (select public.equipe_communaute())
    )
  );

-- ─── Les notifications de l'équipe des contenus ─────────────────────────────────────────────────────
-- Les membres actifs de l'équipe qui ont un domaine (comme membres_equipe(), 0016, pour un domaine).
create or replace function public.membres_domaine(p_domaine text)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct r.profil_id), '{}')
  from public.roles r
  where p_domaine = any (public.domaines_role(r.role::text))
    and not exists (select 1 from public.suspensions s where s.profil_id = r.profil_id);
$$;
revoke execute on function public.membres_domaine(text) from public, anon, authenticated;

-- « Formation à valider » : aux admins (domaine des contenus), plus au modérateur. Dernière définition en 0016_notifications.sql,
-- recopiée à l'identique sauf ses destinataires.
create or replace function public.notifications_formations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_formateur uuid;
  v_deja uuid[] := '{}';
  v_parcours record;
  v_suiveurs uuid[];
  v_remarque text;
begin
  select compte_id into v_formateur from public.formateurs where id = new.formateur_id;

  -- Première publication (republier une formation archivée ne compte pas) : les étudiants de ses parcours, une
  -- seule fois chacun, avec le premier parcours qu'ils suivent ; puis son formateur.
  if new.publiee_le is not null and (tg_op = 'INSERT' or old.publiee_le is null) then
    for v_parcours in
      select pa.id, pa.nom_court
      from public.formations_parcours fp
      join public.parcours pa on pa.id = fp.parcours_id
      where fp.formation_id = new.id
      order by pa.ordre, pa.nom_court
    loop
      select coalesce(array_agg(distinct p.profil_id), '{}') into v_suiveurs
      from public.progression_lecons p
      join public.lecons l on l.id = p.lecon_id
      join public.modules m on m.id = l.module_id
      join public.formations_parcours fp on fp.formation_id = m.formation_id
      where fp.parcours_id = v_parcours.id
        and not (p.profil_id = any (v_deja))
        and p.profil_id is distinct from v_formateur;
      perform public.notifier(
        v_suiveurs, 'nouveaux_contenus', 'Nouvelle formation : ' || new.titre,
        'Dans le parcours ' || v_parcours.nom_court || '.', '/formations/' || new.slug
      );
      v_deja := v_deja || v_suiveurs;
    end loop;
    if v_formateur is not null then
      perform public.notifier(array[v_formateur], 'service', 'Votre formation est en ligne', new.titre, '/formateur/formations/' || new.id);
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.statut = 'archivee' and old.statut <> 'archivee' then
      perform public.notifier(
        public.suiveurs_formation(new.id), 'service', 'Formation archivée',
        new.titre || ' n’est plus disponible. Votre progression est conservée.', '/mes-formations'
      );
    end if;

    if new.envoyee_le is not null and old.envoyee_le is null then
      perform public.notifier(
        public.membres_domaine('contenus'), 'service', 'Formation à valider',
        new.titre || ', par ' || coalesce((select nom from public.formateurs where id = new.formateur_id), 'un formateur'),
        '/admin/formations/' || new.id || '?onglet=publication'
      );
    end if;

    if new.renvoyee_le is not null and new.renvoyee_le is distinct from old.renvoyee_le and v_formateur is not null then
      v_remarque := coalesce(new.remarque_relecture, '');
      if char_length(v_remarque) > 120 then
        v_remarque := left(v_remarque, 119) || '…';
      end if;
      perform public.notifier(
        array[v_formateur], 'service', 'Votre formation est à corriger', v_remarque,
        '/formateur/formations/' || new.id || '?onglet=publication'
      );
    end if;
  end if;
  return null;
end;
$$;

commit;

-- ═══ 0061_journal_comptes.sql ═══
-- Migration 0061 : le journal des actions de l'équipe, renommer et supprimer un compte (lot 6, partie A ;
-- spec du 2 novembre 2026, §2 et §3).
-- Le journal est écrit par la base, dans la même opération que l'action, par des déclencheurs sur les tables qu'elle
-- modifie : impossible de l'oublier ou de le contourner. Seules les actions d'un membre de l'équipe y entrent (pas
-- celles des étudiants, des formateurs, des tâches planifiées ni de Payiz). Personne n'y écrit, ne le modifie ni ne
-- l'efface ; le super admin seul le lit.
-- Rejouable.

begin;

-- ─── La table ───────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.journal_actions (
  id bigint generated always as identity primary key,
  cree_le timestamptz not null default now(),
  auteur uuid references public.profils (id) on delete set null,
  -- Le nom figé au moment de l'action : le compte peut changer de nom ou disparaître.
  auteur_nom text not null,
  categorie text not null,
  action text not null,
  cible_type text,
  cible_id text,
  cible_libelle text,
  resume text not null,
  details jsonb not null default '{}',
  constraint journal_actions_categorie check (categorie in ('comptes', 'paiements', 'contenus', 'communaute'))
);
create index if not exists journal_actions_categorie on public.journal_actions (categorie, id desc);
create index if not exists journal_actions_auteur on public.journal_actions (auteur, id desc);
alter table public.journal_actions enable row level security;
revoke all on public.journal_actions from public, anon, authenticated;

-- ─── Les libellés ───────────────────────────────────────────────────────────────────────────────────
create or replace function public.libelle_role(p_role text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_role
    when 'moderateur' then 'Modérateur'
    when 'admin' then 'Administrateur'
    when 'super_admin' then 'Super admin'
    when 'formateur' then 'Formateur'
    when 'etudiant' then 'Étudiant'
    else p_role
  end;
$$;

create or replace function public.libelle_statut_formation(p_statut text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_statut
    when 'brouillon' then 'Brouillon'
    when 'publiee' then 'Publiée'
    when 'archivee' then 'Archivée'
    when 'desactivee' then 'Désactivée'
    else p_statut
  end;
$$;

-- « 15 000 » : les milliers séparés par une espace.
create or replace function public.montant_lisible(p integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(p::text, '(\d)(?=(\d{3})+$)', '\1 ', 'g');
$$;

-- ─── Écrire une ligne (interne : seuls les déclencheurs et les fonctions de la base l'appellent) ────
create or replace function public.journaliser(
  p_categorie text, p_action text, p_cible_type text, p_cible_id text, p_cible_libelle text, p_resume text,
  p_details jsonb default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auteur uuid := (select auth.uid());
begin
  -- Seulement les actions d'un membre de l'équipe.
  if v_auteur is null or not public.equipe_communaute() then
    return;
  end if;
  insert into public.journal_actions (auteur, auteur_nom, categorie, action, cible_type, cible_id, cible_libelle, resume, details)
  values (
    v_auteur, coalesce(public.nom_du_profil(v_auteur), 'Membre de l’équipe'), p_categorie, p_action, p_cible_type, p_cible_id,
    p_cible_libelle, p_resume, coalesce(p_details, '{}')
  );
end;
$$;

-- ─── Comptes ────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.journal_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_compte uuid := coalesce(new.profil_id, old.profil_id);
  v_role text := coalesce(new.role, old.role)::text;
  v_nom text;
begin
  if v_role = 'etudiant' then
    return null;
  end if;
  -- Un compte supprimé emporte ses rôles : la suppression est déjà au journal.
  if not exists (select 1 from public.profils where id = v_compte) then
    return null;
  end if;
  v_nom := coalesce(public.nom_du_profil(v_compte), 'un compte');
  if tg_op = 'UPDATE' then
    -- changer_role (0017) passe d'un rôle de l'équipe à un autre en modifiant la ligne.
    if new.role is not distinct from old.role then
      return null;
    end if;
    perform public.journaliser('comptes', 'role_change', 'compte', v_compte::text, v_nom,
      format('Rôle de %s : %s → %s', v_nom, public.libelle_role(old.role::text), public.libelle_role(new.role::text)),
      jsonb_build_object('ancien', old.role::text, 'nouveau', new.role::text));
  elsif tg_op = 'INSERT' then
    perform public.journaliser('comptes', 'role_ajoute', 'compte', v_compte::text, v_nom,
      format('Rôle « %s » donné à %s', public.libelle_role(v_role), v_nom), jsonb_build_object('role', v_role));
  else
    perform public.journaliser('comptes', 'role_retire', 'compte', v_compte::text, v_nom,
      format('Rôle « %s » retiré à %s', public.libelle_role(v_role), v_nom), jsonb_build_object('role', v_role));
  end if;
  return null;
end;
$$;
drop trigger if exists journal_roles on public.roles;
create trigger journal_roles after insert or update of role or delete on public.roles for each row execute function public.journal_roles();

create or replace function public.journal_suspensions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_compte uuid := coalesce(new.profil_id, old.profil_id);
  v_nom text;
begin
  if not exists (select 1 from public.profils where id = v_compte) then
    return null;
  end if;
  v_nom := coalesce(public.nom_du_profil(v_compte), 'un compte');
  if tg_op = 'INSERT' then
    perform public.journaliser('comptes', 'compte_suspendu', 'compte', v_compte::text, v_nom,
      format('Compte de %s suspendu', v_nom), jsonb_build_object('motif', new.motif));
  else
    perform public.journaliser('comptes', 'compte_reactive', 'compte', v_compte::text, v_nom, format('Compte de %s réactivé', v_nom));
  end if;
  return null;
end;
$$;
drop trigger if exists journal_suspensions on public.suspensions;
create trigger journal_suspensions after insert or delete on public.suspensions
  for each row execute function public.journal_suspensions();

create or replace function public.journal_annonces()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.journaliser('comptes', 'annonce', 'annonce', new.id::text, new.titre,
    format('Annonce « %s » envoyée à tous', new.titre), jsonb_build_object('texte', new.texte, 'lien', new.lien));
  return null;
end;
$$;
drop trigger if exists journal_annonces on public.annonces;
create trigger journal_annonces after insert on public.annonces for each row execute function public.journal_annonces();

-- ─── Paiements ──────────────────────────────────────────────────────────────────────────────────────
create or replace function public.journal_abonnements()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nom text := coalesce(public.nom_du_profil(new.profil_id), 'un compte');
  v_formule text := (select f.nom from public.formules f where f.id = new.formule_id);
  v_paiement record;
begin
  if tg_op = 'INSERT' then
    select p.source, p.moyen_manuel, p.reference_manuelle into v_paiement from public.paiements p where p.id = new.paiement_id;
    if v_paiement.source = 'manuel' then
      perform public.journaliser('paiements', 'abonnement_attribue', 'compte', new.profil_id::text, v_nom,
        format('Abonnement %s attribué à %s jusqu’au %s', v_formule, v_nom, public.date_longue(new.fin)),
        jsonb_build_object('moyen', v_paiement.moyen_manuel, 'reference', v_paiement.reference_manuelle));
    end if;
  elsif old.annule_le is null and new.annule_le is not null then
    perform public.journaliser('paiements', 'abonnement_annule', 'compte', new.profil_id::text, v_nom,
      format('Abonnement %s de %s annulé', v_formule, v_nom), jsonb_build_object('motif', new.motif_annulation));
  end if;
  return null;
end;
$$;
drop trigger if exists journal_abonnements on public.abonnements;
create trigger journal_abonnements after insert or update of annule_le on public.abonnements
  for each row execute function public.journal_abonnements();

create or replace function public.journal_formules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.prix_fcfa is not distinct from old.prix_fcfa then
    return null;
  end if;
  perform public.journaliser('paiements', 'formule_prix', 'formule', new.id::text, new.nom,
    case
      when old.prix_fcfa is null then format('Prix de %s fixé à %s FCFA', new.nom, public.montant_lisible(new.prix_fcfa))
      when new.prix_fcfa is null then format('Prix de %s retiré', new.nom)
      else format('Prix de %s : %s → %s FCFA', new.nom, public.montant_lisible(old.prix_fcfa), public.montant_lisible(new.prix_fcfa))
    end,
    jsonb_build_object('ancien', old.prix_fcfa, 'nouveau', new.prix_fcfa));
  return null;
end;
$$;
drop trigger if exists journal_formules on public.formules;
create trigger journal_formules after update of prix_fcfa on public.formules
  for each row execute function public.journal_formules();

create or replace function public.journal_codes_promo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := coalesce(new.code, old.code);
begin
  perform public.journaliser('paiements', 'code_promo', 'code_promo', coalesce(new.id, old.id)::text, v_code,
    format('Code promo %s %s', v_code, case tg_op when 'INSERT' then 'créé' when 'UPDATE' then 'modifié' else 'supprimé' end),
    case when tg_op = 'DELETE' then '{}'::jsonb
      else jsonb_build_object('type', new.type, 'valeur', new.valeur, 'actif', new.actif, 'limite', new.limite) end);
  return null;
end;
$$;
drop trigger if exists journal_codes_promo on public.codes_promo;
create trigger journal_codes_promo after insert or update or delete on public.codes_promo
  for each row execute function public.journal_codes_promo();

create or replace function public.journal_reglages_paiement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.ouverts is not distinct from old.ouverts then
    return null;
  end if;
  perform public.journaliser('paiements', case when new.ouverts then 'paiements_actives' else 'paiements_desactives' end,
    null, null, null, case when new.ouverts then 'Paiements activés' else 'Paiements désactivés' end);
  return null;
end;
$$;
drop trigger if exists journal_reglages_paiement on public.reglages_paiement;
create trigger journal_reglages_paiement after update of ouverts on public.reglages_paiement
  for each row execute function public.journal_reglages_paiement();

-- ─── Contenus ───────────────────────────────────────────────────────────────────────────────────────
-- Nommé « formations_journal » : il passe avant « formations_version_mise_en_ligne » (ordre alphabétique), le
-- changement de statut s'écrit donc avant la version qu'il crée.
create or replace function public.journal_formations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.journaliser('contenus', 'formation_supprimee', 'formation', old.id::text, old.titre,
      format('Formation « %s » supprimée', old.titre));
  elsif new.statut is distinct from old.statut then
    perform public.journaliser('contenus', 'formation_statut', 'formation', new.id::text, new.titre,
      format('Formation « %s » : %s → %s', new.titre, public.libelle_statut_formation(old.statut::text), public.libelle_statut_formation(new.statut::text)),
      jsonb_build_object('ancien', old.statut::text, 'nouveau', new.statut::text));
  end if;
  return null;
end;
$$;
drop trigger if exists formations_journal on public.formations;
create trigger formations_journal after update of statut or delete on public.formations
  for each row execute function public.journal_formations();

create or replace function public.journal_versions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_titre text := (select f.titre from public.formations f where f.id = new.formation_id);
begin
  perform public.journaliser('contenus', 'version', 'formation', new.formation_id::text, v_titre,
    format('Version %s de « %s » : %s', new.numero, v_titre, new.resume), jsonb_build_object('numero', new.numero));
  return null;
end;
$$;
drop trigger if exists journal_versions on public.versions_formations;
create trigger journal_versions after insert on public.versions_formations
  for each row execute function public.journal_versions();

-- ─── Communauté ─────────────────────────────────────────────────────────────────────────────────────
create or replace function public.journal_avis()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nom text := coalesce(public.nom_du_profil(new.profil_id), 'un compte');
  v_formation text := (select f.titre from public.formations f where f.id = new.formation_id);
begin
  if new.masque is not distinct from old.masque then
    return null;
  end if;
  perform public.journaliser('communaute', case when new.masque then 'avis_masque' else 'avis_affiche' end, 'avis', new.id::text, v_nom,
    format('Avis de %s sur « %s » %s', v_nom, v_formation, case when new.masque then 'masqué' else 'réaffiché' end));
  return null;
end;
$$;
drop trigger if exists journal_avis on public.avis;
create trigger journal_avis after update of masque on public.avis for each row execute function public.journal_avis();

-- Les décisions de l'équipe sur les publications des autres : bloquée, rétablie, supprimée. Une suppression en
-- cascade (compte supprimé) n'écrit rien : la cause est déjà au journal.
create or replace function public.journal_publications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auteur uuid := coalesce(new.auteur, old.auteur);
  v_nom text;
begin
  if v_auteur = (select auth.uid()) or not exists (select 1 from public.profils where id = v_auteur) then
    return null;
  end if;
  v_nom := coalesce(public.nom_du_profil(v_auteur), 'un membre');
  if tg_op = 'DELETE' then
    perform public.journaliser('communaute', 'contenu_supprime', 'publication', old.id::text, v_nom, format('Publication de %s supprimée', v_nom),
      jsonb_build_object('texte', left(old.texte, 200)));
  elsif new.statut is distinct from old.statut and new.statut in ('bloquee', 'publiee') then
    perform public.journaliser('communaute', case when new.statut = 'bloquee' then 'publication_bloquee' else 'publication_retablie' end,
      'publication', new.id::text, v_nom,
      format('Publication de %s %s', v_nom, case when new.statut = 'bloquee' then 'bloquée' else 'rétablie' end));
  end if;
  return null;
end;
$$;
drop trigger if exists journal_publications on public.publications;
create trigger journal_publications after update of statut or delete on public.publications
  for each row execute function public.journal_publications();

create or replace function public.journal_commentaires()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nom text;
begin
  if old.auteur = (select auth.uid()) or not exists (select 1 from public.profils where id = old.auteur) then
    return null;
  end if;
  -- Supprimé avec sa publication ou sa leçon : la cause est déjà au journal (ou n'y a pas sa place).
  if tg_table_name = 'commentaires_publications'
     and not exists (select 1 from public.publications p where p.id = (to_jsonb(old) ->> 'publication_id')::uuid) then
    return null;
  end if;
  if tg_table_name = 'commentaires_lecons'
     and not exists (select 1 from public.lecons l where l.id = (to_jsonb(old) ->> 'lecon_id')::uuid) then
    return null;
  end if;
  v_nom := coalesce(public.nom_du_profil(old.auteur), 'un membre');
  perform public.journaliser('communaute', 'contenu_supprime', 'commentaire', old.id::text, v_nom, format('Commentaire de %s supprimé', v_nom),
    jsonb_build_object('texte', left(to_jsonb(old) ->> 'texte', 200)));
  return null;
end;
$$;
drop trigger if exists journal_commentaires on public.commentaires_publications;
create trigger journal_commentaires after delete on public.commentaires_publications
  for each row execute function public.journal_commentaires();
drop trigger if exists journal_commentaires on public.commentaires_lecons;
create trigger journal_commentaires after delete on public.commentaires_lecons
  for each row execute function public.journal_commentaires();

-- Le commentaire d'un autre corrigé par l'équipe (modifier_commentaire, 0025) : l'ancien texte reste au journal.
create or replace function public.journal_commentaire_modifie()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nom text;
begin
  if new.texte is not distinct from old.texte or new.auteur = (select auth.uid()) then
    return null;
  end if;
  v_nom := coalesce(public.nom_du_profil(new.auteur), 'un membre');
  perform public.journaliser('communaute', 'contenu_modifie', 'commentaire', new.id::text, v_nom, format('Commentaire de %s modifié', v_nom),
    jsonb_build_object('avant', left(old.texte, 200), 'apres', left(new.texte, 200)));
  return null;
end;
$$;
drop trigger if exists journal_commentaire_modifie on public.commentaires_publications;
create trigger journal_commentaire_modifie after update of texte on public.commentaires_publications
  for each row execute function public.journal_commentaire_modifie();

create or replace function public.journal_annonce_communaute()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_avant boolean := tg_op = 'UPDATE' and old.active;
begin
  if new.active and not v_avant then
    perform public.journaliser('communaute', 'annonce_epinglee', 'annonce', null, new.titre, 'Annonce épinglée publiée',
      jsonb_build_object('titre', new.titre));
  elsif new.active and v_avant and (to_jsonb(new) - 'modifiee_le') is distinct from (to_jsonb(old) - 'modifiee_le') then
    perform public.journaliser('communaute', 'annonce_epinglee', 'annonce', null, new.titre, 'Annonce épinglée modifiée',
      jsonb_build_object('titre', new.titre));
  elsif not new.active and v_avant then
    perform public.journaliser('communaute', 'annonce_epinglee', 'annonce', null, old.titre, 'Annonce épinglée retirée');
  end if;
  return null;
end;
$$;
drop trigger if exists journal_annonce_communaute on public.annonce_communaute;
create trigger journal_annonce_communaute after insert or update on public.annonce_communaute
  for each row execute function public.journal_annonce_communaute();

create or replace function public.journal_reglages_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.analyse_active is not distinct from old.analyse_active then
    return null;
  end if;
  perform public.journaliser('communaute', 'reglage_moderation', null, null, null,
    case when new.analyse_active then 'Analyse automatique activée' else 'Analyse automatique désactivée' end);
  return null;
end;
$$;
drop trigger if exists journal_reglages_moderation on public.reglages_moderation;
create trigger journal_reglages_moderation after update of analyse_active on public.reglages_moderation
  for each row execute function public.journal_reglages_moderation();

-- ─── Lire le journal (le super admin) ───────────────────────────────────────────────────────────────
create or replace function public.lire_journal(
  p_categorie text, p_auteur uuid, p_jours integer, p_avant bigint, p_nombre integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_nombre integer := least(greatest(coalesce(p_nombre, 50), 1), 100);
  v_lignes jsonb;
begin
  if not public.a_domaine('journal') then
    raise exception 'Réservé au super admin.' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(to_jsonb(l) - 'rang' order by l.id desc), '[]'::jsonb) into v_lignes
  from (
    select j.id, j.cree_le, j.auteur, j.auteur_nom, j.categorie, j.action, j.cible_type, j.cible_id, j.cible_libelle, j.resume, j.details
    from public.journal_actions j
    where (p_categorie is null or j.categorie = p_categorie)
      and (p_auteur is null or j.auteur = p_auteur)
      and (p_jours is null or j.cree_le >= now() - make_interval(days => p_jours))
      and (p_avant is null or j.id < p_avant)
    order by j.id desc
    limit v_nombre + 1
  ) l;
  return jsonb_build_object(
    'lignes', (select coalesce(jsonb_agg(e order by (e ->> 'id')::bigint desc), '[]'::jsonb)
               from (select e from jsonb_array_elements(v_lignes) e order by (e ->> 'id')::bigint desc limit v_nombre) x),
    'suite', jsonb_array_length(v_lignes) > v_nombre
  );
end;
$$;

-- Les membres de l'équipe qui ont au moins une ligne (le filtre « Auteur »), avec leur dernier nom.
create or replace function public.auteurs_journal()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.a_domaine('journal') then
    raise exception 'Réservé au super admin.' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object('id', a.auteur, 'nom', a.nom) order by a.nom), '[]'::jsonb)
    from (
      select distinct on (j.auteur) j.auteur, coalesce(public.nom_du_profil(j.auteur), j.auteur_nom) as nom
      from public.journal_actions j
      where j.auteur is not null
      order by j.auteur, j.id desc
    ) a
  );
end;
$$;

-- ─── Renommer un compte (domaine « utilisateurs » ; un membre de l'équipe : le super admin seul) ────
create or replace function public.renommer_compte(p_compte uuid, p_prenom text, p_nom text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prenom text := btrim(coalesce(p_prenom, ''));
  v_nom text := btrim(coalesce(p_nom, ''));
  v_ancien text;
begin
  if not public.a_domaine('utilisateurs') then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profils where id = p_compte) then
    raise exception 'Compte introuvable.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.roles where profil_id = p_compte and role in ('moderateur', 'admin', 'super_admin'))
     and not public.a_domaine('roles') then
    raise exception 'Seul le super admin renomme un membre de l’équipe.' using errcode = 'P0001';
  end if;
  if char_length(v_prenom) not between 1 and 60 or char_length(v_nom) not between 1 and 60 then
    raise exception 'Écrivez le prénom et le nom (60 caractères au plus).' using errcode = 'P0001';
  end if;
  v_ancien := coalesce(public.nom_du_profil(p_compte), 'un compte');
  update public.profils set prenom = v_prenom, nom = v_nom where id = p_compte;
  perform public.journaliser('comptes', 'compte_renomme', 'compte', p_compte::text, v_prenom || ' ' || v_nom,
    format('Compte de %s renommé en %s', v_ancien, v_prenom || ' ' || v_nom));
end;
$$;

-- ─── Les fichiers d'un compte, à retirer avant sa suppression (le super admin) ──────────────────────
-- Photos de profil, travaux rendus, pièces jointes de ses conversations (comme « Supprimer mon compte »). L'API de
-- stockage n'efface que ce que l'appelant peut lire : la liste est notée dans suppressions_en_cours, et deux règles de
-- stockage ouvrent au super admin ces fichiers-là seulement, le temps de la suppression (rien d'autre : ni les autres
-- photos, ni les conversations des autres).
create table if not exists public.suppressions_en_cours (
  profil_id uuid primary key references public.profils (id) on delete cascade,
  par uuid not null references public.profils (id) on delete cascade,
  -- « espace/chemin » de chaque fichier.
  fichiers text[] not null default '{}',
  cree_le timestamptz not null default now()
);
alter table public.suppressions_en_cours enable row level security;
revoke all on public.suppressions_en_cours from public, anon, authenticated;

-- Les refus de la suppression, partagés par la liste des fichiers et la suppression elle-même.
create or replace function public.exiger_suppression_possible(p_compte uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.a_domaine('roles') then
    raise exception 'Réservé au super admin.' using errcode = '42501';
  end if;
  if p_compte = (select auth.uid()) then
    raise exception 'Vous ne pouvez pas supprimer votre propre compte d’ici : passez par votre profil.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.roles where profil_id = p_compte and role = 'super_admin') then
    raise exception 'Un compte super admin ne se supprime pas.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profils where id = p_compte) then
    raise exception 'Compte introuvable.' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.fichiers_du_compte(p_compte uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_photos text[];
  v_rendus text[];
  v_messages text[];
begin
  perform public.exiger_suppression_possible(p_compte);
  select coalesce(array_agg(o.name order by o.name), '{}') into v_photos from storage.objects o
  where o.bucket_id = 'photos-profil' and o.name like p_compte::text || '/%';
  select coalesce(array_agg(r.fichier order by r.fichier), '{}') into v_rendus from public.rendus_exercices r
  where r.profil_id = p_compte and r.fichier is not null
    and exists (select 1 from storage.objects o where o.bucket_id = 'rendus' and o.name = r.fichier);
  select coalesce(array_agg(m.fichier order by m.fichier), '{}') into v_messages
  from public.messages m join public.conversations c on c.id = m.conversation_id
  where m.fichier is not null
    and (c.etudiant_id = p_compte or c.formateur_id = p_compte or (storage.foldername(m.fichier))[1] = p_compte::text)
    and exists (select 1 from storage.objects o where o.bucket_id = 'messages' and o.name = m.fichier);
  insert into public.suppressions_en_cours (profil_id, par, fichiers)
  values (
    p_compte, (select auth.uid()),
    array(select 'photos-profil/' || x from unnest(v_photos) x)
      || array(select 'rendus/' || x from unnest(v_rendus) x)
      || array(select 'messages/' || x from unnest(v_messages) x)
  )
  on conflict (profil_id) do update set par = excluded.par, fichiers = excluded.fichiers, cree_le = now();
  return jsonb_build_object('photos', to_jsonb(v_photos), 'rendus', to_jsonb(v_rendus), 'messages', to_jsonb(v_messages));
end;
$$;

-- Ce fichier est-il listé pour une suppression préparée par le super admin connecté ?
create or replace function public.fichier_a_supprimer(p_espace text, p_nom text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.a_domaine('roles') and exists (
    select 1 from public.suppressions_en_cours s
    where s.par = (select auth.uid()) and (p_espace || '/' || p_nom) = any (s.fichiers)
  );
$$;

drop policy if exists "super admin : supprimer les fichiers d'un compte" on storage.objects;
drop policy if exists "super admin : lire les fichiers d'un compte supprimé" on storage.objects;
create policy "super admin : lire les fichiers d'un compte supprimé" on storage.objects
  for select to authenticated
  using (bucket_id in ('photos-profil', 'rendus', 'messages') and (select public.fichier_a_supprimer(bucket_id, name)));
drop policy if exists "super admin : effacer les fichiers d'un compte supprimé" on storage.objects;
create policy "super admin : effacer les fichiers d'un compte supprimé" on storage.objects
  for delete to authenticated
  using (bucket_id in ('photos-profil', 'rendus', 'messages') and (select public.fichier_a_supprimer(bucket_id, name)));

-- ─── Supprimer un compte (le super admin ; jamais soi-même ni un autre super admin) ─────────────────
-- Le compte part avec tout ce que la base efface en cascade ; les paiements restent sans propriétaire et les
-- certificats délivrés restent vérifiables. La ligne du journal est écrite avant, avec le nom et l'adresse figés.
create or replace function public.supprimer_compte(p_compte uuid, p_motif text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motif text := btrim(coalesce(p_motif, ''));
  v_nom text;
  v_email text;
begin
  perform public.exiger_suppression_possible(p_compte);
  if char_length(v_motif) = 0 then
    raise exception 'Indiquez le motif de la suppression.' using errcode = 'P0001';
  end if;
  select u.email into v_email from auth.users u where u.id = p_compte;
  if not found then
    raise exception 'Compte introuvable.' using errcode = 'P0001';
  end if;
  v_nom := coalesce(public.nom_du_profil(p_compte), 'un compte');
  perform public.journaliser('comptes', 'compte_supprime', 'compte', p_compte::text, v_nom,
    format('Compte de %s (%s) supprimé', v_nom, v_email), jsonb_build_object('motif', left(v_motif, 500), 'email', v_email));
  delete from auth.users where id = p_compte;
end;
$$;

-- ─── Droits ─────────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public.journaliser(text, text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.libelle_role(text) from public, anon;
revoke execute on function public.libelle_statut_formation(text) from public, anon;
revoke execute on function public.montant_lisible(integer) from public, anon;
revoke execute on function public.journal_roles() from public, anon, authenticated;
revoke execute on function public.journal_suspensions() from public, anon, authenticated;
revoke execute on function public.journal_annonces() from public, anon, authenticated;
revoke execute on function public.journal_abonnements() from public, anon, authenticated;
revoke execute on function public.journal_formules() from public, anon, authenticated;
revoke execute on function public.journal_codes_promo() from public, anon, authenticated;
revoke execute on function public.journal_reglages_paiement() from public, anon, authenticated;
revoke execute on function public.journal_formations() from public, anon, authenticated;
revoke execute on function public.journal_versions() from public, anon, authenticated;
revoke execute on function public.journal_avis() from public, anon, authenticated;
revoke execute on function public.journal_publications() from public, anon, authenticated;
revoke execute on function public.journal_commentaires() from public, anon, authenticated;
revoke execute on function public.journal_annonce_communaute() from public, anon, authenticated;
revoke execute on function public.journal_commentaire_modifie() from public, anon, authenticated;
revoke execute on function public.journal_reglages_moderation() from public, anon, authenticated;
revoke execute on function public.lire_journal(text, uuid, integer, bigint, integer) from public, anon;
revoke execute on function public.auteurs_journal() from public, anon;
grant execute on function public.libelle_role(text) to authenticated;
grant execute on function public.libelle_statut_formation(text) to authenticated;
grant execute on function public.montant_lisible(integer) to authenticated;
grant execute on function public.lire_journal(text, uuid, integer, bigint, integer) to authenticated;
grant execute on function public.auteurs_journal() to authenticated;
revoke execute on function public.renommer_compte(uuid, text, text) from public, anon;
revoke execute on function public.fichiers_du_compte(uuid) from public, anon;
revoke execute on function public.exiger_suppression_possible(uuid) from public, anon, authenticated;
revoke execute on function public.fichier_a_supprimer(text, text) from public, anon;
grant execute on function public.fichier_a_supprimer(text, text) to authenticated;
revoke execute on function public.supprimer_compte(uuid, text) from public, anon;
grant execute on function public.renommer_compte(uuid, text, text) to authenticated;
grant execute on function public.fichiers_du_compte(uuid) to authenticated;
grant execute on function public.supprimer_compte(uuid, text) to authenticated;

commit;

-- ═══ 0062_statistiques_pilotage.sql ═══
-- Migration 0062 : la vue d'ensemble du back-office (design NdAdmin) et les statistiques par période (lot 6, partie A ;
-- spec du 2 novembre 2026, §4). Domaine « statistiques » : admins et super admin. Calculées à la demande, aux heures et
-- aux mois du Bénin. Une plateforme vide donne des zéros (ou rien), jamais une division par zéro.
-- Rejouable.

begin;

create or replace function public.exiger_statistiques()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  if not public.a_domaine('statistiques') then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;
end;
$$;

-- Un étudiant : un compte sans autre rôle (ni l'équipe, ni un formateur). Dans les requêtes ci-dessous, la condition est
-- écrite en ligne : la base l'optimise (une fonction security definer ne se déplie pas).
create or replace function public.compte_etudiant(p_profil uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.roles r where r.profil_id = p_profil and r.role <> 'etudiant');
$$;

-- La formule de l'abonnement en cours d'un compte à un instant, ou null.
create or replace function public.formule_a(p_profil uuid, p_instant timestamptz)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select f.nom from public.abonnements a join public.formules f on f.id = a.formule_id
  where a.profil_id = p_profil and a.annule_le is null and a.debut <= p_instant and a.fin > p_instant
  order by a.debut desc limit 1;
$$;

-- Le nombre de comptes abonnés à un instant.
create or replace function public.abonnes_a(p_instant timestamptz)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct a.profil_id)::integer from public.abonnements a
  where a.annule_le is null and a.debut <= p_instant and a.fin > p_instant;
$$;

-- ─── La vue d'ensemble (NdAdmin) ────────────────────────────────────────────────────────────────────
create or replace function public.vue_ensemble_back_office(p_maintenant timestamptz default now())
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz constant text := 'Africa/Porto-Novo';
  v_mois timestamptz := date_trunc('month', p_maintenant at time zone v_tz) at time zone v_tz;
  v_actifs integer := public.abonnes_a(p_maintenant);
  v_commencees integer;
  v_terminees integer;
begin
  perform public.exiger_statistiques();

  select count(*)::integer, count(c.id)::integer into v_commencees, v_terminees
  from (
    select distinct p.profil_id, m.formation_id
    from public.progression_lecons p
    join public.lecons l on l.id = p.lecon_id
    join public.modules m on m.id = l.module_id
  ) s
  left join public.certificats c on c.profil_id = s.profil_id and c.formation_id = s.formation_id;

  return jsonb_build_object(
    'utilisateurs', jsonb_build_object(
      'total', (select count(*)::integer from public.profils),
      'ce_mois', (select count(*)::integer from public.profils where cree_le >= v_mois and cree_le <= p_maintenant)
    ),
    'abonnes', jsonb_build_object('actifs', v_actifs, 'mois_precedent', public.abonnes_a(p_maintenant - interval '1 month')),
    'revenus_mois', (select coalesce(sum(montant), 0)::integer from public.paiements
                     where statut = 'reussi' and confirme_le >= v_mois and confirme_le <= p_maintenant),
    'formations', jsonb_build_object(
      'total', (select count(*)::integer from public.formations),
      'brouillons', (select count(*)::integer from public.formations where statut = 'brouillon')
    ),
    'certificats', (select count(*)::integer from public.certificats),
    'taux_completion', case when v_commencees > 0 then round(100.0 * v_terminees / v_commencees)::integer end,
    -- Les abonnements souscrits chaque mois (6 mois) : un renouvellement si le compte en avait déjà un.
    'abonnements_par_mois', (
      select jsonb_agg(jsonb_build_object(
        'mois', to_char(m.debut, 'YYYY-MM'),
        'nouveaux', (select count(*)::integer from public.abonnements a
                     where a.cree_le >= m.debut at time zone v_tz and a.cree_le < (m.debut + interval '1 month') at time zone v_tz
                       and not exists (select 1 from public.abonnements b where b.profil_id = a.profil_id and b.cree_le < a.cree_le)),
        'renouvellements', (select count(*)::integer from public.abonnements a
                     where a.cree_le >= m.debut at time zone v_tz and a.cree_le < (m.debut + interval '1 month') at time zone v_tz
                       and exists (select 1 from public.abonnements b where b.profil_id = a.profil_id and b.cree_le < a.cree_le))
      ) order by m.debut)
      from generate_series(date_trunc('month', p_maintenant at time zone v_tz) - interval '5 months',
                           date_trunc('month', p_maintenant at time zone v_tz), interval '1 month') as m(debut)
    ),
    -- La part de chaque formule parmi les abonnements en cours.
    'formules', (
      select coalesce(jsonb_agg(jsonb_build_object('code', f.code, 'nom', f.nom,
        'part', case when v_actifs > 0 then round(100.0 * (
          select count(distinct a.profil_id) from public.abonnements a
          where a.formule_id = f.id and a.annule_le is null and a.debut <= p_maintenant and a.fin > p_maintenant
        ) / v_actifs)::integer else 0 end) order by f.ordre, f.code), '[]'::jsonb)
      from public.formules f
    ),
    'a_traiter', jsonb_build_object(
      'a_examiner', coalesce(public.nombre_a_examiner(), 0),
      'paiements_echoues', (
        select coalesce(jsonb_agg(x.e order by x.d desc), '[]'::jsonb) from (
          select jsonb_build_object('id', p.id, 'nom', coalesce(public.nom_du_profil(p.profil_id), 'Compte supprimé'), 'formule', f.nom,
                   'operateur', p.operateur, 'moyen_manuel', p.moyen_manuel, 'date', coalesce(p.essai_le, p.cree_le)) as e,
                 coalesce(p.essai_le, p.cree_le) as d
          from public.paiements p join public.formules f on f.id = p.formule_id
          where p.statut = 'echoue' and coalesce(p.essai_le, p.cree_le) between p_maintenant - interval '48 hours' and p_maintenant
          order by d desc limit 5
        ) x
      ),
      'paiements_en_attente', (
        select coalesce(jsonb_agg(x.e order by x.d desc), '[]'::jsonb) from (
          select jsonb_build_object('id', p.id, 'nom', coalesce(public.nom_du_profil(p.profil_id), 'Compte supprimé'), 'formule', f.nom,
                   'operateur', p.operateur, 'moyen_manuel', p.moyen_manuel, 'date', p.essai_le) as e, p.essai_le as d
          from public.paiements p join public.formules f on f.id = p.formule_id
          where p.statut = 'en_attente' and p.essai_le between p_maintenant - interval '24 hours' and p_maintenant - interval '15 minutes'
          order by d desc limit 5
        ) x
      ),
      -- Les abonnements qui finissent dans 7 jours, sans abonnement à la suite.
      'fins_proches', (
        select coalesce(jsonb_agg(x.e order by x.fin), '[]'::jsonb) from (
          select jsonb_build_object('profil_id', a.profil_id, 'nom', public.nom_du_profil(a.profil_id), 'formule', f.nom, 'fin', a.fin,
                   'jours', ceil(extract(epoch from a.fin - p_maintenant) / 86400)::integer) as e, a.fin
          from public.abonnements a join public.formules f on f.id = a.formule_id
          where a.annule_le is null and a.debut <= p_maintenant and a.fin > p_maintenant and a.fin <= p_maintenant + interval '7 days'
            and not exists (select 1 from public.abonnements b where b.profil_id = a.profil_id and b.id <> a.id and b.annule_le is null and b.debut >= a.debut and b.fin > a.fin)
          order by a.fin limit 5
        ) x
      )
    ),
    'dernieres_inscriptions', (
      select coalesce(jsonb_agg(x.e order by x.cree_le desc), '[]'::jsonb) from (
        select jsonb_build_object('id', p.id, 'nom', public.nom_du_profil(p.id), 'cree_le', p.cree_le,
                 'formule', public.formule_a(p.id, p_maintenant)) as e, p.cree_le
        from public.profils p
        where not exists (select 1 from public.roles r where r.profil_id = p.id and r.role <> 'etudiant') and p.cree_le <= p_maintenant
        order by p.cree_le desc limit 4
      ) x
    ),
    -- Les paiements jamais envoyés à Payiz n'y sont pas (comme la liste des paiements, 0051).
    'derniers_paiements', (
      select coalesce(jsonb_agg(x.e order by x.d desc), '[]'::jsonb) from (
        select jsonb_build_object('id', p.id, 'nom', coalesce(public.nom_du_profil(p.profil_id), 'Compte supprimé'), 'formule', f.nom, 'duree_mois', f.duree_mois,
                 'operateur', p.operateur, 'moyen_manuel', p.moyen_manuel, 'montant', p.montant, 'statut', p.statut,
                 'date', coalesce(p.confirme_le, p.essai_le, p.cree_le)) as e,
               coalesce(p.confirme_le, p.essai_le, p.cree_le) as d
        from public.paiements p join public.formules f on f.id = p.formule_id
        where (p.source = 'manuel' or p.essai_le is not null) and coalesce(p.confirme_le, p.essai_le, p.cree_le) <= p_maintenant
        order by d desc limit 5
      ) x
    )
  );
end;
$$;

-- ─── Les statistiques sur une période (30, 90 ou 365 jours) ─────────────────────────────────────────
create or replace function public.statistiques_periode(p_jours integer, p_maintenant timestamptz default now())
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz constant text := 'Africa/Porto-Novo';
  v_debut timestamptz := p_maintenant - make_interval(days => p_jours);
  v_unite text := case when p_jours = 365 then 'month' else 'week' end;
  v_pas interval := case when p_jours = 365 then interval '1 month' else interval '1 week' end;
  v_inscrits integer;
  v_convertis integer;
begin
  perform public.exiger_statistiques();
  if p_jours is null or p_jours not in (30, 90, 365) then
    raise exception 'Période inconnue.' using errcode = '22023';
  end if;

  select count(*)::integer, count(*) filter (where exists (select 1 from public.abonnements a where a.profil_id = p.id))::integer
  into v_inscrits, v_convertis
  from public.profils p
  where not exists (select 1 from public.roles r where r.profil_id = p.id and r.role <> 'etudiant') and p.cree_le >= v_debut and p.cree_le <= p_maintenant;

  return jsonb_build_object(
    'etudiants', jsonb_build_object(
      'inscrits', v_inscrits,
      'courbe', (
        select jsonb_agg(jsonb_build_object('debut', to_char(b.debut, 'YYYY-MM-DD'),
          'nombre', (select count(*)::integer from public.profils p
                     where not exists (select 1 from public.roles r where r.profil_id = p.id and r.role <> 'etudiant') and p.cree_le >= greatest(b.debut at time zone v_tz, v_debut)
                       and p.cree_le < least((b.debut + v_pas) at time zone v_tz, p_maintenant + interval '1 microsecond'))
        ) order by b.debut)
        from generate_series(date_trunc(v_unite, v_debut at time zone v_tz), date_trunc(v_unite, p_maintenant at time zone v_tz), v_pas) as b(debut)
      ),
      'actifs', (select count(distinct profil_id)::integer from public.progression_lecons where vue_le between v_debut and p_maintenant),
      'lecons_terminees', (select count(*)::integer from public.progression_lecons where terminee_le between v_debut and p_maintenant),
      'formations_terminees', (select count(*)::integer from public.certificats
                               where delivre_le between (v_debut at time zone v_tz)::date and (p_maintenant at time zone v_tz)::date),
      'quiz', (
        select jsonb_build_object('passes', count(*)::integer, 'reussis', count(*) filter (where t.score >= f.score_quiz)::integer)
        from public.tentatives_quiz t
        join public.lecons l on l.id = t.lecon_id
        join public.modules m on m.id = l.module_id
        join public.formations f on f.id = m.formation_id
        where t.cree_le between v_debut and p_maintenant
      ),
      'exercices_valides', (select count(*)::integer from public.rendus_exercices
                            where statut = 'valide' and corrige_le between v_debut and p_maintenant),
      'secondes_video', (select coalesce(sum(public.secondes_couvertes(passages)), 0)::integer from public.progression_lecons
                         where vue_le between v_debut and p_maintenant)
    ),
    'formations', (
      select coalesce(jsonb_agg(x.e order by x.titre), '[]'::jsonb) from (
        select f.titre, jsonb_build_object(
          'id', f.id, 'titre', f.titre, 'statut', f.statut::text,
          'suiveurs', s.suiveurs,
          'nouveaux', (select count(*)::integer from (
              select p.profil_id, min(coalesce(p.ouverte_le, p.vue_le)) as premiere
              from public.progression_lecons p join public.lecons l on l.id = p.lecon_id join public.modules m on m.id = l.module_id
              where m.formation_id = f.id group by p.profil_id
            ) n where n.premiere between v_debut and p_maintenant),
          'progression', case when s.suiveurs > 0 and s.publiees > 0 then round(100.0 * s.terminees / (s.suiveurs * s.publiees))::integer else 0 end,
          -- Les étudiants qui la suivent et ont leur certificat (jamais plus de 100 %, même avec des comptes supprimés).
          'achevement', case when s.suiveurs > 0 then round(100.0 * (
            select count(*) from public.certificats c
            where c.formation_id = f.id and exists (
              select 1 from public.progression_lecons p join public.lecons l on l.id = p.lecon_id join public.modules m on m.id = l.module_id
              where m.formation_id = f.id and p.profil_id = c.profil_id)
          ) / s.suiveurs)::integer else 0 end,
          'secondes_video', (select coalesce(sum(public.secondes_couvertes(p.passages)), 0)::integer
                             from public.progression_lecons p join public.lecons l on l.id = p.lecon_id join public.modules m on m.id = l.module_id
                             where m.formation_id = f.id and p.vue_le between v_debut and p_maintenant),
          'note', (select round(avg(a.note), 1) from public.avis a where a.formation_id = f.id and not a.masque),
          'avis', (select count(*)::integer from public.avis a where a.formation_id = f.id and not a.masque),
          'certificats', (select count(*)::integer from public.certificats c where c.formation_id = f.id
                          and c.delivre_le between (v_debut at time zone v_tz)::date and (p_maintenant at time zone v_tz)::date)
        ) as e
        from public.formations f
        cross join lateral (
          select
            (select count(distinct p.profil_id)::integer from public.progression_lecons p join public.lecons l on l.id = p.lecon_id
             join public.modules m on m.id = l.module_id where m.formation_id = f.id) as suiveurs,
            (select count(*)::integer from public.lecons l join public.modules m on m.id = l.module_id
             where m.formation_id = f.id and l.publiee) as publiees,
            (select count(*)::integer from public.progression_lecons p join public.lecons l on l.id = p.lecon_id
             join public.modules m on m.id = l.module_id where m.formation_id = f.id and l.publiee and p.terminee_le is not null) as terminees
        ) s
        where f.statut::text in ('publiee', 'desactivee')
      ) x
    ),
    'business', jsonb_build_object(
      'abonnes_actifs', public.abonnes_a(p_maintenant),
      'nouveaux', (select count(*)::integer from public.abonnements a where a.cree_le between v_debut and p_maintenant
                   and not exists (select 1 from public.abonnements b where b.profil_id = a.profil_id and b.cree_le < a.cree_le)),
      'renouvellements', (select count(*)::integer from public.abonnements a where a.cree_le between v_debut and p_maintenant
                   and exists (select 1 from public.abonnements b where b.profil_id = a.profil_id and b.cree_le < a.cree_le)),
      'revenus', (select coalesce(sum(montant), 0)::integer from public.paiements
                  where statut = 'reussi' and confirme_le between v_debut and p_maintenant),
      'courbe', (
        select jsonb_agg(jsonb_build_object('debut', to_char(b.debut, 'YYYY-MM-DD'),
          'montant', (select coalesce(sum(p.montant), 0)::integer from public.paiements p
                      where p.statut = 'reussi' and p.confirme_le >= greatest(b.debut at time zone v_tz, v_debut)
                        and p.confirme_le < least((b.debut + v_pas) at time zone v_tz, p_maintenant + interval '1 microsecond'))
        ) order by b.debut)
        from generate_series(date_trunc(v_unite, v_debut at time zone v_tz), date_trunc(v_unite, p_maintenant at time zone v_tz), v_pas) as b(debut)
      ),
      'conversion', case when v_inscrits > 0 then round(100.0 * v_convertis / v_inscrits)::integer end,
      'formules', (
        select coalesce(jsonb_agg(jsonb_build_object('code', f.code, 'nom', f.nom,
          'nombre', (select count(*)::integer from public.abonnements a where a.formule_id = f.id and a.cree_le between v_debut and p_maintenant)
        ) order by f.ordre, f.code), '[]'::jsonb)
        from public.formules f
      ),
      'codes_promo', (
        select jsonb_build_object('utilisations', count(*)::integer, 'remise', coalesce(sum(p.remise), 0)::integer)
        from public.paiements p
        where p.statut = 'reussi' and p.code_promo_id is not null and p.confirme_le between v_debut and p_maintenant
      )
    )
  );
end;
$$;

revoke execute on function public.exiger_statistiques() from public, anon, authenticated;
revoke execute on function public.compte_etudiant(uuid) from public, anon, authenticated;
revoke execute on function public.formule_a(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.abonnes_a(timestamptz) from public, anon, authenticated;
revoke execute on function public.vue_ensemble_back_office(timestamptz) from public, anon;
revoke execute on function public.statistiques_periode(integer, timestamptz) from public, anon;
grant execute on function public.vue_ensemble_back_office(timestamptz) to authenticated;
grant execute on function public.statistiques_periode(integer, timestamptz) to authenticated;

commit;

-- ═══ 0063_engagement.sql ═══
-- Migration 0063 : l'engagement de l'étudiant (lot 6, partie B ; spec du 2 novembre 2026, validée le jour même).
--   - Chaque jour d'apprentissage (heure du Bénin) est noté au moment de l'activité : leçon ouverte ou regardée, leçon
--     terminée, quiz passé, exercice rendu.
--   - Les points : leçon terminée +10, quiz réussi +20, exercice validé +30, certificat +100, jour d'apprentissage +5.
--     Une seule ligne par raison et par référence : rien ne compte deux fois, rien ne se perd. Pas de classement.
--   - Les 8 badges, donnés avec les points ; un niveau tous les 200 points.
--   - L'objectif de la semaine : 3, 5 ou 7 jours.
-- Le passé ne se reconstruit pas, sauf les certificats déjà obtenus, qui donnent leurs points et leurs badges.
-- Rejouable.

begin;

-- ─── Le jour au Bénin (UTC+1 toute l'année) ─────────────────────────────────────────────────────────
create or replace function public.jour_benin(p_moment timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  select (p_moment at time zone 'Africa/Porto-Novo')::date;
$$;

-- ─── Les tables (écrites seulement par la base ; chacun lit les siennes) ────────────────────────────
create table if not exists public.activite_jours (
  profil_id uuid not null references public.profils (id) on delete cascade,
  jour date not null,
  activites integer not null default 0,
  secondes_video integer not null default 0,
  primary key (profil_id, jour)
);
-- Le rappel de 18 h cherche les comptes actifs hier.
create index if not exists activite_jours_jour on public.activite_jours (jour);

create table if not exists public.points_gagnes (
  id bigint generated always as identity primary key,
  profil_id uuid not null references public.profils (id) on delete cascade,
  raison text not null,
  reference text not null,
  points integer not null,
  gagne_le timestamptz not null default now(),
  constraint points_gagnes_raison check (raison in ('lecon', 'quiz', 'exercice', 'certificat', 'jour')),
  constraint points_gagnes_positifs check (points > 0),
  constraint points_gagnes_une_fois unique (profil_id, raison, reference)
);
create index if not exists points_gagnes_profil_date on public.points_gagnes (profil_id, gagne_le desc);

create table if not exists public.badges_obtenus (
  profil_id uuid not null references public.profils (id) on delete cascade,
  badge text not null,
  obtenu_le timestamptz not null default now(),
  primary key (profil_id, badge),
  constraint badges_obtenus_code check (badge in (
    'premier_pas', 'serie_3', 'serie_7', 'serie_30', 'premier_quiz', 'premier_exercice', 'premier_certificat', 'trois_certificats'
  ))
);

alter table public.activite_jours enable row level security;
alter table public.points_gagnes enable row level security;
alter table public.badges_obtenus enable row level security;
revoke all on public.activite_jours, public.points_gagnes, public.badges_obtenus from anon, authenticated;
grant select on public.activite_jours, public.points_gagnes, public.badges_obtenus to authenticated;
drop policy if exists "activite_jours : chacun les siennes" on public.activite_jours;
create policy "activite_jours : chacun les siennes" on public.activite_jours
  for select to authenticated using (profil_id = (select auth.uid()));
drop policy if exists "points_gagnes : chacun les siens" on public.points_gagnes;
create policy "points_gagnes : chacun les siens" on public.points_gagnes
  for select to authenticated using (profil_id = (select auth.uid()));
drop policy if exists "badges_obtenus : chacun les siens" on public.badges_obtenus;
create policy "badges_obtenus : chacun les siens" on public.badges_obtenus
  for select to authenticated using (profil_id = (select auth.uid()));

-- ─── L'objectif de la semaine (préférence du profil, choisie par une fonction) ──────────────────────
alter table public.profils add column if not exists objectif_jours smallint not null default 5;
alter table public.profils drop constraint if exists profils_objectif_jours;
alter table public.profils add constraint profils_objectif_jours check (objectif_jours in (3, 5, 7));

create or replace function public.choisir_objectif(p_jours integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
begin
  if v_moi is null or public.compte_suspendu() then
    raise exception 'Connectez-vous pour choisir votre objectif.' using errcode = '42501';
  end if;
  if p_jours is null or p_jours not in (3, 5, 7) then
    raise exception 'Choisissez 3, 5 ou 7 jours.' using errcode = '22023';
  end if;
  update public.profils set objectif_jours = p_jours where id = v_moi;
end;
$$;

-- ─── La série : les jours d'affilée qui finissent aujourd'hui (déjà actif) ou hier ──────────────────
create or replace function public.serie_de(p_profil uuid, p_jour date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with depart as (
    select case
      when exists (select 1 from public.activite_jours a where a.profil_id = p_profil and a.jour = p_jour) then p_jour
      when exists (select 1 from public.activite_jours a where a.profil_id = p_profil and a.jour = p_jour - 1) then p_jour - 1
    end as d
  ),
  jours as (
    -- D'affilée tant que l'écart au départ égale le rang (du plus récent au plus ancien).
    select (dp.d - a.jour) as ecart, (row_number() over (order by a.jour desc) - 1)::integer as rang
    from public.activite_jours a, depart dp
    where a.profil_id = p_profil and a.jour <= dp.d
  )
  select count(*)::integer from jours where ecart = rang;
$$;

-- ─── Les points, puis les badges de cette raison ────────────────────────────────────────────────────
create or replace function public.gagner_points(p_profil uuid, p_raison text, p_reference text, p_points integer, p_quand timestamptz default now())
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_badges text[];
  v_serie integer;
begin
  if p_profil is null then
    return false;
  end if;
  insert into public.points_gagnes (profil_id, raison, reference, points, gagne_le)
  values (p_profil, p_raison, p_reference, p_points, p_quand)
  on conflict (profil_id, raison, reference) do nothing;
  if not found then
    return false;
  end if;

  if p_raison = 'lecon' then
    v_badges := array['premier_pas'];
  elsif p_raison = 'quiz' then
    v_badges := array['premier_quiz'];
  elsif p_raison = 'exercice' then
    v_badges := array['premier_exercice'];
  elsif p_raison = 'certificat' then
    v_badges := array['premier_certificat'];
    if (select count(*) from public.points_gagnes g where g.profil_id = p_profil and g.raison = 'certificat') >= 3 then
      v_badges := v_badges || 'trois_certificats'::text;
    end if;
  elsif p_raison = 'jour' then
    v_serie := public.serie_de(p_profil, p_reference::date);
    select coalesce(array_agg(s.badge), '{}') into v_badges
    from (values (3, 'serie_3'), (7, 'serie_7'), (30, 'serie_30')) as s (jours, badge)
    where v_serie >= s.jours;
  end if;

  insert into public.badges_obtenus (profil_id, badge, obtenu_le)
  select p_profil, b, p_quand from unnest(coalesce(v_badges, '{}')) as b
  on conflict (profil_id, badge) do nothing;
  return true;
end;
$$;

-- ─── Le jour d'apprentissage : la première activité du jour vaut 5 points ───────────────────────────
create or replace function public.noter_activite(p_profil uuid, p_secondes integer, p_jour date default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jour date := coalesce(p_jour, public.jour_benin(now()));
  v_secondes integer := greatest(coalesce(p_secondes, 0), 0);
begin
  if p_profil is null then
    return;
  end if;
  insert into public.activite_jours (profil_id, jour, activites, secondes_video)
  values (p_profil, v_jour, 1, v_secondes)
  on conflict (profil_id, jour) do nothing;
  if found then
    perform public.gagner_points(p_profil, 'jour', v_jour::text, 5);
  else
    update public.activite_jours
    set activites = activites + 1, secondes_video = secondes_video + v_secondes
    where profil_id = p_profil and jour = v_jour;
  end if;
end;
$$;

-- ─── Les déclencheurs, sur les tables de l'étudiant ─────────────────────────────────────────────────
-- Nommés « …_activite » pour passer avant ceux du certificat (0033, ordre alphabétique) : partout, le jour d'activité
-- est verrouillé avant les badges, jamais l'inverse. Seule l'action du compte lui-même est un jour d'apprentissage (pas
-- une correction faite à la main dans Supabase) ; les points, eux, suivent toujours ce qui est terminé.
-- Leçon ouverte, vidéo regardée ou leçon terminée : une activité ; terminée pour la première fois : +10.
create or replace function public.engagement_progression()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secondes integer := 0;
begin
  if tg_op = 'INSERT' then
    v_secondes := public.secondes_couvertes(new.passages);
  elsif new.passages is distinct from old.passages then
    v_secondes := public.secondes_couvertes(new.passages) - public.secondes_couvertes(old.passages);
  end if;
  if (select auth.uid()) = new.profil_id then
    perform public.noter_activite(new.profil_id, v_secondes);
  end if;
  if new.terminee_le is not null and (tg_op = 'INSERT' or old.terminee_le is null) then
    perform public.gagner_points(new.profil_id, 'lecon', new.lecon_id::text, 10);
  end if;
  return null;
end;
$$;
drop trigger if exists progression_engagement on public.progression_lecons;
drop trigger if exists progression_activite on public.progression_lecons;
create trigger progression_activite
  after insert or update on public.progression_lecons
  for each row execute function public.engagement_progression();

-- Quiz passé : une activité ; réussi (score au moins égal au minimum de la formation) : +20, une fois par quiz.
create or replace function public.engagement_quiz()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) = new.profil_id then
    perform public.noter_activite(new.profil_id, 0);
  end if;
  if new.score >= (
    select f.score_quiz
    from public.lecons l
    join public.modules m on m.id = l.module_id
    join public.formations f on f.id = m.formation_id
    where l.id = new.lecon_id
  ) then
    perform public.gagner_points(new.profil_id, 'quiz', new.lecon_id::text, 20);
  end if;
  return null;
end;
$$;
drop trigger if exists tentatives_engagement on public.tentatives_quiz;
drop trigger if exists tentatives_activite on public.tentatives_quiz;
create trigger tentatives_activite
  after insert on public.tentatives_quiz
  for each row execute function public.engagement_quiz();

-- Exercice rendu : une activité (pas la correction du formateur) ; validé : +30, une fois par exercice.
create or replace function public.engagement_rendu()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and (select auth.uid()) = new.profil_id then
    perform public.noter_activite(new.profil_id, 0);
  end if;
  if new.statut = 'valide' and (tg_op = 'INSERT' or old.statut is distinct from 'valide') then
    perform public.gagner_points(new.profil_id, 'exercice', new.lecon_id::text, 30);
  end if;
  return null;
end;
$$;
drop trigger if exists rendus_engagement on public.rendus_exercices;
drop trigger if exists rendus_activite on public.rendus_exercices;
create trigger rendus_activite
  after insert or update of statut on public.rendus_exercices
  for each row execute function public.engagement_rendu();

-- Certificat délivré : +100.
create or replace function public.engagement_certificat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gagner_points(new.profil_id, 'certificat', new.id::text, 100, new.cree_le);
  return null;
end;
$$;
drop trigger if exists certificats_engagement on public.certificats;
create trigger certificats_engagement
  after insert on public.certificats
  for each row execute function public.engagement_certificat();

-- ─── Les certificats déjà obtenus : leurs points et leurs badges, à leur date ───────────────────────
do $rattrapage$
declare
  c record;
begin
  for c in select id, profil_id, cree_le from public.certificats where profil_id is not null order by cree_le, id loop
    perform public.gagner_points(c.profil_id, 'certificat', c.id::text, 100, c.cree_le);
  end loop;
end
$rattrapage$;

-- ─── Ma progression : série, points, niveau, semaine, badges (en-tête, profil, tableau de bord) ──────
create or replace function public.ma_progression_jeu()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
  v_aujourdhui date := public.jour_benin(now());
  v_lundi date := date_trunc('week', public.jour_benin(now())::timestamp)::date;
  v_total integer;
begin
  if v_moi is null then
    raise exception 'Connectez-vous pour voir votre progression.' using errcode = '42501';
  end if;
  select coalesce(sum(g.points), 0)::integer into v_total from public.points_gagnes g where g.profil_id = v_moi;
  return jsonb_build_object(
    'serie', public.serie_de(v_moi, v_aujourdhui),
    'points_total', v_total,
    'points_semaine', (
      select coalesce(sum(g.points), 0)::integer from public.points_gagnes g
      where g.profil_id = v_moi and g.gagne_le >= (v_lundi::timestamp at time zone 'Africa/Porto-Novo')
    ),
    -- Un niveau tous les 200 points : niveau 1 de 0 à 199, niveau 2 à partir de 200…
    'niveau', v_total / 200 + 1,
    'points_avant_niveau', (v_total / 200 + 1) * 200 - v_total,
    'objectif_jours', coalesce((select p.objectif_jours from public.profils p where p.id = v_moi), 5),
    'jours_semaine', (
      select jsonb_agg(exists (select 1 from public.activite_jours a where a.profil_id = v_moi and a.jour = v_lundi + i) order by i)
      from generate_series(0, 6) as i
    ),
    'badges', coalesce((
      select jsonb_agg(jsonb_build_object('code', b.badge, 'obtenu_le', b.obtenu_le) order by b.obtenu_le, b.badge)
      from public.badges_obtenus b where b.profil_id = v_moi
    ), '[]'::jsonb)
  );
end;
$$;

-- ─── La popularité des formations : recalculée une fois par jour (tâche planifiée), pas à chaque lecture ─
-- Le nombre de comptes étudiants (sans autre rôle) qui ont commencé chaque formation.
create table if not exists public.popularite_formations (
  formation_id uuid primary key references public.formations (id) on delete cascade,
  apprenants integer not null default 0,
  calcule_le timestamptz not null default now()
);
alter table public.popularite_formations enable row level security;
revoke all on public.popularite_formations from anon, authenticated;

create or replace function public.rafraichir_popularite()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre integer;
begin
  delete from public.popularite_formations where true;
  insert into public.popularite_formations (formation_id, apprenants, calcule_le)
  select m.formation_id, count(distinct pl.profil_id), now()
  from public.progression_lecons pl
  join public.lecons l on l.id = pl.lecon_id
  join public.modules m on m.id = l.module_id
  where not exists (select 1 from public.roles r where r.profil_id = pl.profil_id and r.role <> 'etudiant')
  group by m.formation_id;
  get diagnostics v_nombre = row_count;
  return v_nombre;
end;
$$;

-- ─── Les recommandations (Q7) ───────────────────────────────────────────────────────────────────────
-- Dans cet ordre, chaque formation une seule fois, à son premier rang :
--   1. « suite » : après une formation terminée (certificat, ou toutes ses leçons ; la plus récente d'abord), la
--      première formation qui suit dans chacun de ses parcours (ordre du parcours, puis titre), avec « Vous avez terminé
--      « X ». Découvrez maintenant « Y ». » ;
--   2. « monetisation » : la formation Business liée à une compétence digitale commencée ; sans aucune, une seule
--      formation sans lien (elle vaut pour toutes les compétences, 0048) ;
--   3. « parcours » : les formations des parcours où le compte a commencé quelque chose, populaires (étudiants qui l'ont
--      commencée) puis nouvelles ;
--   4. « catalogue » : les autres, dans le même ordre.
-- Seulement des formations publiées que le compte n'a ni commencées ni terminées. Une formation payante dont un compte
-- sans abonnement n'a ouvert que des aperçus reste recommandable : il l'a seulement entrevue. Un parcours désactivé ne
-- sert ni de suite ni de « ses parcours ».
create or replace function public.recommandations_pour_moi(p_nombre integer default 3)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
  v_nombre integer := least(greatest(coalesce(p_nombre, 3), 1), 12);
  v_acces boolean := (select auth.uid()) is not null
    and (public.abonne((select auth.uid())) or exists (select 1 from public.roles r where r.profil_id = (select auth.uid()) and r.role <> 'etudiant'));
begin
  if v_moi is null then
    raise exception 'Connectez-vous pour voir vos recommandations.' using errcode = '42501';
  end if;
  return coalesce((
    with mes_lecons as (
      select m.formation_id, max(pl.vue_le) as vue_le
      from public.progression_lecons pl
      join public.lecons l on l.id = pl.lecon_id
      join public.modules m on m.id = l.module_id
      where pl.profil_id = v_moi
      group by m.formation_id
    ),
    entrevues as (
      select m.formation_id as id
      from public.progression_lecons pl
      join public.lecons l on l.id = pl.lecon_id
      join public.modules m on m.id = l.module_id
      join public.formations f on f.id = m.formation_id
      where pl.profil_id = v_moi and not v_acces and not f.gratuite
      group by m.formation_id
      having bool_and(l.apercu)
    ),
    commencees as (
      select ml.formation_id as id from mes_lecons ml where not exists (select 1 from entrevues e where e.id = ml.formation_id)
      union
      select c.formation_id from public.certificats c where c.profil_id = v_moi and c.formation_id is not null
    ),
    candidates as (
      select f.id, f.slug, f.titre, f.publiee_le, coalesce(po.apprenants, 0) as apprenants
      from public.formations f
      left join public.popularite_formations po on po.formation_id = f.id
      where f.statut = 'publiee' and not exists (select 1 from commencees c where c.id = f.id)
    ),
    -- Terminée : son certificat, ou toutes ses leçons publiées terminées (« Terminée » dans « Mes formations », même
    -- avant le quiz ou l'exercice qui manque au certificat).
    terminees as (
      select t.id, max(t.fini_le) as fini_le
      from (
        select c.formation_id as id, c.cree_le as fini_le
        from public.certificats c
        where c.profil_id = v_moi and c.formation_id is not null
        union all
        select m.formation_id, max(pl.terminee_le)
        from public.lecons l
        join public.modules m on m.id = l.module_id
        left join public.progression_lecons pl on pl.lecon_id = l.id and pl.profil_id = v_moi
        where l.type = 'lecon' and l.publiee and m.formation_id in (select ml.formation_id from mes_lecons ml)
        group by m.formation_id
        having count(*) = count(pl.terminee_le)
      ) t
      group by t.id
    ),
    suites as (
      select x.id, x.message, row_number() over (order by x.fini_le desc, x.parcours_ordre, x.parcours_id) as rang
      from (
        select distinct on (t.id, fp.parcours_id)
          ca.id, t.fini_le, p.ordre as parcours_ordre, fp.parcours_id,
          format('Vous avez terminé « %s ». Découvrez maintenant « %s ».', ft.titre, ca.titre) as message
        from terminees t
        join public.formations ft on ft.id = t.id
        join public.formations_parcours fp on fp.formation_id = t.id
        join public.parcours p on p.id = fp.parcours_id and p.actif
        join public.formations_parcours apres on apres.parcours_id = fp.parcours_id
        join candidates ca on ca.id = apres.formation_id
        where (apres.ordre, ca.titre) > (fp.ordre, ft.titre)
        order by t.id, fp.parcours_id, apres.ordre, ca.titre
      ) x
    ),
    competences as (
      select ml.formation_id as id, ml.vue_le
      from mes_lecons ml
      where exists (
        select 1 from public.formations_parcours fp join public.parcours p on p.id = fp.parcours_id
        where fp.formation_id = ml.formation_id and p.couleur = 'digital'
      )
    ),
    liees as (
      select ca.id, max(co.vue_le) as vue_le
      from public.formations_monetisation fm
      join candidates ca on ca.id = fm.business_id
      join competences co on co.id = fm.competence_id
      group by ca.id
    ),
    -- Les formations Business liées à une compétence commencée ; sans aucune, une seule formation sans lien (« pour
    -- toutes les compétences », 0048), la première du parcours Business. Les autres restent au catalogue : elles ne
    -- prennent pas les places de son parcours.
    monetisation as (
      select l.id, row_number() over (order by l.vue_le desc nulls last, ca.apprenants desc, ca.titre) as rang
      from liees l join candidates ca on ca.id = l.id
      union all
      select z.id, 1
      from (
        select ca.id
        from candidates ca
        join public.formations_parcours fp on fp.formation_id = ca.id
        join public.parcours p on p.id = fp.parcours_id and p.couleur = 'business'
        where exists (select 1 from competences)
          and not exists (select 1 from liees)
          and not exists (select 1 from public.formations_monetisation fm where fm.business_id = ca.id)
        group by ca.id, ca.titre
        order by min(fp.ordre), ca.titre
        limit 1
      ) z
    ),
    mes_parcours as (
      select distinct fp.parcours_id
      from public.formations_parcours fp
      join commencees c on c.id = fp.formation_id
      join public.parcours p on p.id = fp.parcours_id and p.actif
    ),
    toutes as (
      select s.id, s.message, 1 as regle, s.rang from suites s
      union all
      select mo.id, null, 2, mo.rang from monetisation mo
      union all
      select ca.id, null, 3, row_number() over (order by ca.apprenants desc, ca.publiee_le desc nulls last, ca.titre)
      from candidates ca
      where exists (select 1 from public.formations_parcours fp join mes_parcours mp on mp.parcours_id = fp.parcours_id where fp.formation_id = ca.id)
      union all
      select ca.id, null, 4, row_number() over (order by ca.apprenants desc, ca.publiee_le desc nulls last, ca.titre)
      from candidates ca
    ),
    retenues as (
      select r.* from (select distinct on (t.id) t.id, t.message, t.regle, t.rang from toutes t order by t.id, t.regle, t.rang) r
      order by r.regle, r.rang
      limit v_nombre
    )
    select jsonb_agg(
      jsonb_build_object(
        'id', ca.id, 'slug', ca.slug, 'titre', ca.titre,
        'motif', case r.regle when 1 then 'suite' when 2 then 'monetisation' when 3 then 'parcours' else 'catalogue' end,
        'message', r.message
      ) order by r.regle, r.rang
    )
    from retenues r join candidates ca on ca.id = r.id
  ), '[]'::jsonb);
end;
$$;

-- ─── Le tableau de bord de l'étudiant (§1), en une lecture ──────────────────────────────────────────
-- La progression des formations (indicateurs, « Continuer », leçon suivante) est calculée par l'appli, avec les règles de
-- « Mes formations » ; la prochaine session vient de prochaine_session(). Ici : le reste.
create or replace function public.mon_tableau_de_bord()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
begin
  if v_moi is null then
    raise exception 'Connectez-vous pour voir votre tableau de bord.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'certificats', jsonb_build_object(
      'nombre', (select count(*) from public.certificats c where c.profil_id = v_moi),
      'titres', coalesce((
        select jsonb_agg(x.formation_titre order by x.cree_le desc)
        from (select c.formation_titre, c.cree_le from public.certificats c where c.profil_id = v_moi order by c.cree_le desc limit 2) x
      ), '[]'::jsonb)
    ),
    -- À faire : l'exercice dont la correction demande une reprise, le quiz tenté mais pas encore réussi.
    'a_faire', coalesce((
      select jsonb_agg(jsonb_build_object('type', x.type, 'formation', x.formation, 'slug', x.slug, 'lecon_id', x.lecon_id, 'lecon', x.lecon) order by x.rang, x.quand desc)
      from (
        select y.* from (
          select 1 as rang, 'exercice' as type, f.titre as formation, f.slug, l.id as lecon_id, l.titre as lecon, coalesce(d.corrige_le, d.cree_le) as quand
          from public.derniers_rendus d
          join public.lecons l on l.id = d.lecon_id
          join public.modules m on m.id = l.module_id
          join public.formations f on f.id = m.formation_id
          where d.profil_id = v_moi and d.statut = 'a_corriger' and l.publiee and f.statut = 'publiee'
          union all
          select 2, 'quiz', f.titre, f.slug, l.id, l.titre, max(t.cree_le)
          from public.tentatives_quiz t
          join public.lecons l on l.id = t.lecon_id
          join public.modules m on m.id = l.module_id
          join public.formations f on f.id = m.formation_id
          where t.profil_id = v_moi and l.publiee and f.statut = 'publiee'
          group by f.titre, f.slug, l.id, l.titre, f.score_quiz
          having max(t.score) < f.score_quiz
        ) y
        order by y.rang, y.quand desc
        limit 6
      ) x
    ), '[]'::jsonb),
    -- L'activité récente : quiz réussis, exercices validés, certificats et badges (pas les leçons ni les jours).
    'activite', coalesce((
      select jsonb_agg(jsonb_build_object('type', x.type, 'titre', x.titre, 'formation', x.formation, 'score', x.score, 'quand', x.quand) order by x.quand desc, x.genre)
      from (
        select z.* from (
          select g.raison as type, l.titre, f.titre as formation,
            case when g.raison = 'quiz' then (select max(t.score) from public.tentatives_quiz t where t.profil_id = v_moi and t.lecon_id = l.id)::integer end as score,
            g.gagne_le as quand, 0 as genre
          from public.points_gagnes g
          join public.lecons l on l.id::text = g.reference
          join public.modules m on m.id = l.module_id
          join public.formations f on f.id = m.formation_id
          where g.profil_id = v_moi and g.raison in ('quiz', 'exercice')
          union all
          select 'certificat', c.formation_titre, null, null, g.gagne_le, 0
          from public.points_gagnes g
          join public.certificats c on c.profil_id = v_moi and c.id::text = g.reference
          where g.profil_id = v_moi and g.raison = 'certificat'
          union all
          select 'badge', b.badge, null, null, b.obtenu_le, 1
          from public.badges_obtenus b
          where b.profil_id = v_moi
        ) z
        order by z.quand desc, z.genre
        limit 3
      ) x
    ), '[]'::jsonb),
    'jeu', public.ma_progression_jeu(),
    'recommandations', public.recommandations_pour_moi(3)
  );
end;
$$;

-- ─── Le rappel de série, chaque jour à 18 h au Bénin (Q8) ──────────────────────────────────────────
-- À qui a une série d'au moins 2 jours (actif hier) et n'a encore rien fait aujourd'hui : une notification « Rappels
-- d'apprentissage » (coupable dans le profil ; notifier() écarte aussi les formateurs). Jamais à un compte suspendu, une
-- seule fois par jour.
create or replace function public.rappeler_series()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aujourdhui date := public.jour_benin(now());
  v_minuit timestamptz := (public.jour_benin(now())::timestamp at time zone 'Africa/Porto-Novo');
  v_total integer := 0;
  r record;
begin
  if not pg_try_advisory_xact_lock(hashtext('etudium.rappeler_series')) then
    return 0;
  end if;
  for r in
    select x.serie, array_agg(x.profil_id) as comptes
    from (
      select a.profil_id, public.serie_de(a.profil_id, v_aujourdhui) as serie
      from public.activite_jours a
      where a.jour = v_aujourdhui - 1
        and not exists (select 1 from public.activite_jours b where b.profil_id = a.profil_id and b.jour = v_aujourdhui)
        and not exists (select 1 from public.suspensions s where s.profil_id = a.profil_id)
        and not exists (
          select 1 from public.notifications n
          where n.destinataire = a.profil_id and n.categorie = 'rappels_apprentissage' and n.cree_le >= v_minuit
        )
    ) x
    where x.serie >= 2
    group by x.serie
  loop
    v_total := v_total + public.notifier(
      r.comptes,
      'rappels_apprentissage',
      format('Votre série de %s jours s’arrête ce soir', r.serie),
      'Une leçon, un quiz ou un exercice aujourd’hui suffit pour la garder.',
      '/tableau-de-bord',
      true
    );
  end loop;
  return v_total;
end;
$$;

-- ─── Le premier calcul de la popularité ─────────────────────────────────────────────────────────────
select public.rafraichir_popularite();

-- ─── Les droits ─────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public.jour_benin(timestamptz) from public, anon, authenticated;
revoke execute on function public.serie_de(uuid, date) from public, anon, authenticated;
revoke execute on function public.gagner_points(uuid, text, text, integer, timestamptz) from public, anon, authenticated;
revoke execute on function public.noter_activite(uuid, integer, date) from public, anon, authenticated;
revoke execute on function public.engagement_progression() from public, anon, authenticated;
revoke execute on function public.engagement_quiz() from public, anon, authenticated;
revoke execute on function public.engagement_rendu() from public, anon, authenticated;
revoke execute on function public.engagement_certificat() from public, anon, authenticated;
revoke execute on function public.rappeler_series() from public, anon, authenticated;
revoke execute on function public.rafraichir_popularite() from public, anon, authenticated;
revoke execute on function public.choisir_objectif(integer) from public, anon;
grant execute on function public.choisir_objectif(integer) to authenticated;
revoke execute on function public.ma_progression_jeu() from public, anon;
grant execute on function public.ma_progression_jeu() to authenticated;
revoke execute on function public.recommandations_pour_moi(integer) from public, anon;
grant execute on function public.recommandations_pour_moi(integer) to authenticated;
revoke execute on function public.mon_tableau_de_bord() from public, anon;
grant execute on function public.mon_tableau_de_bord() to authenticated;

commit;

-- ─── Les tâches planifiées : le rappel de série à 17 h UTC (18 h au Bénin), la popularité à 4 h 20 ─────────────────────────────────────
do $cron$
begin
  begin
    create extension if not exists pg_cron with schema pg_catalog;
  exception when others then
    raise notice 'pg_cron indisponible (%) : activez Cron dans Supabase, puis relancez ce bloc.', sqlerrm;
    return;
  end;
  begin
    perform cron.schedule('etudium-rappel-serie', '0 17 * * *', 'select public.rappeler_series()');
    perform cron.schedule('etudium-popularite', '20 4 * * *', 'select public.rafraichir_popularite()');
  exception when others then
    raise notice 'Tâche planifiée non créée (%) : voir le guide « Ce qui te revient », section 62.', sqlerrm;
  end;
end
$cron$;

-- ═══ 0064_finitions_lot_6.sql ═══
-- Migration 0064 : les points mineurs reportés des lots 4, 5 et 6 A, côté base (2 novembre 2026, à la demande de
-- l'utilisateur : « s'il y a quelque chose à faire, on en finit avec en même temps »).
--   - Journal : supprimer un parcours donne une ligne pour le parcours, pas une « Publication supprimée » par
--     publication en cascade ; résilier écrit une ligne « résiliés » ; un membre de l'équipe supprimé reste dans le
--     filtre « Auteur ».
--   - Vue d'ensemble : des index pour ses comptages par date et par statut.
--   - Désactivation : une formation ne se crée pas « désactivée » ; créée « publiée », elle a sa version.
--   - Versions : une version identique à la précédente n'est pas recréée ; « En ligne » suit le statut.
--   - Enregistrer une leçon : une vidéo intégrée au contenu doit avoir l'identifiant de sa plateforme. Publier
--     verrouille les leçons avant leurs brouillons (l'ordre de l'enregistrement), et ne dit plus « version N » quand
--     rien n'a changé.
-- À appliquer après la 0063. Rejouable.

begin;

-- ─── Journal : supprimer un parcours ────────────────────────────────────────────────────────────────
-- Ses publications partent en cascade : le journal ne les note pas une par une (comme les commentaires d'une
-- publication supprimée, 0061) ; il note le parcours.
create or replace function public.journal_publications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auteur uuid := coalesce(new.auteur, old.auteur);
  v_nom text;
begin
  if v_auteur = (select auth.uid()) or not exists (select 1 from public.profils where id = v_auteur) then
    return null;
  end if;
  if tg_op = 'DELETE' and old.parcours_id is not null and not exists (select 1 from public.parcours pa where pa.id = old.parcours_id) then
    return null;
  end if;
  v_nom := coalesce(public.nom_du_profil(v_auteur), 'un membre');
  if tg_op = 'DELETE' then
    perform public.journaliser('communaute', 'contenu_supprime', 'publication', old.id::text, v_nom, format('Publication de %s supprimée', v_nom),
      jsonb_build_object('texte', left(old.texte, 200)));
  elsif new.statut is distinct from old.statut and new.statut in ('bloquee', 'publiee') then
    perform public.journaliser('communaute', case when new.statut = 'bloquee' then 'publication_bloquee' else 'publication_retablie' end,
      'publication', new.id::text, v_nom,
      format('Publication de %s %s', v_nom, case when new.statut = 'bloquee' then 'bloquée' else 'rétablie' end));
  end if;
  return null;
end;
$$;

create or replace function public.journal_parcours()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.journaliser('contenus', 'parcours_supprime', 'parcours', old.id::text, old.nom, format('Parcours « %s » supprimé', old.nom));
  return null;
end;
$$;
drop trigger if exists journal_parcours on public.parcours;
create trigger journal_parcours after delete on public.parcours
  for each row execute function public.journal_parcours();

-- ─── Journal : résilier tous les abonnements d'un compte ────────────────────────────────────────────
-- Une seule ligne « résiliés », écrite par la fonction ; le déclencheur des abonnements ne note pas chaque ligne
-- (repère local à la transaction). Une annulation (remboursement) garde sa ligne « annulé ».
create or replace function public.journal_abonnements()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nom text := coalesce(public.nom_du_profil(new.profil_id), 'un compte');
  v_formule text := (select f.nom from public.formules f where f.id = new.formule_id);
  v_paiement record;
begin
  if tg_op = 'INSERT' then
    select p.source, p.moyen_manuel, p.reference_manuelle into v_paiement from public.paiements p where p.id = new.paiement_id;
    if v_paiement.source = 'manuel' then
      perform public.journaliser('paiements', 'abonnement_attribue', 'compte', new.profil_id::text, v_nom,
        format('Abonnement %s attribué à %s jusqu’au %s', v_formule, v_nom, public.date_longue(new.fin)),
        jsonb_build_object('moyen', v_paiement.moyen_manuel, 'reference', v_paiement.reference_manuelle));
    end if;
  elsif old.annule_le is null and new.annule_le is not null and coalesce(current_setting('etudium.resiliation', true), '') <> 'oui' then
    perform public.journaliser('paiements', 'abonnement_annule', 'compte', new.profil_id::text, v_nom,
      format('Abonnement %s de %s annulé', v_formule, v_nom), jsonb_build_object('motif', new.motif_annulation));
  end if;
  return null;
end;
$$;

create or replace function public.resilier_abonnements(p_compte uuid, p_motif text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motif text := btrim(coalesce(p_motif, ''));
  v_nombre integer;
  v_nom text := coalesce(public.nom_du_profil(p_compte), 'un compte');
begin
  perform public.exiger_equipe_paiements();
  if char_length(v_motif) < 3 or char_length(v_motif) > 300 then
    raise exception 'Indiquez le motif (3 à 300 caractères).';
  end if;
  perform set_config('etudium.resiliation', 'oui', true);
  update public.abonnements
  set annule_le = now(), motif_annulation = v_motif
  where profil_id = p_compte and annule_le is null and fin > now();
  get diagnostics v_nombre = row_count;
  perform set_config('etudium.resiliation', '', true);
  if v_nombre = 0 then
    raise exception 'Ce compte n’a pas d’abonnement en cours.';
  end if;
  perform public.journaliser('paiements', 'abonnements_resilies', 'compte', p_compte::text, v_nom,
    case when v_nombre = 1 then format('Abonnement de %s résilié', v_nom) else format('%s abonnements de %s résiliés', v_nombre, v_nom) end,
    jsonb_build_object('motif', v_motif, 'nombre', v_nombre));
  perform public.notifier(array[p_compte], 'service', 'Votre abonnement a été résilié', v_motif, '/abonnement');
  return v_nombre;
end;
$$;

-- ─── Journal : l'auteur garde son identifiant après la suppression de son compte ────────────────────
-- Le nom figé (auteur_nom) dit déjà qui c'était ; l'identifiant sert au filtre « Auteur ».
alter table public.journal_actions drop constraint if exists journal_actions_auteur_fkey;

-- ─── La vue d'ensemble du back-office : ses comptages par date et par statut ────────────────────────
create index if not exists abonnements_cree_le on public.abonnements (cree_le);
create index if not exists profils_cree_le on public.profils (cree_le);
create index if not exists paiements_statut_confirme on public.paiements (statut, confirme_le);

-- ─── Désactivation : pas de formation créée « désactivée » ──────────────────────────────────────────
create or replace function public.desactivation_regle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.statut::text = 'desactivee' then
      raise exception 'Seule une formation publiée peut être désactivée.' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if new.statut::text = 'desactivee' and old.statut::text not in ('desactivee', 'publiee') then
    raise exception 'Seule une formation publiée peut être désactivée.' using errcode = 'P0001';
  end if;
  if old.statut::text = 'desactivee' and new.statut::text not in ('desactivee', 'publiee', 'archivee') then
    raise exception 'Une formation désactivée se réactive (elle redevient publiée) ou s’archive.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists formations_desactivation_regle on public.formations;
create trigger formations_desactivation_regle
  before insert or update of statut on public.formations
  for each row execute function public.desactivation_regle();

-- Créée directement « publiée » : sa version « Mise en ligne », comme une publication.
create or replace function public.version_mise_en_ligne()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.statut = 'publiee' then
      perform public.noter_version(new.id, 'Mise en ligne');
    end if;
    return null;
  end if;
  if new.statut = 'publiee' and old.statut is distinct from 'publiee' and old.statut::text <> 'desactivee' then
    perform public.noter_version(new.id, 'Mise en ligne');
  end if;
  return null;
end;
$$;
drop trigger if exists formations_version_mise_en_ligne on public.formations;
create trigger formations_version_mise_en_ligne
  after insert or update of statut on public.formations
  for each row execute function public.version_mise_en_ligne();

-- ─── Versions : pas de doublon d'une version identique ──────────────────────────────────────────────
-- Rend le numéro de la version notée, ou celui de la dernière quand rien n'a changé.
create or replace function public.noter_version(p_formation uuid, p_resume text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_numero integer;
  v_contenu jsonb;
  v_derniere public.versions_formations;
begin
  perform 1 from public.formations f where f.id = p_formation for update;
  v_contenu := public.instantane_formation(p_formation);
  select * into v_derniere from public.versions_formations v where v.formation_id = p_formation order by v.numero desc limit 1;
  if found and v_derniere.contenu = v_contenu then
    return v_derniere.numero;
  end if;
  v_numero := coalesce(v_derniere.numero, 0) + 1;
  insert into public.versions_formations (formation_id, numero, auteur_id, resume, contenu)
  values (p_formation, v_numero, (select auth.uid()), p_resume, v_contenu);
  return v_numero;
end;
$$;

-- « En ligne » : la dernière version, d'une formation qui n'est pas (re)passée en brouillon.
create or replace function public.versions_formation(p_formation uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_derniere integer;
  v_visible boolean := exists (select 1 from public.formations f where f.id = p_formation and f.statut <> 'brouillon');
begin
  if not public.editeur_de_formation(p_formation) then
    raise exception 'Vous ne pouvez pas modifier cette formation.' using errcode = '42501';
  end if;
  select max(v.numero) into v_derniere from public.versions_formations v where v.formation_id = p_formation;
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', v.id, 'numero', v.numero, 'cree_le', v.cree_le, 'auteur', public.nom_du_profil(v.auteur_id),
        'resume', v.resume, 'en_ligne', v_visible and v.numero = v_derniere
      )
      order by v.numero desc
    )
    from public.versions_formations v
    where v.formation_id = p_formation
  ), '[]'::jsonb);
end;
$$;

-- ─── Enregistrer une leçon ──────────────────────────────────────────────────────────────────────────
-- L'identifiant d'une vidéo, au format de sa plateforme (le même contrôle que la vidéo de la leçon, 0030).
create or replace function public.video_valide(p_fournisseur text, p_id text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    (p_fournisseur = 'youtube' and p_id ~ '^[A-Za-z0-9_-]{11}$')
    or (p_fournisseur = 'vimeo' and p_id ~ '^[0-9]{6,12}(/[0-9a-f]{6,20})?$')
    or (p_fournisseur = 'tiktok' and p_id ~ '^[0-9]{15,21}$')
    or (p_fournisseur = 'tella' and p_id ~ '^[A-Za-z0-9-]{4,120}$')
    or (p_fournisseur = 'loom' and p_id ~ '^[0-9a-f]{32}$')
    or (p_fournisseur = 'screenpal' and p_id ~ '^[A-Za-z0-9]{6,20}$')
    or (p_fournisseur = 'drive' and p_id ~ '^[A-Za-z0-9_-]{20,80}$'),
    false
  );
$$;

-- La même que la 0056, plus le contrôle des vidéos du contenu.
create or replace function public.enregistrer_lecon(p_lecon uuid, p_donnees jsonb, p_revision integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
  v_d jsonb;
  v_l public.lecons;
  v_b public.brouillons_lecons;
  v_formation uuid;
begin
  -- Supprimée pendant qu'un autre membre l'avait ouverte : un refus clair, sans nouvel essai (P0001).
  if not exists (select 1 from public.lecons where id = p_lecon) then
    raise exception 'Cette leçon n’existe plus : elle a été supprimée. Revenez au programme de la formation.' using errcode = 'P0001';
  end if;
  if not public.editeur_de_lecon(p_lecon) then
    raise exception 'Vous ne pouvez pas modifier cette leçon.' using errcode = '42501';
  end if;
  v_d := public.donnees_lecon_valides(p_donnees);
  if exists (
    select 1 from jsonb_path_query(coalesce(v_d -> 'document', 'null'::jsonb), 'lax $.** ? (@.type == "videoLecon")') n
    where not public.video_valide(n #>> '{attrs,fournisseur}', n #>> '{attrs,id}')
  ) then
    raise exception 'Une vidéo du contenu n’a pas un identifiant valide : ajoutez-la de nouveau.';
  end if;
  select * into v_l from public.lecons l where l.id = p_lecon for update;
  v_formation := public.formation_de_la_lecon(p_lecon);
  if exists (
    select 1 from jsonb_path_query(coalesce(v_d -> 'document', 'null'::jsonb), 'lax $.**.chemin') c
    where jsonb_typeof(c) = 'string' and split_part(c #>> '{}', '/', 1) <> v_formation::text
  ) then
    raise exception 'Une image vient d’une autre formation : ajoutez-la de nouveau dans cette leçon.';
  end if;

  select * into v_b from public.brouillons_lecons b where b.lecon_id = p_lecon for update;
  if found then
    if v_b.revision <> p_revision then
      return jsonb_build_object('etat', 'conflit', 'par', public.nom_du_profil(v_b.modifie_par));
    end if;
    update public.brouillons_lecons set donnees = v_d, revision = revision + 1, modifie_par = v_moi, modifie_le = now()
    where lecon_id = p_lecon;
    return jsonb_build_object('etat', 'enregistre', 'revision', v_b.revision + 1, 'brouillon', true, 'enregistre_le', now());
  end if;

  if v_l.revision <> p_revision then
    return jsonb_build_object('etat', 'conflit', 'par', public.nom_du_profil(v_l.revise_par));
  end if;
  if public.lecon_visible(p_lecon) then
    insert into public.brouillons_lecons (lecon_id, donnees, revision, modifie_par) values (p_lecon, v_d, v_l.revision + 1, v_moi);
    return jsonb_build_object('etat', 'enregistre', 'revision', v_l.revision + 1, 'brouillon', true, 'enregistre_le', now());
  end if;

  perform public.appliquer_donnees_lecon(p_lecon, v_d);
  update public.lecons set revision = revision + 1, revise_par = v_moi where id = p_lecon;
  if not public.equipe_contenus() then
    perform public.marquer_modifiee_par_formateur(v_formation);
  end if;
  return jsonb_build_object('etat', 'enregistre', 'revision', v_l.revision + 1, 'brouillon', false, 'enregistre_le', now());
end;
$$;

-- ─── Publier les modifications ──────────────────────────────────────────────────────────────────────
-- La même que la 0057, avec deux changements :
--   - les leçons qui ont un brouillon sont verrouillées avant leurs brouillons, dans l'ordre de l'enregistrement
--     (leçon, puis brouillon) : une sauvegarde et une publication simultanées ne s'attendent plus l'une l'autre ;
--   - des brouillons identiques à ce qui est en ligne ne créent pas de version : « version » vaut null.
create or replace function public.publier_modifications(p_formation uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
  v_n integer := 0;
  v_infos boolean := false;
  v_lecons integer := 0;
  v_titre text;
  v_resume text;
  v_version integer;
  v_avant integer;
  v_bf public.brouillons_formations;
  v_bl public.brouillons_lecons;
begin
  if not public.editeur_de_formation(p_formation) then
    raise exception 'Vous ne pouvez pas modifier cette formation.' using errcode = '42501';
  end if;
  if not public.equipe_contenus() and not public.formation_visible(p_formation) then
    raise exception 'Cette formation n’est pas encore en ligne : envoyez-la en relecture.';
  end if;
  perform 1 from public.formations f where f.id = p_formation for update;

  select * into v_bf from public.brouillons_formations b where b.formation_id = p_formation for update;
  if found then
    perform public.appliquer_donnees_formation(p_formation, v_bf.donnees);
    update public.formations set revision = greatest(revision, v_bf.revision) + 1, revise_par = v_moi where id = p_formation;
    delete from public.brouillons_formations where formation_id = p_formation;
    v_n := v_n + 1;
    v_infos := true;
  end if;

  perform 1 from public.lecons l
  join public.modules m on m.id = l.module_id
  where m.formation_id = p_formation and exists (select 1 from public.brouillons_lecons b where b.lecon_id = l.id)
  order by l.id
  for update of l;

  for v_bl in
    select b.* from public.brouillons_lecons b
    join public.lecons l on l.id = b.lecon_id
    join public.modules m on m.id = l.module_id
    where m.formation_id = p_formation
    for update of b
  loop
    perform public.appliquer_donnees_lecon(v_bl.lecon_id, v_bl.donnees);
    update public.lecons set revision = greatest(revision, v_bl.revision) + 1, revise_par = v_moi where id = v_bl.lecon_id;
    delete from public.brouillons_lecons where lecon_id = v_bl.lecon_id;
    v_n := v_n + 1;
    v_lecons := v_lecons + 1;
    v_titre := v_bl.donnees ->> 'titre';
  end loop;

  if v_n = 0 then
    return jsonb_build_object('publiees', 0, 'version', null);
  end if;
  if not public.equipe_contenus() then
    perform public.marquer_modifiee_par_formateur(p_formation);
  end if;
  v_resume := case
    when v_infos and v_lecons = 0 then 'Informations générales modifiées'
    when v_infos then format('Informations générales et %s %s modifiées', v_lecons, case when v_lecons > 1 then 'leçons' else 'leçon' end)
    when v_lecons = 1 then format('Leçon « %s » modifiée', v_titre)
    else format('%s leçons modifiées', v_lecons)
  end;
  select max(v.numero) into v_avant from public.versions_formations v where v.formation_id = p_formation;
  v_version := public.noter_version(p_formation, v_resume);
  if v_avant is not null and v_version <= v_avant then
    v_version := null;
  end if;
  return jsonb_build_object('publiees', v_n, 'version', v_version);
end;
$$;

-- ─── Les droits ─────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public.journal_parcours() from public, anon, authenticated;
revoke execute on function public.video_valide(text, text) from public, anon, authenticated;

commit;

-- ═══ 0065_parcours_back_office.sql ═══
-- Migration 0065 : les chiffres de la page Parcours du back-office (demande du 2 novembre 2026 : « un tableau de bord
-- avec le nombre de formations par parcours », option A choisie). Par parcours : les formations publiées et en
-- brouillon, les apprenants (comptes étudiants, sans autre rôle, qui ont commencé une de ses formations) et les
-- certificats délivrés pour ses formations. En haut : les parcours actifs, les formations publiées, les apprenants et
-- les certificats, chacun compté une seule fois. Réservé à l'équipe des contenus. À appliquer après la 0064.
-- Rejouable.

begin;

create or replace function public.parcours_back_office()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.a_domaine('contenus') then
    raise exception 'Réservé à l’équipe des contenus.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'totaux', jsonb_build_object(
      'parcours_actifs', (select count(*) from public.parcours p where p.actif),
      'formations_publiees', (select count(*) from public.formations f where f.statut = 'publiee'),
      'apprenants', (
        select count(distinct pl.profil_id) from public.progression_lecons pl
        where not exists (select 1 from public.roles r where r.profil_id = pl.profil_id and r.role <> 'etudiant')
      ),
      'certificats', (select count(*) from public.certificats c)
    ),
    'parcours', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'formations_publiees', (
          select count(*) from public.formations_parcours fp join public.formations f on f.id = fp.formation_id
          where fp.parcours_id = p.id and f.statut = 'publiee'
        ),
        'formations_brouillons', (
          select count(*) from public.formations_parcours fp join public.formations f on f.id = fp.formation_id
          where fp.parcours_id = p.id and f.statut = 'brouillon'
        ),
        'apprenants', (
          select count(distinct pl.profil_id)
          from public.formations_parcours fp
          join public.modules m on m.formation_id = fp.formation_id
          join public.lecons l on l.module_id = m.id
          join public.progression_lecons pl on pl.lecon_id = l.id
          where fp.parcours_id = p.id
            and not exists (select 1 from public.roles r where r.profil_id = pl.profil_id and r.role <> 'etudiant')
        ),
        'certificats', (
          select count(*) from public.certificats c join public.formations_parcours fp on fp.formation_id = c.formation_id
          where fp.parcours_id = p.id
        )
      ) order by p.ordre, p.cree_le)
      from public.parcours p
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.parcours_back_office() from public, anon;
grant execute on function public.parcours_back_office() to authenticated;

commit;

-- ═══ 0066_parcours_fiche.sql ═══
-- Migration 0066 : la fiche d'un parcours au back-office (demande du 2 novembre 2026 : « voir les formations, changer
-- le parcours d'une formation, les apprenants aussi et autres »). L'équipe des contenus seulement.
--   - parcours_detail_back_office : les chiffres du parcours, ses formations dans l'ordre (statut, apprenants,
--     certificats, autres parcours), ses apprenants (le plus récemment actif d'abord) et ses prochaines sessions live ;
--   - ranger_formation_parcours : une formation à un rang du parcours ;
--   - changer_parcours_formation : une formation passe d'un parcours à un autre (en fin du parcours d'arrivée), sauf si
--     son lien de monétisation (compétence ↔ Business) n'est plus valable après ;
--   - ajouter_formation_parcours : une formation existante entre aussi dans ce parcours, en fin.
-- À appliquer après la 0065. Rejouable.

begin;

create or replace function public.exiger_equipe_contenus_parcours()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.a_domaine('contenus') then
    raise exception 'Réservé à l’équipe des contenus.' using errcode = '42501';
  end if;
end;
$$;

-- ─── La fiche ───────────────────────────────────────────────────────────────────────────────────────
create or replace function public.parcours_detail_back_office(p_parcours uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_equipe_contenus_parcours();
  if not exists (select 1 from public.parcours p where p.id = p_parcours) then
    return null;
  end if;
  return (
    with suivis as (
      -- Un compte étudiant (sans autre rôle) et une formation du parcours qu'il a commencée.
      select pl.profil_id, m.formation_id, max(pl.vue_le) as vue_le
      from public.formations_parcours fp
      join public.modules m on m.formation_id = fp.formation_id
      join public.lecons l on l.module_id = m.id
      join public.progression_lecons pl on pl.lecon_id = l.id
      where fp.parcours_id = p_parcours
        and not exists (select 1 from public.roles r where r.profil_id = pl.profil_id and r.role <> 'etudiant')
      group by pl.profil_id, m.formation_id
    ),
    certifies as (
      select c.profil_id, c.formation_id
      from public.certificats c
      join public.formations_parcours fp on fp.formation_id = c.formation_id
      where fp.parcours_id = p_parcours
    )
    select jsonb_build_object(
      'chiffres', jsonb_build_object(
        'formations_publiees', (
          select count(*) from public.formations_parcours fp join public.formations f on f.id = fp.formation_id
          where fp.parcours_id = p_parcours and f.statut = 'publiee'
        ),
        'formations_brouillons', (
          select count(*) from public.formations_parcours fp join public.formations f on f.id = fp.formation_id
          where fp.parcours_id = p_parcours and f.statut = 'brouillon'
        ),
        'apprenants', (select count(distinct s.profil_id) from suivis s),
        'certificats', (select count(*) from certifies),
        'sessions_a_venir', (
          select count(*) from public.sessions_live s where s.parcours_id = p_parcours and s.statut = 'programmee' and s.debut > now()
        ),
        'publications_30j', (
          select count(*) from public.publications pu
          where pu.parcours_id = p_parcours and pu.statut = 'publiee' and pu.cree_le > now() - interval '30 days' and pu.cree_le <= now()
        )
      ),
      'formations', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', f.id, 'titre', f.titre, 'slug', f.slug, 'statut', f.statut,
          'apprenants', (select count(*) from suivis s where s.formation_id = f.id),
          'certificats', (select count(*) from certifies c where c.formation_id = f.id),
          'autres_parcours', coalesce((
            select jsonb_agg(pa.nom order by pa.ordre, pa.cree_le)
            from public.formations_parcours fp2 join public.parcours pa on pa.id = fp2.parcours_id
            where fp2.formation_id = f.id and fp2.parcours_id <> p_parcours
          ), '[]'::jsonb)
        ) order by fp.ordre, f.titre)
        from public.formations_parcours fp join public.formations f on f.id = fp.formation_id
        where fp.parcours_id = p_parcours
      ), '[]'::jsonb),
      'apprenants', jsonb_build_object(
        'total', (select count(distinct s.profil_id) from suivis s),
        'liste', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', x.profil_id, 'nom', coalesce(public.nom_du_profil(x.profil_id), 'Compte supprimé'),
            'formations', x.formations, 'certificats', x.certificats, 'derniere_activite', x.derniere
          ) order by x.derniere desc)
          from (
            select s.profil_id, count(*) as formations, max(s.vue_le) as derniere,
              (select count(*) from certifies c where c.profil_id = s.profil_id) as certificats
            from suivis s
            group by s.profil_id
            order by max(s.vue_le) desc
            limit 100
          ) x
        ), '[]'::jsonb)
      ),
      -- Les formations qu'on peut encore y ajouter (pas archivées).
      'a_ajouter', coalesce((
        select jsonb_agg(jsonb_build_object('id', f.id, 'titre', f.titre, 'statut', f.statut) order by f.titre)
        from public.formations f
        where f.statut <> 'archivee'
          and not exists (select 1 from public.formations_parcours fp where fp.parcours_id = p_parcours and fp.formation_id = f.id)
      ), '[]'::jsonb),
      'sessions', coalesce((
        select jsonb_agg(jsonb_build_object('id', s.id, 'titre', s.titre, 'debut', s.debut) order by s.debut)
        from (
          select s.id, s.titre, s.debut from public.sessions_live s
          where s.parcours_id = p_parcours and s.statut = 'programmee' and s.debut > now()
          order by s.debut
          limit 3
        ) s
      ), '[]'::jsonb)
    )
  );
end;
$$;

-- ─── Ranger une formation dans le parcours ──────────────────────────────────────────────────────────
create or replace function public.ranger_formation_parcours(p_parcours uuid, p_formation uuid, p_position integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_rang integer;
begin
  perform public.exiger_equipe_contenus_parcours();
  perform 1 from public.parcours p where p.id = p_parcours for update;
  if not exists (select 1 from public.formations_parcours fp where fp.parcours_id = p_parcours and fp.formation_id = p_formation) then
    raise exception 'Cette formation n’est pas dans ce parcours.';
  end if;
  v_ids := array(
    select fp.formation_id from public.formations_parcours fp join public.formations f on f.id = fp.formation_id
    where fp.parcours_id = p_parcours and fp.formation_id <> p_formation
    order by fp.ordre, f.titre
  );
  v_rang := least(greatest(coalesce(p_position, 1), 1), coalesce(array_length(v_ids, 1), 0) + 1);
  v_ids := v_ids[1:v_rang - 1] || p_formation || v_ids[v_rang:];
  update public.formations_parcours fp set ordre = x.rang
  from unnest(v_ids) with ordinality as x (id, rang)
  where fp.parcours_id = p_parcours and fp.formation_id = x.id;
end;
$$;

-- ─── Changer une formation de parcours ──────────────────────────────────────────────────────────────
create or replace function public.changer_parcours_formation(p_formation uuid, p_depuis uuid, p_vers uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message constant text := 'Cette formation est liée à la monétisation (une compétence et sa formation Business) : retirez d’abord ce lien dans sa fiche.';
begin
  perform public.exiger_equipe_contenus_parcours();
  if p_depuis = p_vers then
    return;
  end if;
  if not exists (select 1 from public.formations_parcours fp where fp.parcours_id = p_depuis and fp.formation_id = p_formation) then
    raise exception 'Cette formation n’est pas dans ce parcours.';
  end if;
  if not exists (select 1 from public.parcours p where p.id = p_vers) then
    raise exception 'Ce parcours n’existe plus.';
  end if;
  -- Ses liens de monétisation doivent rester valables : une formation Business reste dans un parcours Business, une
  -- compétence dans un parcours Compétences digitales.
  if exists (select 1 from public.formations_monetisation fm where fm.business_id = p_formation)
     and not exists (
       select 1 from public.parcours pa
       where pa.couleur = 'business'
         and (pa.id = p_vers or pa.id in (select fp.parcours_id from public.formations_parcours fp where fp.formation_id = p_formation and fp.parcours_id <> p_depuis))
     ) then
    raise exception '%', v_message;
  end if;
  if exists (select 1 from public.formations_monetisation fm where fm.competence_id = p_formation)
     and not exists (
       select 1 from public.parcours pa
       where pa.couleur = 'digital'
         and (pa.id = p_vers or pa.id in (select fp.parcours_id from public.formations_parcours fp where fp.formation_id = p_formation and fp.parcours_id <> p_depuis))
     ) then
    raise exception '%', v_message;
  end if;
  perform 1 from public.parcours p where p.id = p_vers for update;
  delete from public.formations_parcours fp where fp.formation_id = p_formation and fp.parcours_id = p_depuis;
  insert into public.formations_parcours (formation_id, parcours_id, ordre)
  values (p_formation, p_vers, (select coalesce(max(fp.ordre), 0) + 1 from public.formations_parcours fp where fp.parcours_id = p_vers))
  on conflict do nothing;
end;
$$;

-- ─── Ajouter une formation existante au parcours ────────────────────────────────────────────────────
create or replace function public.ajouter_formation_parcours(p_parcours uuid, p_formation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_equipe_contenus_parcours();
  if not exists (select 1 from public.parcours p where p.id = p_parcours) or not exists (select 1 from public.formations f where f.id = p_formation) then
    raise exception 'Ce parcours ou cette formation n’existe plus.';
  end if;
  perform 1 from public.parcours p where p.id = p_parcours for update;
  insert into public.formations_parcours (formation_id, parcours_id, ordre)
  values (p_formation, p_parcours, (select coalesce(max(fp.ordre), 0) + 1 from public.formations_parcours fp where fp.parcours_id = p_parcours))
  on conflict do nothing;
end;
$$;

-- ─── Les droits ─────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public.exiger_equipe_contenus_parcours() from public, anon, authenticated;
revoke execute on function public.parcours_detail_back_office(uuid) from public, anon;
revoke execute on function public.ranger_formation_parcours(uuid, uuid, integer) from public, anon;
revoke execute on function public.changer_parcours_formation(uuid, uuid, uuid) from public, anon;
revoke execute on function public.ajouter_formation_parcours(uuid, uuid) from public, anon;
grant execute on function public.parcours_detail_back_office(uuid) to authenticated;
grant execute on function public.ranger_formation_parcours(uuid, uuid, integer) to authenticated;
grant execute on function public.changer_parcours_formation(uuid, uuid, uuid) to authenticated;
grant execute on function public.ajouter_formation_parcours(uuid, uuid) to authenticated;

commit;

-- ═══ 0067_vue_ensemble_complements.sql ═══
-- Migration 0067 : deux indicateurs de plus sur la vue d'ensemble du back-office (choisis par l'utilisateur le 2 novembre
-- 2026), à côté des six du design :
--   - le taux de conversion : les étudiants abonnés sur les étudiants inscrits ;
--   - les abonnements à renouveler : ceux qui se terminent dans les 7 prochains jours, et parmi eux ceux qui ont déjà un
--     abonnement à la suite.
-- Seulement les comptes étudiants (sans autre rôle). Réservé à qui voit les statistiques. À appliquer après la 0066.
-- Rejouable.

begin;

create or replace function public.vue_ensemble_complements(p_maintenant timestamptz default now())
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_inscrits integer;
  v_abonnes integer;
begin
  perform public.exiger_statistiques();
  select count(*)::integer into v_inscrits
  from public.profils p
  where p.cree_le <= p_maintenant
    and not exists (select 1 from public.roles r where r.profil_id = p.id and r.role <> 'etudiant');
  select count(distinct a.profil_id)::integer into v_abonnes
  from public.abonnements a
  where a.annule_le is null and a.debut <= p_maintenant and a.fin > p_maintenant
    and not exists (select 1 from public.roles r where r.profil_id = a.profil_id and r.role <> 'etudiant');
  return jsonb_build_object(
    'conversion', jsonb_build_object(
      'abonnes', v_abonnes,
      'inscrits', v_inscrits,
      'taux', case when v_inscrits > 0 then round(100.0 * v_abonnes / v_inscrits)::integer end
    ),
    'a_renouveler', (
      select jsonb_build_object('total', count(*)::integer, 'renouveles', count(*) filter (where x.renouvele)::integer)
      from (
        -- Un compte dont l'abonnement en cours se termine dans les 7 jours ; renouvelé s'il en a déjà un à la suite.
        select a.profil_id,
          bool_or(exists (
            select 1 from public.abonnements b
            where b.profil_id = a.profil_id and b.id <> a.id and b.annule_le is null and b.debut >= a.fin - interval '1 minute'
          )) as renouvele
        from public.abonnements a
        where a.annule_le is null and a.debut <= p_maintenant and a.fin > p_maintenant and a.fin <= p_maintenant + interval '7 days'
          and not exists (select 1 from public.roles r where r.profil_id = a.profil_id and r.role <> 'etudiant')
        group by a.profil_id
      ) x
    )
  );
end;
$$;

revoke execute on function public.vue_ensemble_complements(timestamptz) from public, anon;
grant execute on function public.vue_ensemble_complements(timestamptz) to authenticated;

commit;

-- ═══ 0068_back_office_cartes.sql ═══
-- Migration 0068 : les chiffres des cartes du back-office (demande du 2 novembre 2026 : « reprendre les pages de l'admin
-- comme sur l'espace étudiant ») :
--   - formations_back_office : par formation, ses apprenants (comptes étudiants qui l'ont commencée), ses certificats
--     et ses exercices à corriger ; et le total des apprenants, chacun compté une fois ;
--   - formateurs_back_office : par fiche formateur, ses formations (publiées, toutes), ses apprenants, sa note (moyenne
--     de ses formations pondérée par leurs avis), ses corrections en attente et si un compte y est relié ; et les totaux.
-- Réservé à l'équipe des contenus. À appliquer après la 0067. Rejouable.

begin;

create or replace function public.formations_back_office()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.a_domaine('contenus') then
    raise exception 'Réservé à l’équipe des contenus.' using errcode = '42501';
  end if;
  return (
    with suivis as (
      select distinct m.formation_id, pl.profil_id
      from public.progression_lecons pl
      join public.lecons l on l.id = pl.lecon_id
      join public.modules m on m.id = l.module_id
      where not exists (select 1 from public.roles r where r.profil_id = pl.profil_id and r.role <> 'etudiant')
    ),
    a_corriger as (
      select m.formation_id, count(*) as nombre
      from public.derniers_rendus d
      join public.lecons l on l.id = d.lecon_id
      join public.modules m on m.id = l.module_id
      where d.statut = 'en_attente'
      group by m.formation_id
    )
    select jsonb_build_object(
      'apprenants_total', (select count(distinct s.profil_id) from suivis s),
      'formations', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', f.id,
          'apprenants', (select count(*) from suivis s where s.formation_id = f.id),
          'certificats', (select count(*) from public.certificats c where c.formation_id = f.id),
          'a_corriger', coalesce((select a.nombre from a_corriger a where a.formation_id = f.id), 0)
        ))
        from public.formations f
      ), '[]'::jsonb)
    )
  );
end;
$$;

create or replace function public.formateurs_back_office()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.a_domaine('contenus') then
    raise exception 'Réservé à l’équipe des contenus.' using errcode = '42501';
  end if;
  return (
    with suivis as (
      select distinct f.formateur_id, pl.profil_id
      from public.progression_lecons pl
      join public.lecons l on l.id = pl.lecon_id
      join public.modules m on m.id = l.module_id
      join public.formations f on f.id = m.formation_id
      where f.formateur_id is not null
        and not exists (select 1 from public.roles r where r.profil_id = pl.profil_id and r.role <> 'etudiant')
    ),
    a_corriger as (
      select f.formateur_id, count(*) as nombre
      from public.derniers_rendus d
      join public.lecons l on l.id = d.lecon_id
      join public.modules m on m.id = l.module_id
      join public.formations f on f.id = m.formation_id
      where d.statut = 'en_attente' and f.formateur_id is not null
      group by f.formateur_id
    ),
    par_formateur as (
      select fo.id,
        (select count(*) from public.formations f where f.formateur_id = fo.id and f.statut = 'publiee') as formations_publiees,
        (select count(*) from public.formations f where f.formateur_id = fo.id) as formations_total,
        (select count(*) from suivis s where s.formateur_id = fo.id) as apprenants,
        (select sum(f.note_moyenne * f.nb_avis) from public.formations f where f.formateur_id = fo.id and f.nb_avis > 0) as notes,
        (select coalesce(sum(f.nb_avis), 0) from public.formations f where f.formateur_id = fo.id and f.nb_avis > 0) as avis,
        coalesce((select a.nombre from a_corriger a where a.formateur_id = fo.id), 0) as a_corriger,
        fo.compte_id is not null as compte_relie
      from public.formateurs fo
    )
    select jsonb_build_object(
      'totaux', jsonb_build_object(
        'formateurs', (select count(*) from par_formateur),
        'formations_publiees', (select coalesce(sum(p.formations_publiees), 0) from par_formateur p),
        'a_corriger', (select coalesce(sum(p.a_corriger), 0) from par_formateur p),
        'note_moyenne', (select round(sum(p.notes) / nullif(sum(p.avis), 0), 1) from par_formateur p)
      ),
      'formateurs', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id,
          'formations_publiees', p.formations_publiees,
          'formations_total', p.formations_total,
          'apprenants', p.apprenants,
          'note', case when p.avis > 0 then round(p.notes / p.avis, 1) end,
          'avis', p.avis,
          'a_corriger', p.a_corriger,
          'compte_relie', p.compte_relie
        ))
        from par_formateur p
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke execute on function public.formations_back_office() from public, anon;
revoke execute on function public.formateurs_back_office() from public, anon;
grant execute on function public.formations_back_office() to authenticated;
grant execute on function public.formateurs_back_office() to authenticated;

commit;
