-- Migration 0064 : les points mineurs reportés des lots 4, 5 et 6 A, côté base (2 novembre 2026, à la demande de
-- l'utilisateur : « s'il y a quelque chose à faire, on en finit avec en même temps »).
--   - Journal : supprimer un parcours donne une ligne pour le parcours, pas une « Publication supprimée » par
--     publication en cascade ; résilier écrit une ligne « résiliés » ; un membre de l'équipe supprimé reste dans le
--     filtre « Auteur ».
--   - Vue d'ensemble : des index pour ses comptages par date et par statut.
--   - Désactivation : une formation ne se crée pas « désactivée » ; créée « publiée », elle a sa version.
--   - Versions : une version identique à la précédente n'est pas recréée ; « En ligne » suit le statut.
--   - Enregistrer une leçon : la formation est verrouillée d'abord (même ordre que la publication) ; une vidéo
--     intégrée au contenu doit avoir l'identifiant de sa plateforme.
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

-- La même que la 0056, avec la formation verrouillée avant la leçon (publier_modifications prend la formation, puis
-- les brouillons, puis les leçons : sans cet ordre commun, une sauvegarde et une publication simultanées pouvaient
-- s'attendre l'une l'autre) et le contrôle des vidéos du contenu.
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
  v_formation := public.formation_de_la_lecon(p_lecon);
  perform 1 from public.formations f where f.id = v_formation for update;
  select * into v_l from public.lecons l where l.id = p_lecon for update;
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

-- ─── Les droits ─────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public.journal_parcours() from public, anon, authenticated;
revoke execute on function public.video_valide(text, text) from public, anon, authenticated;

commit;
