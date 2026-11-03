-- Étudium · base de production · partie 5 sur 5 (migrations 0069 à 0073).
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

-- ─── Droits ─────────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public.remise_code(text, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.codes_promo_equipe() from public, anon, authenticated;
revoke execute on function public.enregistrer_code_promo(uuid, text, text, integer, timestamptz, timestamptz, integer, boolean, uuid[]) from public, anon, authenticated;

grant execute on function public.codes_promo_equipe() to authenticated;
grant execute on function public.enregistrer_code_promo(uuid, text, text, integer, timestamptz, timestamptz, integer, boolean, uuid[]) to authenticated;

commit;
