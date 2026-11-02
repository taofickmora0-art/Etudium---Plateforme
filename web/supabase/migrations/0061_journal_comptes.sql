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
-- Photos de profil, travaux rendus, pièces jointes de ses conversations (comme « Supprimer mon compte »).
create or replace function public.fichiers_du_compte(p_compte uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.a_domaine('roles') then
    raise exception 'Réservé au super admin.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'photos', (select coalesce(jsonb_agg(o.name order by o.name), '[]'::jsonb) from storage.objects o
               where o.bucket_id = 'photos-profil' and o.name like p_compte::text || '/%'),
    'rendus', (select coalesce(jsonb_agg(r.fichier order by r.fichier), '[]'::jsonb) from public.rendus_exercices r
               where r.profil_id = p_compte and r.fichier is not null),
    'messages', (select coalesce(jsonb_agg(m.fichier order by m.fichier), '[]'::jsonb)
                 from public.messages m join public.conversations c on c.id = m.conversation_id
                 where m.fichier is not null
                   and (c.etudiant_id = p_compte or c.formateur_id = p_compte or (storage.foldername(m.fichier))[1] = p_compte::text))
  );
end;
$$;

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
  if not public.a_domaine('roles') then
    raise exception 'Réservé au super admin.' using errcode = '42501';
  end if;
  if p_compte = (select auth.uid()) then
    raise exception 'Vous ne pouvez pas supprimer votre propre compte d’ici : passez par votre profil.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.roles where profil_id = p_compte and role = 'super_admin') then
    raise exception 'Un compte super admin ne se supprime pas.' using errcode = 'P0001';
  end if;
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

-- Les fichiers d'un compte supprimé : le super admin les retire avec l'API de stockage, avant la suppression.
drop policy if exists "super admin : supprimer les fichiers d'un compte" on storage.objects;
create policy "super admin : supprimer les fichiers d'un compte" on storage.objects
  for delete to authenticated
  using (bucket_id in ('photos-profil', 'rendus', 'messages') and (select public.a_domaine('roles')));

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
revoke execute on function public.supprimer_compte(uuid, text) from public, anon;
grant execute on function public.renommer_compte(uuid, text, text) to authenticated;
grant execute on function public.fichiers_du_compte(uuid) to authenticated;
grant execute on function public.supprimer_compte(uuid, text) to authenticated;

commit;
