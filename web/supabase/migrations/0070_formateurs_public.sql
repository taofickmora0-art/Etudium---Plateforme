-- Migration 0070 : le formateur public (spec du 2 novembre 2026, §3, §5, §6 et décisions §9).
--   - formateurs.reseaux : les réseaux d'une fiche, saisis au back-office. Six clés permises (instagram, youtube,
--     linkedin, facebook, telegram, tiktok), chacune une adresse en https://, sans espace, 300 caractères au plus.
--     L'équipe des contenus l'écrit par l'API comme le reste de la fiche (droit de colonne, comme la 0013) ;
--   - formateur_public : la fiche publique d'un formateur, lisible par tous (visiteurs compris) : nom, titre, domaine,
--     présentation, réseaux, photo du compte relié (chemin dans l'espace public « photos-profil »), date d'arrivée,
--     formations publiées (de quoi afficher les cartes du catalogue), leur nombre, et peut_ecrire. Null si la fiche
--     n'existe pas. Rien d'autre du profil n'est lu que la photo ; compte_id n'est pas rendu ;
--   - peut_ecrire (outil interne peut_ecrire_formateur) : les règles de la messagerie (0035, 0069). Le compte connecté,
--     non suspendu, est inscrit à une formation de la fiche ; la fiche est reliée à un autre compte, qui a le rôle
--     formateur ;
--   - ouvrir_conversation_formateur : « Message » sur la fiche d'une formation ou le profil d'un formateur. Ouvre (ou
--     retrouve) la conversation avec le compte relié à la fiche, sans que l'appli le connaisse, aux mêmes règles. Erreurs
--     en français.
-- À appliquer après la 0069. Rejouable.

begin;

-- ─── Les réseaux d'une fiche ────────────────────────────────────────────────────────────────────────
-- Un objet dont chaque clé est un réseau permis et chaque valeur une adresse https:// de 300 caractères au plus.
create or replace function public.reseaux_valides(p_reseaux jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p_reseaux) = 'object'
    and not exists (
      select 1
      from jsonb_each(p_reseaux) r
      where r.key not in ('instagram', 'youtube', 'linkedin', 'facebook', 'telegram', 'tiktok')
        or jsonb_typeof(r.value) <> 'string'
        or char_length(r.value #>> '{}') > 300
        or (r.value #>> '{}') !~ '^https://\S+$'
    );
$$;

alter table public.formateurs add column if not exists reseaux jsonb not null default '{}'::jsonb;
alter table public.formateurs drop constraint if exists formateurs_reseaux;
alter table public.formateurs add constraint formateurs_reseaux check (public.reseaux_valides(reseaux));

-- L'équipe des contenus écrit le contenu des fiches par l'API, colonne par colonne (0013) : les réseaux en plus.
grant insert (reseaux), update (reseaux) on public.formateurs to authenticated;

-- ─── Peut-on écrire à ce formateur ? ────────────────────────────────────────────────────────────────
-- Les règles de ouvrir_conversation (0035) côté étudiant, suit_formation_de lisant les inscriptions (0069), et le rôle
-- formateur du compte relié. Faux pour un visiteur, un compte suspendu, le formateur lui-même.
create or replace function public.peut_ecrire_formateur(p_formateur uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select (select auth.uid()) is not null
      and not public.compte_suspendu()
      and fo.compte_id is not null
      and fo.compte_id <> (select auth.uid())
      and exists (select 1 from public.roles r where r.profil_id = fo.compte_id and r.role = 'formateur')
      and public.suit_formation_de((select auth.uid()), fo.compte_id)
    from public.formateurs fo
    where fo.id = p_formateur
  ), false);
$$;

-- ─── La fiche publique ──────────────────────────────────────────────────────────────────────────────
-- Les formations publiées, la plus récemment publiée d'abord ; pour chacune, ce que lisent les cartes du catalogue :
-- leçons publiées de contenu (ni quiz, ni exercice) et leur durée, modules, note, parcours actifs (le premier d'abord,
-- par l'ordre des parcours ; « position » : son rang dans le parcours).
create or replace function public.formateur_public(p_formateur uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with publiees as (
    select
      f.*,
      (select count(*) from public.modules m where m.formation_id = f.id)::integer as nb_modules,
      (
        select count(*) from public.lecons l join public.modules m on m.id = l.module_id
        where m.formation_id = f.id and l.publiee and l.type = 'lecon'
      )::integer as nb_lecons,
      (
        select coalesce(sum(l.duree_secondes), 0) from public.lecons l join public.modules m on m.id = l.module_id
        where m.formation_id = f.id and l.publiee and l.type = 'lecon'
      )::integer as duree_secondes,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'slug', pa.slug, 'nom', pa.nom, 'nom_court', pa.nom_court, 'couleur', pa.couleur, 'ordre', pa.ordre, 'position', fp.ordre
        ) order by pa.ordre, pa.cree_le)
        from public.formations_parcours fp
        join public.parcours pa on pa.id = fp.parcours_id
        where fp.formation_id = f.id and pa.actif
      ), '[]'::jsonb) as parcours
    from public.formations f
    where f.formateur_id = p_formateur and f.statut = 'publiee'
  )
  select jsonb_build_object(
    'id', fo.id,
    'nom', fo.nom,
    'titre', fo.titre,
    'domaine', fo.domaine,
    'presentation', fo.presentation,
    'reseaux', fo.reseaux,
    'photo', (select p.photo_url from public.profils p where p.id = fo.compte_id),
    'rejoint_le', fo.cree_le,
    'formations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id,
        'slug', x.slug,
        'titre', x.titre,
        'resume', x.resume,
        'couverture', x.couverture,
        'niveau', x.niveau,
        'gratuite', x.gratuite,
        'badge', x.badge,
        'publiee_le', x.publiee_le,
        'duree_secondes', x.duree_secondes,
        'nb_lecons', x.nb_lecons,
        'nb_modules', x.nb_modules,
        'note_moyenne', x.note_moyenne,
        'nb_avis', x.nb_avis,
        'parcours', x.parcours
      ) order by x.publiee_le desc nulls last, x.titre)
      from publiees x
    ), '[]'::jsonb),
    'nb_formations', (select count(*) from publiees)::integer,
    'peut_ecrire', public.peut_ecrire_formateur(fo.id)
  )
  from public.formateurs fo
  where fo.id = p_formateur;
$$;

-- ─── Écrire au formateur ────────────────────────────────────────────────────────────────────────────
-- Rend l'identifiant de la conversation (la même à chaque fois), ouverte par ouvrir_conversation (0035).
create or replace function public.ouvrir_conversation_formateur(p_formateur uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_compte uuid;
begin
  if v_uid is null then
    raise exception 'Connectez-vous pour écrire à ce formateur.' using errcode = '42501';
  end if;
  if public.compte_suspendu() then
    raise exception 'Votre compte est suspendu.' using errcode = '42501';
  end if;
  select fo.compte_id into v_compte from public.formateurs fo where fo.id = p_formateur;
  if not found then
    raise exception 'Ce formateur est introuvable.';
  end if;
  if v_compte = v_uid then
    raise exception 'Vous ne pouvez pas vous écrire à vous-même.' using errcode = '42501';
  end if;
  if v_compte is null or not exists (select 1 from public.roles r where r.profil_id = v_compte and r.role = 'formateur') then
    raise exception 'Ce formateur ne reçoit pas de messages.' using errcode = '42501';
  end if;
  if not public.peut_ecrire_formateur(p_formateur) then
    raise exception 'Inscrivez-vous à une de ses formations pour lui écrire.' using errcode = '42501';
  end if;
  return public.ouvrir_conversation(v_compte);
end;
$$;

-- ─── Les droits ─────────────────────────────────────────────────────────────────────────────────────
-- reseaux_valides : la contrainte de la table est vérifiée avec les droits de qui écrit (l'équipe, par l'API).
revoke execute on function public.reseaux_valides(jsonb) from public, anon;
revoke execute on function public.peut_ecrire_formateur(uuid) from public, anon, authenticated;
revoke execute on function public.formateur_public(uuid) from public;
revoke execute on function public.ouvrir_conversation_formateur(uuid) from public, anon;
grant execute on function public.reseaux_valides(jsonb) to authenticated;
grant execute on function public.formateur_public(uuid) to anon, authenticated;
grant execute on function public.ouvrir_conversation_formateur(uuid) to authenticated;

commit;
