-- Migration 0069 : l'inscription aux formations (spec du 2 novembre 2026, §2 et décisions §9).
--   - inscriptions_formations : une ligne par compte et par formation. Chacun lit les siennes, l'équipe des contenus
--     toutes ; personne ne les écrit directement : seule s_inscrire_formation les crée ;
--   - formation_ouverte : la règle d'accès d'avant au niveau de la formation, sans l'inscription (équipe des contenus,
--     formateur de la formation ; sinon formation publiée, et gratuite pour un compte connecté ou abonnement actif). Sert
--     au bouton « S'inscrire à ce cours » / « Voir les abonnements » ;
--   - s_inscrire_formation : inscrit le compte connecté, non suspendu, sans le rôle formateur, à une formation publiée
--     qui lui est ouverte. Rejouable : déjà inscrit, rien ne change. inscrit_formation : l'est-il ?
--   - acces_lecon : pour l'étudiant, une leçon qui n'est pas un aperçu exige en plus l'inscription. Les aperçus restent
--     ouverts comme avant (visiteurs compris) ; l'équipe des contenus et le formateur de la formation ne changent pas.
--     À la fin d'un abonnement, l'inscription reste et les leçons payantes se ferment comme avant ;
--   - apprenants_formations : le nombre d'inscrits de chaque formation publiée, lisible par tous (visiteurs compris) ;
--   - la messagerie suit l'inscription (et non plus une leçon ouverte) : suit_formation_de, formation_commune et
--     contacts_messagerie. Un aperçu ouvert ne suffit plus pour écrire au formateur.
-- Rattrapage : chaque compte qui a déjà une progression ou un certificat dans une formation y est inscrit, à la date de sa
-- première leçon ouverte (ou de son certificat). Personne ne perd l'accès. Il n'a lieu qu'à la première application :
-- rejoué plus tard, il inscrirait aussi qui n'a ouvert qu'un aperçu depuis.
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
create or replace function public.apprenants_formations()
returns table (formation_id uuid, apprenants integer)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id, count(i.profil_id)::integer
  from public.formations f
  left join public.inscriptions_formations i on i.formation_id = f.id
  where f.statut = 'publiee'
  group by f.id;
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
-- À la date de sa première leçon ouverte, ou de son certificat s'il est plus ancien. À la première application
-- seulement ; une inscription existante ne change pas.
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
      select c.profil_id, c.formation_id, c.cree_le
      from public.certificats c
      where c.profil_id is not null and c.formation_id is not null
    ) x
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
revoke execute on function public.suit_formation_de(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.formation_commune(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.contacts_messagerie(text, text) from public, anon;
grant execute on function public.formation_ouverte(uuid) to anon, authenticated;
grant execute on function public.s_inscrire_formation(uuid) to authenticated;
grant execute on function public.inscrit_formation(uuid) to anon, authenticated;
grant execute on function public.apprenants_formations() to anon, authenticated;
grant execute on function public.contacts_messagerie(text, text) to authenticated;

commit;
