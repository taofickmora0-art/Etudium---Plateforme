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
