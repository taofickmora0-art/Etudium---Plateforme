-- Étudium · base de production · partie 5 sur 5 (migrations 0069 à 0074).
-- Fichier produit par scripts/assembler-migrations.mjs : ne pas le modifier à la main.
-- Supabase › SQL Editor › New query : colle tout ce fichier, puis Run. Attends « Success » avant la partie suivante.
-- C'était la dernière partie : reprends le guide « Mise en ligne ».

-- ═══ 0069_inscriptions_formations.sql ═══
-- Migration 0069 : l'inscription aux formations (spec du 2 novembre 2026, §2 et décisions §9).
--   - inscriptions_formations : une ligne par compte et par formation. Chacun lit les siennes, l'équipe des contenus
--     toutes ; personne ne les écrit directement : seule s_inscrire_formation les crée ;
--   - formation_ouverte : la règle d'accès d'avant au niveau de la formation, sans l'inscription (équipe des contenus,
--     formateur de la formation ; sinon formation publiée, et gratuite pour un compte connecté ou abonnement actif). Sert
--     au bouton « S'inscrire à ce cours » / « Voir les abonnements » ;
--   - s_inscrire_formation : inscrit le compte connecté, non suspendu, sans le rôle formateur, hors équipe des contenus
--     (qui a déjà accès à tout), à une formation publiée qui lui est ouverte. Rejouable : déjà inscrit, rien ne change.
--     inscrit_formation : l'est-il ?
--   - acces_lecon : pour l'étudiant, une leçon qui n'est pas un aperçu exige en plus l'inscription. Les aperçus restent
--     ouverts comme avant (visiteurs compris) ; l'équipe des contenus et le formateur de la formation ne changent pas.
--     À la fin d'un abonnement, l'inscription reste et les leçons payantes se ferment comme avant ;
--   - apprenants_formations : le nombre d'inscrits de chaque formation publiée, lisible par tous (visiteurs compris),
--     sans l'équipe ni les formateurs (règle des statistiques, 0029) ;
--   - suiveurs_formation (qui prévenir d'une nouvelle leçon, d'un archivage ; et, par suiveurs_actifs_formation, d'une
--     désactivation) : les inscrits en plus de ceux qui ont ouvert une leçon ;
--   - la messagerie suit l'inscription (et non plus une leçon ouverte) : suit_formation_de, formation_commune et
--     contacts_messagerie. Un aperçu ouvert ne suffit plus pour écrire au formateur.
-- Rattrapage : chaque compte étudiant qui a déjà une progression, une tentative de quiz, un rendu d'exercice ou un
-- certificat dans une formation y est inscrit, à la date de la plus ancienne. L'équipe (modérateurs, admins, super admins)
-- et les formateurs, qui ouvrent des leçons pour les relire, ne le sont pas (règle de la 0029). Aucun étudiant ne perd
-- l'accès. Il n'a lieu qu'à la première application : rejoué plus tard, il inscrirait aussi qui n'a ouvert qu'un aperçu
-- depuis.
-- À appliquer après la 0068. Rejouable.

begin;

-- Première application (la table n'existe pas encore) : le rattrapage aura lieu, plus bas.
do $$
begin
  perform set_config('etudium.rattrapage_0069', (to_regclass('public.inscriptions_formations') is null)::text, true);
end;
$$;

-- ─── Les inscriptions (écrites seulement par la base ; chacun lit les siennes) ──────────────────────
create table if not exists public.inscriptions_formations (
  profil_id uuid not null references public.profils (id) on delete cascade,
  formation_id uuid not null references public.formations (id) on delete cascade,
  inscrit_le timestamptz not null default now(),
  primary key (profil_id, formation_id)
);
create index if not exists inscriptions_formations_formation_idx on public.inscriptions_formations (formation_id);
alter table public.inscriptions_formations enable row level security;
revoke all on public.inscriptions_formations from anon, authenticated;
grant select on public.inscriptions_formations to authenticated;

drop policy if exists "ses inscriptions : lecture" on public.inscriptions_formations;
create policy "ses inscriptions : lecture" on public.inscriptions_formations
  for select to authenticated
  using (profil_id = (select auth.uid()) or public.equipe_contenus());

-- ─── La formation ouverte (sans l'inscription) ──────────────────────────────────────────────────────
-- Même règle que acces_lecon avant la 0069, au niveau de la formation : jamais pour un compte suspendu ; l'équipe des
-- contenus et le formateur de la formation ; sinon un compte qui n'est pas formateur, une formation publiée, et
-- (gratuite et connecté) ou abonnement actif.
create or replace function public.formation_ouverte(p_formation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not public.compte_suspendu() and (
    public.equipe_contenus()
    or public.formateur_de(p_formation)
    or (
      not public.a_role('formateur')
      and exists (
        select 1
        from public.formations f
        where f.id = p_formation
          and f.statut = 'publiee'
          and ((f.gratuite and (select auth.uid()) is not null) or public.abonne((select auth.uid())))
      )
    )
  );
$$;

-- ─── S'inscrire, être inscrit ───────────────────────────────────────────────────────────────────────
-- Rend la date de l'inscription (la première, si le compte était déjà inscrit).
create or replace function public.s_inscrire_formation(p_formation uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_le timestamptz;
begin
  if v_uid is null then
    raise exception 'Connectez-vous pour vous inscrire à cette formation.' using errcode = '42501';
  end if;
  if public.compte_suspendu() then
    raise exception 'Votre compte est suspendu.' using errcode = '42501';
  end if;
  if public.a_role('formateur') then
    raise exception 'Un compte formateur ne suit pas de formation.' using errcode = '42501';
  end if;
  if public.equipe_contenus() then
    raise exception 'L’équipe a déjà accès à toutes les formations.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.formations f where f.id = p_formation and f.statut = 'publiee') then
    raise exception 'Cette formation n’est pas disponible.';
  end if;
  if not public.formation_ouverte(p_formation) then
    raise exception 'Cette formation est réservée aux abonnés : un abonnement ouvre toutes les formations.' using errcode = '42501';
  end if;
  insert into public.inscriptions_formations (profil_id, formation_id)
  values (v_uid, p_formation)
  on conflict do nothing;
  select i.inscrit_le into v_le from public.inscriptions_formations i where i.profil_id = v_uid and i.formation_id = p_formation;
  return v_le;
end;
$$;

-- Le compte connecté est-il inscrit à cette formation ? (Un visiteur ne l'est jamais.)
create or replace function public.inscrit_formation(p_formation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.inscriptions_formations i
    where i.profil_id = (select auth.uid()) and i.formation_id = p_formation
  );
$$;

-- ─── L'accès à une leçon : l'inscription en plus, hors aperçu ───────────────────────────────────────
-- Dernière définition : 0050_acces_abonnes.sql. Seule la branche de l'étudiant change : une leçon qui n'est pas un
-- aperçu exige, en plus de la gratuité ou de l'abonnement, l'inscription à sa formation.
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
    or (
      not public.a_role('formateur')
      and exists (
        select 1
        from public.lecons l
        join public.modules m on m.id = l.module_id
        join public.formations f on f.id = m.formation_id
        where l.id = p_lecon
          and f.statut = 'publiee'
          and l.publiee
          and (
            l.apercu
            or (
              ((f.gratuite and (select auth.uid()) is not null) or public.abonne((select auth.uid())))
              and exists (
                select 1 from public.inscriptions_formations i
                where i.profil_id = (select auth.uid()) and i.formation_id = f.id
              )
            )
          )
      )
    )
  );
$$;

-- ─── Les apprenants de chaque formation publiée ─────────────────────────────────────────────────────
-- Les inscrits, sans l'équipe ni les formateurs (règle des statistiques, 0029) : un inscrit devenu modérateur ou
-- formateur ne compte plus.
create or replace function public.apprenants_formations()
returns table (formation_id uuid, apprenants integer)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id, count(i.profil_id)::integer
  from public.formations f
  left join public.inscriptions_formations i
    on i.formation_id = f.id
    and not exists (
      select 1 from public.roles r
      where r.profil_id = i.profil_id and r.role in ('moderateur', 'admin', 'super_admin', 'formateur')
    )
  where f.statut = 'publiee'
  group by f.id;
$$;

-- ─── Qui prévenir : les inscrits aussi ──────────────────────────────────────────────────────────────
-- Dernière définition : 0016_notifications.sql (ceux qui ont ouvert une leçon). S'y ajoutent les inscrits, même à 0 % :
-- ils reçoivent les nouvelles leçons et l'archivage (0016, 0034, 0060). suiveurs_actifs_formation (0059 : désactivation
-- et réactivation, « N étudiants suivent cette formation ») la lit, avec ses filtres (comptes suspendus, équipe,
-- formateurs) : elle suit sans changer.
create or replace function public.suiveurs_formation(p_formation uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct s.profil_id), '{}')
  from (
    select p.profil_id
    from public.progression_lecons p
    join public.lecons l on l.id = p.lecon_id
    join public.modules m on m.id = l.module_id
    where m.formation_id = p_formation
    union
    select i.profil_id
    from public.inscriptions_formations i
    where i.formation_id = p_formation
  ) s;
$$;

-- ─── La messagerie : l'inscription relie l'étudiant au formateur ────────────────────────────────────
-- L'étudiant est-il inscrit à une formation de ce formateur (son compte) ? (Dernière définition : 0035_messagerie.sql.)
create or replace function public.suit_formation_de(p_etudiant uuid, p_formateur uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.inscriptions_formations i
    join public.formations f on f.id = i.formation_id
    join public.formateurs fo on fo.id = f.formateur_id
    where i.profil_id = p_etudiant and fo.compte_id = p_formateur
  );
$$;

-- La formation qui les relie : parmi celles où il est inscrit, la plus récemment suivie (dernière leçon ouverte, sinon
-- l'inscription) (dernière définition : 0035_messagerie.sql).
create or replace function public.formation_commune(p_etudiant uuid, p_formateur uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('titre', f.titre, 'slug', f.slug)
  from public.inscriptions_formations i
  join public.formations f on f.id = i.formation_id
  join public.formateurs fo on fo.id = f.formateur_id
  where i.profil_id = p_etudiant and fo.compte_id = p_formateur
  order by greatest(i.inscrit_le, (
    select max(p.vue_le)
    from public.progression_lecons p
    join public.lecons l on l.id = p.lecon_id
    join public.modules m on m.id = l.module_id
    where p.profil_id = p_etudiant and m.formation_id = f.id
  )) desc
  limit 1;
$$;

-- À qui écrire (« Nouveau message ») : pour l'étudiant, les formateurs des formations où il est inscrit (l'Équipe
-- Étudium est ajoutée par l'appli) ; pour le formateur, les inscrits de ses formations, filtrés par nom, 20 au plus
-- (dernière définition : 0035_messagerie.sql).
create or replace function public.contacts_messagerie(p_espace text, p_recherche text default '')
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with liens as (
    select
      case when p_espace = 'formateur' then i.profil_id else fo.compte_id end as id,
      f.titre as formation,
      i.inscrit_le
    from public.inscriptions_formations i
    join public.formations f on f.id = i.formation_id
    join public.formateurs fo on fo.id = f.formateur_id
    where fo.compte_id is not null
      and fo.compte_id <> i.profil_id
      and (
        (p_espace = 'etudiant' and i.profil_id = (select auth.uid()))
        or (p_espace = 'formateur' and fo.compte_id = (select auth.uid()) and public.a_role('formateur'))
      )
  ),
  personnes as (
    select distinct on (l.id)
      l.id,
      case when p_espace = 'formateur' then public.nom_du_profil(l.id) else public.nom_du_formateur(l.id) end as nom,
      l.formation
    from liens l
    order by l.id, l.inscrit_le desc
  ),
  choisies as (
    select pe.*, pr.photo_url
    from personnes pe
    join public.profils pr on pr.id = pe.id
    where pe.nom is not null
      and (coalesce(btrim(p_recherche), '') = '' or lower(pe.nom) like '%' || lower(btrim(p_recherche)) || '%')
    order by pe.nom
    limit 20
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nom', c.nom, 'photo', c.photo_url, 'formation', c.formation) order by c.nom), '[]'::jsonb)
  from choisies c;
$$;

-- ─── Le rattrapage : qui avait commencé une formation y est inscrit ─────────────────────────────────
-- Une leçon ouverte, un quiz passé, un exercice rendu (ou marqué terminé) ou un certificat : à la date du plus ancien.
-- Ni l'équipe ni les formateurs (règle des statistiques, 0029). À la première application seulement ; une inscription
-- existante ne change pas.
do $$
begin
  if current_setting('etudium.rattrapage_0069', true) = 'true' then
    insert into public.inscriptions_formations (profil_id, formation_id, inscrit_le)
    select x.profil_id, x.formation_id, min(x.le)
    from (
      select p.profil_id, m.formation_id, p.ouverte_le as le
      from public.progression_lecons p
      join public.lecons l on l.id = p.lecon_id
      join public.modules m on m.id = l.module_id
      union all
      select t.profil_id, m.formation_id, t.cree_le
      from public.tentatives_quiz t
      join public.lecons l on l.id = t.lecon_id
      join public.modules m on m.id = l.module_id
      union all
      select r.profil_id, m.formation_id, r.cree_le
      from public.rendus_exercices r
      join public.lecons l on l.id = r.lecon_id
      join public.modules m on m.id = l.module_id
      union all
      select c.profil_id, c.formation_id, c.cree_le
      from public.certificats c
      where c.profil_id is not null and c.formation_id is not null
    ) x
    where not exists (
      select 1 from public.roles r
      where r.profil_id = x.profil_id and r.role in ('moderateur', 'admin', 'super_admin', 'formateur')
    )
    group by x.profil_id, x.formation_id
    on conflict do nothing;
  end if;
end;
$$;

-- ─── Les droits ─────────────────────────────────────────────────────────────────────────────────────
-- acces_lecon garde les siens (0004 : visiteurs et comptes connectés).
revoke execute on function public.formation_ouverte(uuid) from public;
revoke execute on function public.s_inscrire_formation(uuid) from public, anon;
revoke execute on function public.inscrit_formation(uuid) from public;
revoke execute on function public.apprenants_formations() from public;
revoke execute on function public.suiveurs_formation(uuid) from public, anon, authenticated;
revoke execute on function public.suit_formation_de(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.formation_commune(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.contacts_messagerie(text, text) from public, anon;
grant execute on function public.formation_ouverte(uuid) to anon, authenticated;
grant execute on function public.s_inscrire_formation(uuid) to authenticated;
grant execute on function public.inscrit_formation(uuid) to anon, authenticated;
grant execute on function public.apprenants_formations() to anon, authenticated;
grant execute on function public.contacts_messagerie(text, text) to authenticated;

commit;

-- ═══ 0070_formateurs_public.sql ═══
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

-- ═══ 0071_production.sql ═══
-- Migration 0071 : la production (spec de la mise en ligne du 2 novembre 2026, §1.1).
--   - Les trois parcours de base. Une base de production est vide : seuls les exemples (exemples/lot-1.sql, jamais en
--     production) les créaient. La landing (src/lib/landing/textes.ts), le filtre du catalogue et la monétisation (0048)
--     s'appuient sur leurs adresses et leurs couleurs. Ils sont insérés avec les textes et l'ordre de lot-1.sql s'ils
--     n'existent pas (par adresse) ; un parcours qui existe déjà (base de test, textes revus au back-office) n'est pas
--     touché.
--   - Le jeton des envois sans manipulation, comme celui des paiements (0049) : l'appli le tire d'une clé qu'elle a déjà
--     (HMAC-SHA256 de RESEND_API_KEY, à défaut de VAPID_PRIVATE_KEY, avec l'étiquette « etudium:jeton-des-envois ») ;
--     un administrateur clique « Activer les envois » au back-office, ce qui en enregistre l'empreinte
--     (enregistrer_jeton_envois) ; etat_envois dit au back-office si le jeton du serveur est celui enregistré. Plus rien
--     à recopier depuis l'éditeur SQL : le jeton affiché par la 0058 (nouveau_jeton_envois) ne sert plus, et un nouveau
--     clic le remplace.
-- À appliquer après la 0070. Rejouable.

begin;

-- ─── Les trois parcours de base ─────────────────────────────────────────────────────────────────────
insert into public.parcours (slug, nom, nom_court, description, couleur, ordre, actif) values
  ('reussite-academique', 'Réussite académique', 'Académique',
   'Les outils et méthodes pour réussir à l’université : bureautique, recherche, rédaction scientifique et soutenance.', 'academique', 1, true),
  ('competences-digitales', 'Compétences digitales', 'Digital',
   'Design, intelligence artificielle, contenu et automatisation : les compétences numériques recherchées.', 'digital', 2, true),
  ('business-revenus-en-ligne', 'Business & revenus en ligne', 'Business',
   'Freelance, produits digitaux et vente en ligne : créer une activité grâce au numérique.', 'business', 3, true)
on conflict (slug) do nothing;

-- ─── Le jeton des envois ────────────────────────────────────────────────────────────────────────────
-- « Activer les envois » : un administrateur actif (même garde que activer_paiements, 0049) pose l'empreinte SHA-256 du
-- jeton du serveur, que exiger_jeton_envois (0058) compare ensuite. Le jeton lui-même n'est jamais gardé.
create or replace function public.enregistrer_jeton_envois(p_jeton text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  if not public.equipe_paiements() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;
  if char_length(coalesce(p_jeton, '')) < 32 then
    raise exception 'Le jeton des envois doit compter au moins 32 caractères.';
  end if;
  insert into public.reglages_envois (id, empreinte)
  values (true, encode(sha256(convert_to(p_jeton, 'UTF8')), 'hex'))
  on conflict (id) do update set empreinte = excluded.empreinte;
end;
$$;

-- Pour le back-office : 'actifs' si le jeton du serveur est celui enregistré, 'a_activer' sinon (jamais activé, clé
-- changée, jeton vide). Réservé aux administrateurs connectés, comme etat_paiements.
create or replace function public.etat_envois(p_jeton text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_equipe_admin();
  if char_length(coalesce(p_jeton, '')) >= 32
     and encode(sha256(convert_to(p_jeton, 'UTF8')), 'hex') = (select r.empreinte from public.reglages_envois r where r.id) then
    return 'actifs';
  end if;
  return 'a_activer';
end;
$$;

-- ─── Droits ─────────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public.enregistrer_jeton_envois(text) from public, anon, authenticated;
revoke execute on function public.etat_envois(text) from public, anon, authenticated;
grant execute on function public.enregistrer_jeton_envois(text) to authenticated;
grant execute on function public.etat_envois(text) to authenticated;

commit;

-- ═══ 0072_paiements_tous_pays.sql ═══
-- Migration 0072 : le paiement ouvert à tous les pays et à tous les opérateurs de Payiz (demande du 2 novembre 2026 :
-- Payiz accepte Celtiis, permet de choisir un pays, et les payeurs ne sont pas tous béninois).
--   - L'opérateur d'un paiement n'est plus limité à MTN et Moov (contrainte de la 0049) : tout code d'opérateur de Payiz
--     (« celtiis », « orange_money »…), en minuscules, chiffres, « _ » et « - », 40 caractères au plus.
--   - Chaque paiement garde le pays du payeur (ISO 3166 alpha-3, « BEN ») et le nom de l'opérateur au moment du paiement
--     (« Celtiis Cash »), pour le reçu, l'historique et le back-office. Les paiements déjà passés par Payiz l'ont tous été
--     depuis le Bénin (seuls les numéros en +229 étaient acceptés) : leur pays devient « BEN ». Leur nom reste vide :
--     l'appli le déduit du code (« MTN Mobile Money », « Moov Money »).
--   - noter_essai reçoit le pays et le nom (deux paramètres facultatifs : l'appli d'avant cette version l'appelle encore
--     avec ses 5 paramètres).
--   - La carte d'un paiement, le reçu, la liste du back-office et la fiche d'un compte les renvoient.
-- Les paiements existants sont gardés. À appliquer après la 0071. Rejouable.

begin;

-- ─── Les colonnes et leurs contraintes ──────────────────────────────────────────────────────────────
alter table public.paiements add column if not exists pays text;
alter table public.paiements add column if not exists operateur_nom text;

-- « operateur in ('mtn', 'moov') » (0049, contrainte sans nom : paiements_operateur_check).
alter table public.paiements drop constraint if exists paiements_operateur_check;
alter table public.paiements drop constraint if exists paiements_operateur_valide;
alter table public.paiements add constraint paiements_operateur_valide check (operateur is null or operateur ~ '^[a-z0-9_-]{1,40}$');
alter table public.paiements drop constraint if exists paiements_pays_valide;
alter table public.paiements add constraint paiements_pays_valide check (pays is null or pays ~ '^[A-Z]{3}$');
alter table public.paiements drop constraint if exists paiements_operateur_nom_valide;
alter table public.paiements add constraint paiements_operateur_nom_valide check (operateur_nom is null or char_length(operateur_nom) between 1 and 60);

update public.paiements set pays = 'BEN'
where pays is null and source = 'payiz' and telephone_masque like '+229 %';

-- ─── Noter un essai, avec le pays et le nom de l'opérateur ──────────────────────────────────────────
-- Dernière définition : 0049_abonnements_paiements.sql. Un code d'opérateur illisible ne remplace rien ; un nouvel
-- opérateur remplace aussi le nom (vide s'il n'est pas donné) ; un pays illisible ne remplace rien.
drop function if exists public.noter_essai(uuid, text, text, text, text);
create or replace function public.noter_essai(
  p_paiement uuid, p_payiz text, p_operateur text, p_telephone_masque text, p_jeton text,
  p_pays text default null, p_operateur_nom text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.paiements%rowtype;
  v_operateur text := case when p_operateur ~ '^[a-z0-9_-]{1,40}$' then p_operateur end;
  v_nom text := nullif(left(btrim(coalesce(p_operateur_nom, '')), 60), '');
  v_pays text := case when upper(btrim(coalesce(p_pays, ''))) ~ '^[A-Z]{3}$' then upper(btrim(p_pays)) end;
begin
  perform public.exiger_jeton_paiement(p_jeton);
  select * into v from public.paiements where id = p_paiement for update;
  if not found then
    raise exception 'Paiement inconnu.';
  end if;
  if v.statut not in ('en_attente', 'echoue') then
    raise exception 'Ce paiement n’attend plus de règlement.';
  end if;
  if v.payiz_id is not null and v.payiz_id is distinct from p_payiz then
    raise exception 'Paiement Payiz différent.';
  end if;
  update public.paiements
  set payiz_id = p_payiz,
      operateur = coalesce(v_operateur, operateur),
      operateur_nom = case when v_operateur is not null then v_nom else operateur_nom end,
      pays = coalesce(v_pays, pays),
      telephone_masque = coalesce(nullif(p_telephone_masque, ''), telephone_masque),
      statut = 'en_attente',
      motif_echec = null,
      essai_le = now()
  where id = p_paiement
  returning * into v;
  return public.carte_paiement(v);
end;
$$;

revoke execute on function public.noter_essai(uuid, text, text, text, text, text, text) from public, anon, authenticated;
-- Appelée par le serveur, avec ou sans session : le jeton la garde (comme en 0049).
grant execute on function public.noter_essai(uuid, text, text, text, text, text, text) to anon, authenticated;

-- ─── La carte d'un paiement (dernière définition : 0054_abonnements_manuels.sql) ─────────────────────
create or replace function public.carte_paiement(p public.paiements)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'statut', p.statut,
    'formule', (select jsonb_build_object('code', f.code, 'nom', f.nom, 'duree_mois', f.duree_mois) from public.formules f where f.id = p.formule_id),
    'prix_initial', p.prix_initial,
    'remise', p.remise,
    'montant', p.montant,
    'code', (select c.code from public.codes_promo c where c.id = p.code_promo_id),
    'operateur', p.operateur,
    'operateur_nom', p.operateur_nom,
    'pays', p.pays,
    'telephone_masque', p.telephone_masque,
    'motif_echec', p.motif_echec,
    'numero_recu', p.numero_recu,
    'payiz_id', p.payiz_id,
    'source', p.source,
    'moyen_manuel', p.moyen_manuel,
    'reference_manuelle', p.reference_manuelle,
    'cree_le', p.cree_le,
    'essai_le', p.essai_le,
    'confirme_le', p.confirme_le,
    'abonnement', (select jsonb_build_object('debut', a.debut, 'fin', a.fin) from public.abonnements a where a.paiement_id = p.id)
  );
$$;

-- ─── Le reçu (dernière définition : 0054_abonnements_manuels.sql) ────────────────────────────────────
create or replace function public.recu(p_numero text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'numero', p.numero_recu,
    'date', p.confirme_le,
    'compte', jsonb_build_object('prenom', coalesce(pr.prenom, ''), 'nom', coalesce(pr.nom, '')),
    'formule', jsonb_build_object('nom', f.nom, 'duree_mois', f.duree_mois),
    'debut', a.debut,
    'fin', a.fin,
    'prix_initial', p.prix_initial,
    'remise', p.remise,
    'code', c.code,
    'montant', p.montant,
    'operateur', p.operateur,
    'operateur_nom', p.operateur_nom,
    'pays', p.pays,
    'telephone_masque', p.telephone_masque,
    'moyen_manuel', p.moyen_manuel,
    'reference_manuelle', p.reference_manuelle
  )
  from public.paiements p
  join public.formules f on f.id = p.formule_id
  left join public.profils pr on pr.id = p.profil_id
  left join public.abonnements a on a.paiement_id = p.id
  left join public.codes_promo c on c.id = p.code_promo_id
  where p.numero_recu = p_numero and p.statut = 'reussi'
    and (p.profil_id = (select auth.uid()) or public.equipe_contenus());
$$;

-- ─── La liste du back-office (dernière définition : 0060_domaines_equipe.sql) ────────────────────────
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
    select p.id, p.cree_le, p.montant, p.statut, p.operateur, p.operateur_nom, p.pays, p.telephone_masque, p.numero_recu, p.profil_id,
           p.source, p.moyen_manuel,
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
        'operateur_nom', g.operateur_nom,
        'pays', g.pays,
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

-- ─── La fiche d'un compte au back-office (dernière définition : 0060_domaines_equipe.sql) ────────────
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
        'operateur_nom', p.operateur_nom,
        'pays', p.pays,
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

commit;

-- ═══ 0073_codes_promo_formules.sql ═══
-- Migration 0073 : un code promo valable seulement pour les abonnements choisis (demande du 3 novembre 2026 : « je
-- choisis les abonnements qui seront concernés par ce code promo, en plus des limites et tout ce qu'il y a déjà »).
--   - Une table de liaison codes_promo_formules (un code, un abonnement), comme formations_parcours : une clé étrangère
--     de chaque côté, en cascade, que ne permettrait pas une colonne tableau sur codes_promo.
--   - Les codes d'avant valent pour les trois abonnements : leur comportement ne change pas.
--   - La règle des codes (remise_code : « Appliquer » et la préparation du paiement) refuse un abonnement non coché :
--     « Ce code ne s’applique pas à l’abonnement Standard. », avec le motif « abonnement » (l'écran revérifie le code
--     quand l'étudiant change d'abonnement).
--   - enregistrer_code_promo reçoit la liste des abonnements et refuse une liste vide. Appelée sans elle (l'appli d'avant
--     cette version, avec ses 8 paramètres), elle garde les abonnements du code, ou les donne tous à un nouveau code.
--   - codes_promo_equipe renvoie les abonnements de chaque code.
-- Deuxième partie (même jour : « quand quelqu'un fait un abonnement, peu importe le type, je dois recevoir une
-- notification dans l'espace admin et aussi un mail ») : chaque abonnement pris par un étudiant (payé, ou offert par un
-- code) prévient l'équipe des paiements, une seule fois, par une notification (cloche, push) et un e-mail détaillé
-- (lignes de détail : nouvelle colonne envois.details, renvoyée par prendre_envois).
-- À appliquer après la 0072. Rejouable.

begin;

-- ─── Les abonnements d'un code ──────────────────────────────────────────────────────────────────────
create table if not exists public.codes_promo_formules (
  code_id uuid not null references public.codes_promo (id) on delete cascade,
  formule_id uuid not null references public.formules (id) on delete cascade,
  primary key (code_id, formule_id)
);
create index if not exists codes_promo_formules_formule_idx on public.codes_promo_formules (formule_id);
alter table public.codes_promo_formules enable row level security;

-- Comme codes_promo (0049) : l'équipe lit ; personne n'écrit directement (enregistrer_code_promo s'en charge).
drop policy if exists "abonnements des codes lus par l'équipe" on public.codes_promo_formules;
create policy "abonnements des codes lus par l'équipe" on public.codes_promo_formules
  for select to authenticated using ((select public.equipe_contenus()));
revoke insert, update, delete on public.codes_promo_formules from anon, authenticated;

-- Les codes d'avant : tous les abonnements. Depuis cette migration, un code a toujours au moins un abonnement
-- (enregistrer_code_promo l'exige) : la relancer ne touche donc pas aux codes restreints depuis.
insert into public.codes_promo_formules (code_id, formule_id)
select c.id, f.id
from public.codes_promo c
cross join public.formules f
where not exists (select 1 from public.codes_promo_formules cf where cf.code_id = c.id)
on conflict do nothing;

-- ─── La règle des codes promo (dernière définition : 0049_abonnements_paiements.sql) ─────────────────
-- Partagée par « Appliquer » (essayer_code) et la préparation du paiement (preparer_paiement), qui l'appellent telle
-- quelle. Le refus pour un abonnement porte le motif « abonnement » : un autre abonnement peut convenir.
create or replace function public.remise_code(p_code text, p_formule uuid, p_profil uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_formule public.formules%rowtype;
  v_code public.codes_promo%rowtype;
  v_prix integer;
  v_remise integer;
  v_montant integer;
begin
  select * into v_formule from public.formules where id = p_formule;
  if not found or not v_formule.active or v_formule.prix_fcfa is null then
    return jsonb_build_object('ok', false, 'message', 'Cet abonnement n’est pas encore proposé.');
  end if;
  v_prix := v_formule.prix_fcfa;
  if coalesce(trim(p_code), '') = '' then
    return jsonb_build_object('ok', true, 'code_id', null, 'prix_initial', v_prix, 'remise', 0, 'montant', v_prix);
  end if;

  select * into v_code from public.codes_promo where code = upper(trim(p_code)) and actif;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Ce code n’existe pas.');
  end if;
  if v_code.debut is not null and now() < v_code.debut then
    return jsonb_build_object('ok', false, 'message', 'Ce code n’est pas encore valable.');
  end if;
  if v_code.fin is not null and now() >= v_code.fin then
    return jsonb_build_object('ok', false, 'message', 'Ce code a expiré.');
  end if;
  -- Seuls les paiements réussis consomment le code.
  if v_code.limite is not null
     and (select count(*) from public.paiements p where p.code_promo_id = v_code.id and p.statut = 'reussi') >= v_code.limite then
    return jsonb_build_object('ok', false, 'message', 'Ce code a atteint sa limite.');
  end if;
  if exists (select 1 from public.paiements p where p.code_promo_id = v_code.id and p.statut = 'reussi' and p.profil_id = p_profil) then
    return jsonb_build_object('ok', false, 'message', 'Vous avez déjà utilisé ce code.');
  end if;
  -- Les abonnements choisis par l'équipe (0073).
  if not exists (select 1 from public.codes_promo_formules cf where cf.code_id = v_code.id and cf.formule_id = p_formule) then
    return jsonb_build_object('ok', false, 'motif', 'abonnement', 'message', format('Ce code ne s’applique pas à l’abonnement %s.', v_formule.nom));
  end if;

  v_remise := case when v_code.type = 'pourcentage' then floor(v_prix * v_code.valeur / 100.0)::integer else least(v_code.valeur, v_prix) end;
  v_montant := v_prix - v_remise;
  -- Payiz n'accepte pas moins de 1 000 FCFA ; 0 (100 %) est un abonnement offert.
  if v_montant between 1 and 999 then
    return jsonb_build_object('ok', false, 'motif', 'abonnement', 'message', 'Ce code ne s’applique pas à cet abonnement.');
  end if;
  return jsonb_build_object('ok', true, 'code_id', v_code.id, 'prix_initial', v_prix, 'remise', v_remise, 'montant', v_montant);
end;
$$;

-- ─── La lecture du back-office (dernière définition : 0060_domaines_equipe.sql) ─────────────────────
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
      'utilisations', (select count(*)::integer from public.paiements p where p.code_promo_id = c.id and p.statut = 'reussi'),
      -- Les abonnements où il vaut, dans leur ordre (0073).
      'formules', coalesce((
        select jsonb_agg(jsonb_build_object('id', f.id, 'code', f.code, 'nom', f.nom, 'duree_mois', f.duree_mois) order by f.ordre, f.nom)
        from public.codes_promo_formules cf
        join public.formules f on f.id = cf.formule_id
        where cf.code_id = c.id
      ), '[]'::jsonb)
    ) order by c.cree_le desc, c.code)
    from public.codes_promo c
  ), '[]'::jsonb);
end;
$$;

-- ─── Enregistrer un code (dernière définition : 0051_paiements_equipe.sql) ──────────────────────────
-- Crée (p_id nul) ou modifie un code ; le code est rangé en majuscules. p_formules : les abonnements où il vaut, au
-- moins un. Sans la liste (l'appli d'avant cette version), un nouveau code vaut pour tous les abonnements, comme avant,
-- et une modification garde ceux du code.
drop function if exists public.enregistrer_code_promo(uuid, text, text, integer, timestamptz, timestamptz, integer, boolean);
create or replace function public.enregistrer_code_promo(
  p_id uuid, p_code text, p_type text, p_valeur integer, p_debut timestamptz, p_fin timestamptz, p_limite integer, p_actif boolean,
  p_formules uuid[] default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_id uuid;
  v_formules uuid[];
begin
  perform public.exiger_equipe_paiements();
  if v_code !~ '^[A-Z0-9_-]{3,30}$' then
    raise exception 'Le code compte 3 à 30 lettres, chiffres, tirets ou soulignés.';
  end if;
  if p_type is null or p_type not in ('pourcentage', 'montant') then
    raise exception 'Choisissez le type de remise.';
  end if;
  if p_type = 'pourcentage' and (p_valeur is null or p_valeur < 1 or p_valeur > 100) then
    raise exception 'Un pourcentage va de 1 à 100.';
  end if;
  if p_type = 'montant' and (p_valeur is null or p_valeur < 1) then
    raise exception 'Le montant de la remise doit être positif.';
  end if;
  if p_debut is not null and p_fin is not null and p_fin <= p_debut then
    raise exception 'La fin doit suivre le début.';
  end if;
  if p_limite is not null and p_limite < 1 then
    raise exception 'La limite doit être d’au moins 1.';
  end if;
  if p_formules is not null then
    if (select count(x) from unnest(p_formules) x) = 0 then
      raise exception 'Choisissez au moins un abonnement.';
    end if;
    select coalesce(array_agg(f.id), '{}') into v_formules from public.formules f where f.id = any (p_formules);
    if cardinality(v_formules) <> (select count(distinct x) from unnest(p_formules) x) then
      raise exception 'Abonnement inconnu.';
    end if;
  end if;
  begin
    if p_id is null then
      insert into public.codes_promo (code, type, valeur, debut, fin, limite, actif, cree_par)
      values (v_code, p_type, p_valeur, p_debut, p_fin, p_limite, coalesce(p_actif, true), (select auth.uid()))
      returning id into v_id;
    else
      update public.codes_promo
      set code = v_code, type = p_type, valeur = p_valeur, debut = p_debut, fin = p_fin, limite = p_limite, actif = coalesce(p_actif, true)
      where id = p_id
      returning id into v_id;
      if v_id is null then
        raise exception 'Ce code n’existe plus.';
      end if;
    end if;
  exception when unique_violation then
    raise exception 'Ce code existe déjà.';
  end;

  if v_formules is not null then
    delete from public.codes_promo_formules where code_id = v_id and formule_id <> all (v_formules);
    insert into public.codes_promo_formules (code_id, formule_id)
    select v_id, u.formule_id from unnest(v_formules) as u (formule_id)
    on conflict do nothing;
  elsif p_id is null then
    insert into public.codes_promo_formules (code_id, formule_id)
    select v_id, f.id from public.formules f
    on conflict do nothing;
  end if;
  return v_id;
end;
$$;

-- ═══ Deuxième partie : chaque nouvel abonnement prévient l'équipe des paiements ═══════════════════════

-- ─── Les lignes de détail d'un e-mail ───────────────────────────────────────────────────────────────
-- [{ "libelle": "Prix", "valeur": "9 000 FCFA" }, …] : affichées en tableau sous le texte (src/lib/envois/email.ts).
alter table public.envois add column if not exists details jsonb;
alter table public.envois drop constraint if exists envois_details;
alter table public.envois add constraint envois_details check (details is null or jsonb_typeof(details) = 'array');

-- ─── Le nom d'un pays de Payiz (code alpha-3), en français ──────────────────────────────────────────
-- Les pays d'Afrique où Payiz peut proposer le paiement ; un autre code reste tel quel.
create or replace function public.nom_pays(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_code
    when 'BEN' then 'Bénin' when 'BFA' then 'Burkina Faso' when 'CIV' then 'Côte d’Ivoire' when 'GNB' then 'Guinée-Bissau'
    when 'MLI' then 'Mali' when 'NER' then 'Niger' when 'SEN' then 'Sénégal' when 'TGO' then 'Togo'
    when 'CMR' then 'Cameroun' when 'CAF' then 'Centrafrique' when 'COG' then 'Congo-Brazzaville' when 'COD' then 'Congo-Kinshasa'
    when 'GAB' then 'Gabon' when 'GNQ' then 'Guinée équatoriale' when 'TCD' then 'Tchad' when 'GIN' then 'Guinée'
    when 'GHA' then 'Ghana' when 'NGA' then 'Nigeria' when 'GMB' then 'Gambie' when 'SLE' then 'Sierra Leone' when 'LBR' then 'Liberia'
    when 'MRT' then 'Mauritanie' when 'CPV' then 'Cap-Vert' when 'KEN' then 'Kenya' when 'UGA' then 'Ouganda' when 'TZA' then 'Tanzanie'
    when 'RWA' then 'Rwanda' when 'BDI' then 'Burundi' when 'ZMB' then 'Zambie' when 'MOZ' then 'Mozambique' when 'MDG' then 'Madagascar'
    when 'MAR' then 'Maroc' when 'DZA' then 'Algérie' when 'TUN' then 'Tunisie' when 'EGY' then 'Égypte' when 'ZAF' then 'Afrique du Sud'
    else p_code
  end;
$$;

-- ─── L'alerte de l'équipe ───────────────────────────────────────────────────────────────────────────
-- Au moment unique où un paiement réussi crée son abonnement (activer_paiement : un abonnement par paiement, et un
-- webhook rejoué ne repasse pas par là). Destinataires : les comptes actifs du domaine « paiements » (admins et super
-- admins, membres_domaine de la 0060), l'auteur compris s'il en fait partie. Un abonnement attribué à la main (0054)
-- ne prévient pas : c'est l'équipe qui l'a fait. Un abonnement offert par un code à 100 % prévient, avec « offert ».
-- La notification (catégorie « service », comme « À modérer ») va dans la cloche, et en push pour qui a un appareil ;
-- l'e-mail, plus détaillé, est mis directement dans la file d'envoi (0058).
create or replace function public.prevenir_equipe_abonnement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paiement public.paiements%rowtype;
  v_formule public.formules%rowtype;
  v_equipe uuid[] := public.membres_domaine('paiements');
  v_nom text;
  v_email text;
  v_code text;
  v_duree text;
  v_moyen text;
  v_offert text;
  v_paye_le timestamptz;
  v_titre text;
  v_texte text;
  v_lien text := '/admin/utilisateurs/' || new.profil_id::text;
  v_details jsonb;
begin
  select * into v_paiement from public.paiements p where p.id = new.paiement_id;
  if not found or v_paiement.source = 'manuel' or cardinality(v_equipe) = 0 then
    return null;
  end if;
  select * into v_formule from public.formules f where f.id = new.formule_id;
  select nullif(btrim(concat_ws(' ', nullif(btrim(pr.prenom), ''), nullif(btrim(pr.nom), ''))), ''), nullif(btrim(u.email), '')
  into v_nom, v_email
  from public.profils pr
  left join auth.users u on u.id = pr.id
  where pr.id = new.profil_id;
  select c.code into v_code from public.codes_promo c where c.id = v_paiement.code_promo_id;
  v_duree := case when v_formule.duree_mois = 12 then '1 an' else v_formule.duree_mois || ' mois' end;
  v_paye_le := coalesce(v_paiement.confirme_le, now());
  if v_paiement.montant > 0 then
    v_moyen := coalesce(
      nullif(btrim(v_paiement.operateur_nom), ''),
      case v_paiement.operateur when 'mtn' then 'MTN Mobile Money' when 'moov' then 'Moov Money' when 'celtiis' then 'Celtiis Cash' end,
      initcap(nullif(btrim(replace(replace(v_paiement.operateur, '_', ' '), '-', ' ')), '')),
      'Mobile Money'
    ) || coalesce(' (' || public.nom_pays(v_paiement.pays) || ')', '');
  else
    v_offert := 'offert' || coalesce(' (code ' || v_code || ')', '');
  end if;

  v_titre := 'Nouvel abonnement : ' || coalesce(v_nom, v_email, 'un compte');
  v_texte := concat_ws(' · ',
    v_formule.nom,
    v_duree,
    coalesce(v_offert, public.montant_lisible(v_paiement.montant) || ' FCFA payés' || coalesce(' (code ' || v_code || ')', '')),
    v_moyen
  );

  select coalesce(jsonb_agg(jsonb_build_object('libelle', l.libelle, 'valeur', l.valeur) order by l.rang), '[]'::jsonb)
  into v_details
  from (values
    (1, 'Étudiant', coalesce(v_nom, '—')),
    (2, 'E-mail', v_email),
    (3, 'Abonnement', v_formule.nom || ' · ' || v_duree),
    (4, 'Période', 'Du ' || public.date_longue(new.debut) || ' au ' || public.date_longue(new.fin)),
    (5, 'Prix', public.montant_lisible(v_paiement.prix_initial) || ' FCFA'),
    (6, 'Remise', case when v_paiement.remise > 0 then '− ' || public.montant_lisible(v_paiement.remise) || ' FCFA' || coalesce(' (code ' || v_code || ')', '') end),
    (7, 'Montant payé', public.montant_lisible(v_paiement.montant) || ' FCFA'
      || case when v_paiement.montant = 0 then ' (offert' || coalesce(' par le code ' || v_code, '') || ')' else '' end),
    (8, 'Moyen de paiement', v_moyen || coalesce(' · ' || nullif(btrim(v_paiement.telephone_masque), ''), '')),
    (9, 'Reçu', v_paiement.numero_recu),
    (10, 'Payé le', public.date_longue(v_paye_le) || ' à ' || to_char(v_paye_le at time zone 'Africa/Porto-Novo', 'HH24" h "MI') || ' (heure du Bénin)')
  ) as l (rang, libelle, valeur)
  where l.valeur is not null;

  perform public.notifier(v_equipe, 'service', v_titre, v_texte, v_lien, true);
  insert into public.envois (canal, destinataire, titre, texte, lien, details)
  select 'email', p.id, left(v_titre, 200), left(v_texte, 400), v_lien, v_details
  from public.profils p
  where p.id = any (v_equipe);
  return null;
end;
$$;
drop trigger if exists abonnements_equipe_prevenue on public.abonnements;
create trigger abonnements_equipe_prevenue
  after insert on public.abonnements
  for each row when (new.paiement_id is not null)
  execute function public.prevenir_equipe_abonnement();

-- ─── Le serveur prend la file (dernière définition : 0058_push_emails.sql), avec les lignes de détail ─
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
      'details', r.details,
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

-- ─── Droits ─────────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public.remise_code(text, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.codes_promo_equipe() from public, anon, authenticated;
revoke execute on function public.enregistrer_code_promo(uuid, text, text, integer, timestamptz, timestamptz, integer, boolean, uuid[]) from public, anon, authenticated;
revoke execute on function public.nom_pays(text) from public, anon, authenticated;
revoke execute on function public.prevenir_equipe_abonnement() from public, anon, authenticated;
revoke execute on function public.prendre_envois(text, text[], integer) from public;

grant execute on function public.codes_promo_equipe() to authenticated;
grant execute on function public.enregistrer_code_promo(uuid, text, text, integer, timestamptz, timestamptz, integer, boolean, uuid[]) to authenticated;
-- Le serveur prend la file avec ou sans session : le jeton fait foi (comme en 0058).
grant execute on function public.prendre_envois(text, text[], integer) to anon, authenticated;

commit;

-- ═══ 0074_bibliotheque.sql ═══
-- Migration 0074 : la Bibliothèque numérique (spec du 3 novembre 2026, lot 7). Une seule migration pour les étapes A
-- (base et back-office), B (pages des étudiants, lecteur) et C (favoris, « Continuer la lecture », livres recommandés
-- dans les formations, statistiques). Choix de l'utilisateur : l'équipe des contenus seule dépose ; un nouveau livre est
-- « inclus dans l'abonnement » et non téléchargeable ; pas de filigrane ; classement par parcours et par catégories
-- libres ; PDF seulement, 50 Mo au plus ; la case « J'ai le droit de diffuser ce livre » obligatoire pour publier.
--   - Tables : categories_livres, livres, livres_parcours (aucun, un ou plusieurs parcours), livres_formations (« Pour
--     aller plus loin » d'une formation), lectures_livres (dernière page, terminé), favoris_livres, telechargements_livres.
--   - Les téléchargements sont des événements (une ligne par téléchargement) plutôt qu'un compteur dans livres : on peut
--     les compter sur une période (30 derniers jours), sans l'équipe ni les formateurs (règle des statistiques, 0029),
--     limiter leur débit par compte, et la fiche d'un livre n'est pas réécrite (ni son « modifie_le ») à chaque clic.
--   - L'écriture suit les formations : l'équipe des contenus écrit directement par l'API, les règles d'accès (RLS) et des
--     déclencheurs gardent les règles (publier exige le PDF et les droits ; on ne supprime qu'un brouillon jamais publié ;
--     l'adresse d'un livre publié est figée). Seuls les rangements passent par des fonctions.
--   - La table livres n'est lue que par l'équipe : le chemin du PDF ne sort jamais. Les fiches publiées se lisent, pour
--     tous (visiteurs compris), par bibliotheque_catalogue, livre_fiche, livres_formation ; mes_lectures et
--     mes_favoris_livres pour le compte connecté ; chemin_livre donne le chemin du PDF à qui a l'accès (lien signé).
--   - Fichiers : l'espace privé « bibliotheque » (PDF, 50 Mo), lu selon acces_livre, écrit par l'équipe ; les couvertures
--     dans l'espace public « couvertures » existant, sous livres/<id>/ (mêmes adresses publiques que les formations).
--   - Le journal (0061) trace la publication, l'archivage et la suppression des livres, comme pour les formations.
-- À appliquer après la 0073. Rejouable.

begin;

-- ─── Les catégories (créées par l'équipe) ───────────────────────────────────────────────────────────
create table if not exists public.categories_livres (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  slug text not null,
  ordre integer not null default 0,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  constraint categories_livres_slug_unique unique (slug),
  constraint categories_livres_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  constraint categories_livres_nom_longueur check (char_length(btrim(nom)) between 1 and 60)
);

-- ─── Les livres ─────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.livres (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  titre text not null,
  auteur text not null default '',
  resume text not null default '',
  -- Code de langue à deux lettres (fr, en…).
  langue text not null default 'fr',
  annee smallint,
  mots_cles text[] not null default '{}',
  -- Lu dans le PDF au dépôt (pdf.js, au back-office).
  nb_pages integer,
  categorie_id uuid references public.categories_livres (id) on delete set null,
  -- Le PDF dans l'espace privé « bibliotheque » : <id du livre>/<uuid>.pdf.
  fichier text,
  taille_octets bigint,
  -- L'image dans l'espace public « couvertures » : livres/<id du livre>/<uuid>.<jpg|png|webp>.
  couverture text,
  acces text not null default 'abonnes',
  telechargeable boolean not null default false,
  -- « J'ai le droit de diffuser ce livre » : obligatoire pour publier.
  droits_confirmes boolean not null default false,
  statut text not null default 'brouillon',
  cree_par uuid default auth.uid() references public.profils (id) on delete set null,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  -- La première publication : elle fige l'adresse.
  publie_le timestamptz,
  constraint livres_slug_unique unique (slug),
  constraint livres_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 90),
  constraint livres_fichier_unique unique (fichier),
  constraint livres_titre_longueur check (char_length(btrim(titre)) between 1 and 200),
  constraint livres_auteur_longueur check (char_length(auteur) <= 120),
  constraint livres_resume_longueur check (char_length(resume) <= 2000),
  constraint livres_langue check (langue ~ '^[a-z]{2}$'),
  constraint livres_annee check (annee is null or annee between 1000 and 2100),
  constraint livres_mots_cles check (cardinality(mots_cles) <= 20 and char_length(array_to_string(mots_cles, ',')) <= 600),
  constraint livres_nb_pages check (nb_pages is null or nb_pages between 1 and 100000),
  constraint livres_fichier_chemin check (fichier is null or fichier ~ ('^' || id::text || '/[0-9a-f-]{36}\.pdf$')),
  constraint livres_taille check (taille_octets is null or taille_octets between 1 and 52428800),
  constraint livres_couverture_chemin check (couverture is null or couverture ~ ('^livres/' || id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$')),
  constraint livres_acces check (acces in ('gratuit', 'abonnes')),
  constraint livres_statut check (statut in ('brouillon', 'publie', 'archive')),
  -- Le filet de la règle de publication (le déclencheur livres_regles donne le message, plus bas).
  constraint livres_publication check (statut = 'brouillon' or (fichier is not null and droits_confirmes))
);
create index if not exists livres_statut_idx on public.livres (statut);
create index if not exists livres_categorie_idx on public.livres (categorie_id);
create index if not exists livres_cree_par_idx on public.livres (cree_par);

-- ─── Les parcours d'un livre (aucun, un ou plusieurs) ───────────────────────────────────────────────
create table if not exists public.livres_parcours (
  livre_id uuid not null references public.livres (id) on delete cascade,
  parcours_id uuid not null references public.parcours (id) on delete cascade,
  primary key (livre_id, parcours_id)
);
create index if not exists livres_parcours_parcours_idx on public.livres_parcours (parcours_id);

-- ─── Les livres recommandés par une formation (« Pour aller plus loin ») ────────────────────────────
create table if not exists public.livres_formations (
  formation_id uuid not null references public.formations (id) on delete cascade,
  livre_id uuid not null references public.livres (id) on delete cascade,
  ordre integer not null default 0,
  ajoute_le timestamptz not null default now(),
  primary key (formation_id, livre_id)
);
create index if not exists livres_formations_livre_idx on public.livres_formations (livre_id);

-- ─── Les lectures (une ligne par compte et par livre ouvert) ────────────────────────────────────────
-- derniere_page : où reprendre ; page_max : la page la plus loin atteinte (le pourcentage) ; nb_pages : le total vu par
-- le lecteur ; terminee : la dernière page a été atteinte une fois (et le reste).
create table if not exists public.lectures_livres (
  profil_id uuid not null references public.profils (id) on delete cascade,
  livre_id uuid not null references public.livres (id) on delete cascade,
  derniere_page integer not null default 1,
  page_max integer not null default 1,
  nb_pages integer not null default 1,
  pourcentage smallint not null default 0,
  terminee boolean not null default false,
  terminee_le timestamptz,
  ouvert_le timestamptz not null default now(),
  maj_le timestamptz not null default now(),
  primary key (profil_id, livre_id),
  constraint lectures_livres_pages check (nb_pages between 1 and 100000 and derniere_page between 1 and nb_pages and page_max between 1 and nb_pages),
  constraint lectures_livres_pourcentage check (pourcentage between 0 and 100)
);
create index if not exists lectures_livres_livre_idx on public.lectures_livres (livre_id);
create index if not exists lectures_livres_recentes_idx on public.lectures_livres (profil_id, maj_le desc);

-- ─── Les favoris (comme ceux des formations, 0009) ──────────────────────────────────────────────────
create table if not exists public.favoris_livres (
  profil_id uuid not null default auth.uid() references public.profils (id) on delete cascade,
  livre_id uuid not null references public.livres (id) on delete cascade,
  ajoute_le timestamptz not null default now(),
  primary key (profil_id, livre_id)
);
create index if not exists favoris_livres_livre_idx on public.favoris_livres (livre_id);

-- ─── Les téléchargements (événements) ───────────────────────────────────────────────────────────────
-- Un compte supprimé ensuite : la ligne reste, sans compte, et compte toujours.
create table if not exists public.telechargements_livres (
  id bigint generated always as identity primary key,
  livre_id uuid not null references public.livres (id) on delete cascade,
  profil_id uuid references public.profils (id) on delete set null,
  telecharge_le timestamptz not null default now()
);
create index if not exists telechargements_livres_livre_idx on public.telechargements_livres (livre_id, telecharge_le);
create index if not exists telechargements_livres_profil_idx on public.telechargements_livres (profil_id, telecharge_le);

-- ─── La limite de débit des lectures (60 mises à jour par minute et par compte) ─────────────────────
create table if not exists public.debit_lectures (
  profil_id uuid primary key references public.profils (id) on delete cascade,
  fenetre_le timestamptz not null default now(),
  appels integer not null default 0
);

-- ─── modifie_le tenu à jour (fonction de la 0001) ───────────────────────────────────────────────────
drop trigger if exists categories_livres_modifie_le on public.categories_livres;
create trigger categories_livres_modifie_le before update on public.categories_livres
  for each row execute function public.toucher_modifie_le();
drop trigger if exists livres_modifie_le on public.livres;
create trigger livres_modifie_le before update on public.livres
  for each row execute function public.toucher_modifie_le();

-- ─── Les règles d'un livre (comme formations_regles, 0004) ──────────────────────────────────────────
-- Un brouillon se publie avec son PDF et la case des droits ; publié, il s'archive et se republie, ne redevient jamais
-- brouillon, garde son adresse, son PDF et sa case ; seul un brouillon jamais publié se supprime.
create or replace function public.livres_regles()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- Déjà publié (publié ou archivé) avant cette modification.
  v_publie_avant boolean := false;
begin
  if tg_op = 'DELETE' then
    if old.publie_le is not null or old.statut <> 'brouillon' then
      raise exception 'Un livre publié s’archive, il ne se supprime pas.';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    v_publie_avant := old.statut <> 'brouillon';
  end if;
  if tg_op = 'UPDATE' and old.publie_le is not null then
    if new.slug is distinct from old.slug then
      raise exception 'L’adresse d’un livre publié ne change plus.';
    end if;
    -- La date de première publication ne s'efface pas (elle protège l'adresse).
    new.publie_le := old.publie_le;
  end if;
  if v_publie_avant and new.statut = 'brouillon' then
    raise exception 'Un livre publié ne redevient pas un brouillon : archivez-le.';
  end if;
  if new.statut = 'archive' and not v_publie_avant then
    raise exception 'Seul un livre publié s’archive.';
  end if;
  if new.statut <> 'brouillon' then
    if new.fichier is null then
      if v_publie_avant then
        raise exception 'Un livre publié garde son PDF.';
      end if;
      raise exception 'Déposez le PDF du livre avant de le publier.';
    end if;
    if not new.droits_confirmes then
      if v_publie_avant then
        raise exception 'Un livre publié garde la case « J’ai le droit de diffuser ce livre » cochée.';
      end if;
      raise exception 'Cochez « J’ai le droit de diffuser ce livre » avant de le publier.';
    end if;
  end if;
  if new.statut = 'publie' and new.publie_le is null then
    new.publie_le := now();
  elsif new.statut = 'brouillon' then
    -- Jamais publié : pas de date (elle figerait l'adresse d'un simple brouillon).
    new.publie_le := null;
  end if;
  return new;
end;
$$;
drop trigger if exists livres_regles on public.livres;
create trigger livres_regles
  before insert or update or delete on public.livres
  for each row execute function public.livres_regles();

-- ─── Le journal de l'équipe (0061), comme journal_formations ────────────────────────────────────────
create or replace function public.libelle_statut_livre(p_statut text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_statut when 'brouillon' then 'Brouillon' when 'publie' then 'Publié' when 'archive' then 'Archivé' else p_statut end;
$$;

create or replace function public.journal_livres()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.journaliser('contenus', 'livre_supprime', 'livre', old.id::text, old.titre, format('Livre « %s » supprimé', old.titre));
  elsif new.statut is distinct from old.statut then
    perform public.journaliser('contenus', 'livre_statut', 'livre', new.id::text, new.titre,
      format('Livre « %s » : %s → %s', new.titre, public.libelle_statut_livre(old.statut), public.libelle_statut_livre(new.statut)),
      jsonb_build_object('ancien', old.statut, 'nouveau', new.statut));
  end if;
  return null;
end;
$$;
drop trigger if exists livres_journal on public.livres;
create trigger livres_journal after update of statut or delete on public.livres
  for each row execute function public.journal_livres();

-- ─── La règle d'accès ───────────────────────────────────────────────────────────────────────────────
-- Ce livre peut-il être lu par le compte qui demande ? L'équipe des contenus : tout livre. Sinon un compte connecté,
-- non suspendu, un livre publié, gratuit ou avec un abonnement en cours (0049). Un visiteur : jamais (il lit après
-- connexion). Un livre qui n'existe pas : non.
create or replace function public.acces_livre(p_livre uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not public.compte_suspendu() and exists (
    select 1 from public.livres l
    where l.id = p_livre
      and (
        public.equipe_contenus()
        or (
          (select auth.uid()) is not null
          and l.statut = 'publie'
          and (l.acces = 'gratuit' or public.abonne((select auth.uid())))
        )
      )
  );
$$;

-- Un livre publié (favoris, recommandations) : lu par la base, sans passer par la règle de la table (réservée à l'équipe).
create or replace function public.livre_publie(p_livre uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.livres l where l.id = p_livre and l.statut = 'publie');
$$;

-- Un fichier de l'espace « bibliotheque » lisible par le compte qui demande (règle de l'espace, plus bas).
create or replace function public.acces_fichier_livre(p_chemin text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.livres l where l.fichier = p_chemin and public.acces_livre(l.id));
$$;

-- Le chemin du PDF, pour un lien signé (lecteur, téléchargement) : seulement avec l'accès au livre.
create or replace function public.chemin_livre(p_livre uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_chemin text;
begin
  if not public.acces_livre(p_livre) then
    raise exception 'Ce livre ne vous est pas ouvert.' using errcode = '42501';
  end if;
  select l.fichier into v_chemin from public.livres l where l.id = p_livre;
  if v_chemin is null then
    raise exception 'Ce livre n’a pas encore de fichier.';
  end if;
  return v_chemin;
end;
$$;

-- « ouvert » (il se lit), « connexion » (visiteur), « abonnement » (réservé aux abonnés, compte sans abonnement) ou
-- « ferme » (compte suspendu, livre non publié) : le bouton de la fiche (« Lire », « Se connecter », « Voir les
-- abonnements »).
create or replace function public.etat_acces_livre(l public.livres)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.acces_livre(l.id) then 'ouvert'
    when (select auth.uid()) is null then 'connexion'
    when l.statut = 'publie' and l.acces = 'abonnes' and not public.compte_suspendu() and not public.abonne((select auth.uid())) then 'abonnement'
    else 'ferme'
  end;
$$;

-- ─── Les fiches publiques ───────────────────────────────────────────────────────────────────────────
-- La carte d'un livre, commune au catalogue, à la fiche, à « Continuer la lecture », aux favoris et aux
-- recommandations. Jamais le chemin du PDF. Pour le compte connecté : favori et lecture (null sans lecture).
create or replace function public.carte_livre(l public.livres)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', l.id,
    'slug', l.slug,
    'titre', l.titre,
    'auteur', l.auteur,
    'resume', l.resume,
    'langue', l.langue,
    'annee', l.annee,
    'mots_cles', to_jsonb(l.mots_cles),
    'nb_pages', l.nb_pages,
    'couverture', l.couverture,
    'acces', l.acces,
    'telechargeable', l.telechargeable,
    'statut', l.statut,
    'publie_le', l.publie_le,
    'categorie', (select jsonb_build_object('id', c.id, 'slug', c.slug, 'nom', c.nom) from public.categories_livres c where c.id = l.categorie_id),
    'parcours', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'slug', p.slug, 'nom', p.nom, 'nom_court', p.nom_court, 'couleur', p.couleur) order by p.ordre, p.nom)
      from public.livres_parcours lp
      join public.parcours p on p.id = lp.parcours_id
      where lp.livre_id = l.id and p.actif
    ), '[]'::jsonb),
    'ouvert', public.acces_livre(l.id),
    'acces_etat', public.etat_acces_livre(l),
    'favori', exists (select 1 from public.favoris_livres f where f.livre_id = l.id and f.profil_id = (select auth.uid())),
    'lecture', (
      select jsonb_build_object(
        'derniere_page', r.derniere_page, 'nb_pages', r.nb_pages, 'pourcentage', r.pourcentage, 'terminee', r.terminee,
        'ouvert_le', r.ouvert_le, 'maj_le', r.maj_le
      )
      from public.lectures_livres r
      where r.livre_id = l.id and r.profil_id = (select auth.uid())
    )
  );
$$;

-- Le catalogue : les livres publiés (les plus récents d'abord), filtrés au besoin ; et, pour les filtres, les
-- catégories et les parcours actifs avec leur nombre de livres publiés.
--   p_recherche : dans le titre, l'auteur et les mots-clés, sans accents ni majuscules (100 caractères au plus) ;
--   p_parcours, p_categorie : l'adresse (slug) d'un parcours, d'une catégorie ; p_gratuits : les livres gratuits seuls.
create or replace function public.bibliotheque_catalogue(
  p_recherche text default '', p_parcours text default null, p_categorie text default null, p_gratuits boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := left(public.sans_accents(btrim(coalesce(p_recherche, ''))), 100);
  v_parcours text := nullif(btrim(coalesce(p_parcours, '')), '');
  v_categorie text := nullif(btrim(coalesce(p_categorie, '')), '');
begin
  return jsonb_build_object(
    'livres', coalesce((
      select jsonb_agg(public.carte_livre(l) order by l.publie_le desc, l.titre)
      from public.livres l
      where l.statut = 'publie'
        and (v_q = '' or strpos(public.sans_accents(concat_ws(' ', l.titre, l.auteur, array_to_string(l.mots_cles, ' '))), v_q) > 0)
        and (v_parcours is null or exists (
          select 1 from public.livres_parcours lp join public.parcours p on p.id = lp.parcours_id
          where lp.livre_id = l.id and p.slug = v_parcours
        ))
        and (v_categorie is null or exists (select 1 from public.categories_livres c where c.id = l.categorie_id and c.slug = v_categorie))
        and (not coalesce(p_gratuits, false) or l.acces = 'gratuit')
    ), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'slug', c.slug, 'nom', c.nom,
        'livres', (select count(*)::int from public.livres l where l.categorie_id = c.id and l.statut = 'publie')
      ) order by c.ordre, c.nom)
      from public.categories_livres c
    ), '[]'::jsonb),
    'parcours', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'slug', p.slug, 'nom', p.nom, 'nom_court', p.nom_court, 'couleur', p.couleur,
        'livres', (select count(*)::int from public.livres_parcours lp join public.livres l on l.id = lp.livre_id where lp.parcours_id = p.id and l.statut = 'publie')
      ) order by p.ordre, p.nom)
      from public.parcours p
      where p.actif
    ), '[]'::jsonb)
  );
end;
$$;

-- La fiche d'un livre par son adresse : la carte, sa taille, et les formations publiées qui le recommandent. Un livre
-- pas publié n'existe que pour l'équipe des contenus (aperçu) ; sinon null.
create or replace function public.livre_fiche(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.carte_livre(l) || jsonb_build_object(
    'taille_octets', l.taille_octets,
    'modifie_le', l.modifie_le,
    'formations', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'slug', f.slug, 'titre', f.titre, 'couverture', f.couverture) order by f.titre)
      from public.livres_formations lf
      join public.formations f on f.id = lf.formation_id
      where lf.livre_id = l.id and f.statut = 'publiee'
    ), '[]'::jsonb)
  )
  from public.livres l
  where l.slug = btrim(coalesce(p_slug, '')) and (l.statut = 'publie' or public.equipe_contenus());
$$;

-- « Continuer la lecture » : les livres publiés que le compte a commencés sans les terminer, du plus récent au plus
-- ancien (12 par défaut, 50 au plus). Un visiteur : aucun.
create or replace function public.mes_lectures(p_limite integer default 12)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(x.carte order by x.maj_le desc), '[]'::jsonb)
  from (
    select public.carte_livre(l) as carte, r.maj_le
    from public.lectures_livres r
    join public.livres l on l.id = r.livre_id
    where r.profil_id = (select auth.uid()) and not r.terminee and l.statut = 'publie'
    order by r.maj_le desc
    limit least(greatest(coalesce(p_limite, 12), 1), 50)
  ) x;
$$;

-- Les livres mis de côté par le compte (onglet Favoris), du plus récent au plus ancien ; publiés seulement.
create or replace function public.mes_favoris_livres()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(public.carte_livre(l) order by f.ajoute_le desc), '[]'::jsonb)
  from public.favoris_livres f
  join public.livres l on l.id = f.livre_id
  where f.profil_id = (select auth.uid()) and l.statut = 'publie';
$$;

-- « Pour aller plus loin » d'une formation : ses livres publiés recommandés, dans leur ordre. Une formation pas publiée
-- n'en montre qu'à l'équipe des contenus et à son formateur.
create or replace function public.livres_formation(p_formation uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(public.carte_livre(l) order by lf.ordre, l.titre), '[]'::jsonb)
  from public.livres_formations lf
  join public.livres l on l.id = lf.livre_id
  join public.formations f on f.id = lf.formation_id
  where lf.formation_id = p_formation
    and l.statut = 'publie'
    and (f.statut = 'publiee' or public.equipe_contenus() or public.formateur_de(f.id));
$$;

-- ─── La lecture et le téléchargement ────────────────────────────────────────────────────────────────
-- Garde la page où reprendre (ramenée entre 1 et p_total), la page la plus loin atteinte (le pourcentage), et marque le
-- livre terminé à la dernière page ; terminé, il le reste. Rend l'état de la lecture. Limite : 60 appels par minute et
-- par compte (le lecteur note la page quand elle change, pas à chaque défilement).
create or replace function public.noter_lecture(p_livre uuid, p_page integer, p_total integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_page integer;
  v_appels integer;
  v_ligne public.lectures_livres%rowtype;
begin
  if v_uid is null or not public.acces_livre(p_livre) then
    raise exception 'Ce livre ne vous est pas ouvert.' using errcode = '42501';
  end if;
  if p_total is null or p_total < 1 or p_total > 100000 then
    raise exception 'Nombre de pages invalide.';
  end if;
  insert into public.debit_lectures as d (profil_id, fenetre_le, appels)
  values (v_uid, now(), 1)
  on conflict (profil_id) do update
    set fenetre_le = case when d.fenetre_le < now() - interval '1 minute' then now() else d.fenetre_le end,
        appels = case when d.fenetre_le < now() - interval '1 minute' then 1 else d.appels + 1 end
  returning d.appels into v_appels;
  if v_appels > 60 then
    raise exception 'Trop de mises à jour de lecture en peu de temps : réessayez dans un instant.';
  end if;

  v_page := least(greatest(coalesce(p_page, 1), 1), p_total);
  insert into public.lectures_livres as r (profil_id, livre_id, derniere_page, page_max, nb_pages, pourcentage, terminee, terminee_le)
  values (
    v_uid, p_livre, v_page, v_page, p_total, round(100.0 * v_page / p_total)::smallint, v_page >= p_total,
    case when v_page >= p_total then now() end
  )
  on conflict (profil_id, livre_id) do update
    set derniere_page = excluded.derniere_page,
        nb_pages = excluded.nb_pages,
        page_max = least(greatest(r.page_max, excluded.derniere_page), excluded.nb_pages),
        terminee = r.terminee or excluded.terminee,
        terminee_le = coalesce(r.terminee_le, excluded.terminee_le),
        pourcentage = case
          when r.terminee or excluded.terminee then 100
          else round(100.0 * least(greatest(r.page_max, excluded.derniere_page), excluded.nb_pages) / excluded.nb_pages)::smallint
        end,
        maj_le = now()
  returning r.* into v_ligne;
  return jsonb_build_object('derniere_page', v_ligne.derniere_page, 'nb_pages', v_ligne.nb_pages, 'pourcentage', v_ligne.pourcentage, 'terminee', v_ligne.terminee);
end;
$$;

-- Note un téléchargement, avant le lien signé : seulement pour un livre téléchargeable, avec l'accès. Limite : 20 par
-- 10 minutes et par compte.
create or replace function public.noter_telechargement(p_livre uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not public.acces_livre(p_livre) then
    raise exception 'Ce livre ne vous est pas ouvert.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.livres l where l.id = p_livre and l.telechargeable) then
    raise exception 'Ce livre se lit dans le site, sans téléchargement.';
  end if;
  if (select count(*) from public.telechargements_livres t where t.profil_id = v_uid and t.telecharge_le > now() - interval '10 minutes') >= 20 then
    raise exception 'Trop de téléchargements en peu de temps : réessayez dans quelques minutes.';
  end if;
  insert into public.telechargements_livres (livre_id, profil_id) values (p_livre, v_uid);
end;
$$;

-- ─── Le back-office ─────────────────────────────────────────────────────────────────────────────────
-- Les livres (tous, ou un seul avec p_livre), avec ce qu'il faut à leur fiche (le chemin du PDF, la case des droits) et
-- leurs chiffres : lectures (comptes qui l'ont ouvert, terminées), téléchargements, sur toute la durée et sur 30 jours,
-- favoris, formations qui le recommandent. L'équipe et les formateurs ne comptent pas (règle des statistiques, 0029).
-- Réservé à l'équipe des contenus.
create or replace function public.livres_back_office(p_livre uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_equipe_admin();
  return (
    with lectures as (
      select r.livre_id,
        count(*) as nombre,
        count(*) filter (where r.terminee) as terminees,
        count(*) filter (where r.maj_le > now() - interval '30 days') as recentes
      from public.lectures_livres r
      where not exists (select 1 from public.roles ro where ro.profil_id = r.profil_id and ro.role <> 'etudiant')
      group by r.livre_id
    ),
    telechargements as (
      select t.livre_id,
        count(*) as nombre,
        count(*) filter (where t.telecharge_le > now() - interval '30 days') as recents
      from public.telechargements_livres t
      where t.profil_id is null or not exists (select 1 from public.roles ro where ro.profil_id = t.profil_id and ro.role <> 'etudiant')
      group by t.livre_id
    )
    select jsonb_build_object(
      'totaux', jsonb_build_object(
        'publies', (select count(*) from public.livres l where l.statut = 'publie'),
        'brouillons', (select count(*) from public.livres l where l.statut = 'brouillon'),
        'archives', (select count(*) from public.livres l where l.statut = 'archive'),
        'lectures', coalesce((select sum(x.nombre) from lectures x), 0),
        'lectures_30j', coalesce((select sum(x.recentes) from lectures x), 0),
        'telechargements', coalesce((select sum(x.nombre) from telechargements x), 0),
        'telechargements_30j', coalesce((select sum(x.recents) from telechargements x), 0)
      ),
      'livres', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', l.id,
          'slug', l.slug,
          'titre', l.titre,
          'auteur', l.auteur,
          'resume', l.resume,
          'langue', l.langue,
          'annee', l.annee,
          'mots_cles', to_jsonb(l.mots_cles),
          'nb_pages', l.nb_pages,
          'categorie', (select jsonb_build_object('id', c.id, 'slug', c.slug, 'nom', c.nom) from public.categories_livres c where c.id = l.categorie_id),
          'parcours', coalesce((
            select jsonb_agg(jsonb_build_object('id', p.id, 'slug', p.slug, 'nom', p.nom, 'nom_court', p.nom_court, 'couleur', p.couleur) order by p.ordre, p.nom)
            from public.livres_parcours lp join public.parcours p on p.id = lp.parcours_id
            where lp.livre_id = l.id
          ), '[]'::jsonb),
          'fichier', l.fichier,
          'taille_octets', l.taille_octets,
          'couverture', l.couverture,
          'acces', l.acces,
          'telechargeable', l.telechargeable,
          'droits_confirmes', l.droits_confirmes,
          'statut', l.statut,
          'cree_le', l.cree_le,
          'modifie_le', l.modifie_le,
          'publie_le', l.publie_le,
          'lectures', coalesce(le.nombre, 0),
          'lectures_terminees', coalesce(le.terminees, 0),
          'lectures_30j', coalesce(le.recentes, 0),
          'telechargements', coalesce(te.nombre, 0),
          'telechargements_30j', coalesce(te.recents, 0),
          'favoris', (select count(*) from public.favoris_livres f where f.livre_id = l.id),
          'formations', (select count(*) from public.livres_formations lf where lf.livre_id = l.id)
        ) order by l.modifie_le desc, l.titre)
        from public.livres l
        left join lectures le on le.livre_id = l.id
        left join telechargements te on te.livre_id = l.id
        where p_livre is null or l.id = p_livre
      ), '[]'::jsonb)
    )
  );
end;
$$;

-- Range une catégorie à un rang (1 = en tête), comme ranger_formation_parcours (0066).
create or replace function public.ranger_categorie_livre(p_categorie uuid, p_position integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_rang integer;
begin
  perform public.exiger_equipe_admin();
  perform 1 from public.categories_livres c for update;
  if not exists (select 1 from public.categories_livres c where c.id = p_categorie) then
    raise exception 'Cette catégorie n’existe plus.';
  end if;
  v_ids := array(select c.id from public.categories_livres c where c.id <> p_categorie order by c.ordre, c.nom);
  v_rang := least(greatest(coalesce(p_position, 1), 1), coalesce(array_length(v_ids, 1), 0) + 1);
  v_ids := v_ids[1:v_rang - 1] || p_categorie || v_ids[v_rang:];
  update public.categories_livres c set ordre = x.rang
  from unnest(v_ids) with ordinality as x (id, rang)
  where c.id = x.id and c.ordre is distinct from x.rang;
end;
$$;

-- Range un livre recommandé à un rang de sa formation.
create or replace function public.ranger_livre_formation(p_formation uuid, p_livre uuid, p_position integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_rang integer;
begin
  perform public.exiger_equipe_admin();
  perform 1 from public.formations f where f.id = p_formation for update;
  if not exists (select 1 from public.livres_formations lf where lf.formation_id = p_formation and lf.livre_id = p_livre) then
    raise exception 'Ce livre n’est pas recommandé par cette formation.';
  end if;
  v_ids := array(
    select lf.livre_id from public.livres_formations lf join public.livres l on l.id = lf.livre_id
    where lf.formation_id = p_formation and lf.livre_id <> p_livre
    order by lf.ordre, l.titre
  );
  v_rang := least(greatest(coalesce(p_position, 1), 1), coalesce(array_length(v_ids, 1), 0) + 1);
  v_ids := v_ids[1:v_rang - 1] || p_livre || v_ids[v_rang:];
  update public.livres_formations lf set ordre = x.rang
  from unnest(v_ids) with ordinality as x (id, rang)
  where lf.formation_id = p_formation and lf.livre_id = x.id and lf.ordre is distinct from x.rang;
end;
$$;

-- ─── Les règles d'accès des tables ──────────────────────────────────────────────────────────────────
alter table public.categories_livres enable row level security;
alter table public.livres enable row level security;
alter table public.livres_parcours enable row level security;
alter table public.livres_formations enable row level security;
alter table public.lectures_livres enable row level security;
alter table public.favoris_livres enable row level security;
alter table public.telechargements_livres enable row level security;
alter table public.debit_lectures enable row level security;

-- Un visiteur n'écrit rien ; personne ne vide une table d'un coup (TRUNCATE ignore les règles d'accès).
revoke insert, update, delete, truncate on public.categories_livres, public.livres, public.livres_parcours, public.livres_formations from anon;
revoke truncate on public.categories_livres, public.livres, public.livres_parcours, public.livres_formations from authenticated;
-- Les lectures : chacun lit les siennes ; seule noter_lecture les écrit.
revoke all on public.lectures_livres from anon;
revoke insert, update, delete, truncate on public.lectures_livres from authenticated;
grant select on public.lectures_livres to authenticated;
-- Les favoris : chacun les siens, ajoutés ou retirés directement.
revoke all on public.favoris_livres from anon;
revoke update, truncate on public.favoris_livres from authenticated;
-- Les téléchargements et le débit : la base seule (noter_telechargement, noter_lecture, livres_back_office).
revoke all on public.telechargements_livres, public.debit_lectures from anon, authenticated;

drop policy if exists "catégories visibles" on public.categories_livres;
create policy "catégories visibles" on public.categories_livres
  for select to anon, authenticated
  using (true);

-- La table des livres (avec le chemin du PDF) n'est lue que par l'équipe ; les fiches publiques passent par les fonctions.
drop policy if exists "livres : l'équipe lit" on public.livres;
create policy "livres : l'équipe lit" on public.livres
  for select to authenticated
  using ((select public.equipe_contenus()));

drop policy if exists "parcours des livres : l'équipe lit" on public.livres_parcours;
create policy "parcours des livres : l'équipe lit" on public.livres_parcours
  for select to authenticated
  using ((select public.equipe_contenus()));

drop policy if exists "livres recommandés : l'équipe lit" on public.livres_formations;
create policy "livres recommandés : l'équipe lit" on public.livres_formations
  for select to authenticated
  using ((select public.equipe_contenus()));

-- Écriture : l'équipe des contenus, une règle par action (comme la 0004).
do $$
declare
  t text;
begin
  foreach t in array array['categories_livres', 'livres', 'livres_parcours', 'livres_formations'] loop
    execute format('drop policy if exists %I on public.%I', 'l''équipe ajoute', t);
    execute format('drop policy if exists %I on public.%I', 'l''équipe modifie', t);
    execute format('drop policy if exists %I on public.%I', 'l''équipe supprime', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select public.equipe_contenus())) with check ((select public.equipe_contenus()))',
      'l''équipe modifie', t
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select public.equipe_contenus()))',
      'l''équipe supprime', t
    );
  end loop;
  foreach t in array array['categories_livres', 'livres', 'livres_parcours'] loop
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select public.equipe_contenus()))',
      'l''équipe ajoute', t
    );
  end loop;
end;
$$;
-- Une formation ne recommande qu'un livre publié (un lien reste si le livre est archivé ensuite).
create policy "l'équipe ajoute" on public.livres_formations
  for insert to authenticated
  with check ((select public.equipe_contenus()) and public.livre_publie(livre_id));

drop policy if exists "ses lectures : lecture" on public.lectures_livres;
create policy "ses lectures : lecture" on public.lectures_livres
  for select to authenticated
  using (profil_id = (select auth.uid()));

drop policy if exists "ses favoris de livres : lecture" on public.favoris_livres;
create policy "ses favoris de livres : lecture" on public.favoris_livres
  for select to authenticated
  using (profil_id = (select auth.uid()));

-- On n'ajoute qu'un livre publié ; un favori reste en place si le livre est archivé ensuite.
drop policy if exists "ses favoris de livres : ajout" on public.favoris_livres;
create policy "ses favoris de livres : ajout" on public.favoris_livres
  for insert to authenticated
  with check (profil_id = (select auth.uid()) and public.livre_publie(livre_id));

drop policy if exists "ses favoris de livres : suppression" on public.favoris_livres;
create policy "ses favoris de livres : suppression" on public.favoris_livres
  for delete to authenticated
  using (profil_id = (select auth.uid()));

-- Un compte suspendu : ni lecture ni écriture de ses lectures et favoris (règle restrictive, comme la 0013).
do $$
declare
  t text;
begin
  foreach t in array array['lectures_livres', 'favoris_livres'] loop
    execute format('drop policy if exists %I on public.%I', 'compte suspendu : rien', t);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated
         using (not (select public.compte_suspendu())) with check (not (select public.compte_suspendu()))',
      'compte suspendu : rien', t
    );
  end loop;
end;
$$;

-- ─── Les fichiers des livres : espace privé, 50 Mo, PDF seulement ──────────────────────────────────
-- Jamais d'adresse publique : chaque lecture passe par un lien signé de courte durée, accordé selon acces_livre (le
-- chemin vient de chemin_livre). Dépôt, remplacement et suppression : l'équipe des contenus, dans le dossier d'un
-- livre (<uuid>/<uuid>.pdf ; le livre peut ne pas exister encore : le navigateur dépose avant d'enregistrer).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bibliotheque', 'bibliotheque', false, 52428800, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "bibliotheque : lecture avec l'accès au livre" on storage.objects;
create policy "bibliotheque : lecture avec l'accès au livre" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'bibliotheque' and ((select public.equipe_contenus()) or public.acces_fichier_livre(name)));

drop policy if exists "bibliotheque : l'équipe dépose" on storage.objects;
create policy "bibliotheque : l'équipe dépose" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'bibliotheque'
    and (select public.equipe_contenus())
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
  );

drop policy if exists "bibliotheque : l'équipe remplace" on storage.objects;
create policy "bibliotheque : l'équipe remplace" on storage.objects
  for update to authenticated
  using (bucket_id = 'bibliotheque' and (select public.equipe_contenus()))
  with check (
    bucket_id = 'bibliotheque'
    and (select public.equipe_contenus())
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
  );

drop policy if exists "bibliotheque : l'équipe supprime" on storage.objects;
create policy "bibliotheque : l'équipe supprime" on storage.objects
  for delete to authenticated
  using (bucket_id = 'bibliotheque' and (select public.equipe_contenus()));

-- ─── Les couvertures des livres : l'espace public « couvertures » (0012), sous livres/<id>/ ─────────
-- Les règles de la 0012 n'acceptent que le dossier d'une formation : ces deux règles ajoutent celui des livres (les
-- règles s'additionnent). La liste et la suppression sont déjà à l'équipe (0012) ; 5 Mo, JPEG, PNG ou WebP (0012).
drop policy if exists "couvertures : l'équipe dépose (livres)" on storage.objects;
create policy "couvertures : l'équipe dépose (livres)" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'couvertures'
    and (select public.equipe_contenus())
    and name ~ '^livres/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
  );

drop policy if exists "couvertures : l'équipe remplace (livres)" on storage.objects;
create policy "couvertures : l'équipe remplace (livres)" on storage.objects
  for update to authenticated
  using (bucket_id = 'couvertures' and (select public.equipe_contenus()))
  with check (
    bucket_id = 'couvertures'
    and (select public.equipe_contenus())
    and name ~ '^livres/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
  );

-- ─── Droits ─────────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public.livres_regles() from public, anon, authenticated;
revoke execute on function public.libelle_statut_livre(text) from public, anon, authenticated;
revoke execute on function public.journal_livres() from public, anon, authenticated;
revoke execute on function public.acces_livre(uuid) from public, anon, authenticated;
revoke execute on function public.livre_publie(uuid) from public, anon, authenticated;
revoke execute on function public.acces_fichier_livre(text) from public, anon, authenticated;
revoke execute on function public.chemin_livre(uuid) from public, anon, authenticated;
revoke execute on function public.etat_acces_livre(public.livres) from public, anon, authenticated;
revoke execute on function public.carte_livre(public.livres) from public, anon, authenticated;
revoke execute on function public.bibliotheque_catalogue(text, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.livre_fiche(text) from public, anon, authenticated;
revoke execute on function public.mes_lectures(integer) from public, anon, authenticated;
revoke execute on function public.mes_favoris_livres() from public, anon, authenticated;
revoke execute on function public.livres_formation(uuid) from public, anon, authenticated;
revoke execute on function public.noter_lecture(uuid, integer, integer) from public, anon, authenticated;
revoke execute on function public.noter_telechargement(uuid) from public, anon, authenticated;
revoke execute on function public.livres_back_office(uuid) from public, anon, authenticated;
revoke execute on function public.ranger_categorie_livre(uuid, integer) from public, anon, authenticated;
revoke execute on function public.ranger_livre_formation(uuid, uuid, integer) from public, anon, authenticated;

-- Les règles des tables et des fichiers les appellent aussi pour un visiteur.
grant execute on function public.acces_livre(uuid) to anon, authenticated;
grant execute on function public.acces_fichier_livre(text) to anon, authenticated;
grant execute on function public.livre_publie(uuid) to authenticated;
-- Le catalogue public : visiteurs compris.
grant execute on function public.bibliotheque_catalogue(text, text, text, boolean) to anon, authenticated;
grant execute on function public.livre_fiche(text) to anon, authenticated;
grant execute on function public.livres_formation(uuid) to anon, authenticated;
grant execute on function public.mes_lectures(integer) to anon, authenticated;
grant execute on function public.mes_favoris_livres() to anon, authenticated;
-- Le compte connecté.
grant execute on function public.chemin_livre(uuid) to authenticated;
grant execute on function public.noter_lecture(uuid, integer, integer) to authenticated;
grant execute on function public.noter_telechargement(uuid) to authenticated;
-- L'équipe des contenus (la fonction le revérifie).
grant execute on function public.livres_back_office(uuid) to authenticated;
grant execute on function public.ranger_categorie_livre(uuid, integer) to authenticated;
grant execute on function public.ranger_livre_formation(uuid, uuid, integer) to authenticated;

commit;
