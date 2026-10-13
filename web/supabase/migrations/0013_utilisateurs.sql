-- Étudium · migration 0013 : page Utilisateurs du back-office (spec des utilisateurs et des rôles, 13 octobre 2026).
-- À appliquer dans Supabase, après la 0012 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancé sur une base qui l'a déjà, il ne change rien et ne casse rien.

begin;

-- ─── Suspension d'un compte ─────────────────────────────────────────────────────────────────────────
-- Une ligne par compte suspendu : depuis quand, par qui, pourquoi (motif visible de l'équipe seulement).
-- Aucune règle d'accès : la table n'est lue et écrite que par les fonctions ci-dessous.
create table if not exists public.suspensions (
  profil_id uuid primary key references public.profils (id) on delete cascade,
  depuis timestamptz not null default now(),
  par uuid references public.profils (id) on delete set null,
  motif text not null default '',
  constraint suspensions_motif_longueur check (char_length(motif) <= 500)
);
alter table public.suspensions enable row level security;
revoke all on public.suspensions from anon, authenticated;

-- Le compte qui fait la requête est-il suspendu ? (Un visiteur ne l'est jamais.)
create or replace function public.compte_suspendu()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.suspensions where profil_id = (select auth.uid()));
$$;
grant execute on function public.compte_suspendu() to anon, authenticated;

-- ─── Un compte suspendu perd tous ses droits ────────────────────────────────────────────────────────
-- Les fonctions de droits sont redéfinies à l'identique, avec la condition « pas suspendu » en tête.

-- Rôles (0001) : un compte suspendu n'en a plus aucun.
create or replace function public.a_role(r public.role_etudium)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not public.compte_suspendu() and exists (
    select 1 from public.roles
    where profil_id = (select auth.uid()) and role = r
  );
$$;

-- Équipe des contenus (0004) : back-office, contenus, couvertures, ressources.
create or replace function public.equipe_contenus()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not public.compte_suspendu() and exists (
    select 1 from public.roles
    where profil_id = (select auth.uid()) and role in ('admin', 'moderateur', 'super_admin')
  );
$$;

-- Accès à une leçon (0004) : aucune pour un compte suspendu, pas même les aperçus. La progression et le visionnage
-- (0007, 0008) passent par cette fonction : ils sont refusés eux aussi.
create or replace function public.acces_lecon(p_lecon uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not public.compte_suspendu() and (
    public.equipe_contenus() or exists (
      select 1
      from public.lecons l
      join public.modules m on m.id = l.module_id
      join public.formations f on f.id = m.formation_id
      where l.id = p_lecon
        and f.statut = 'publiee'
        and (l.apercu or (f.gratuite and (select auth.uid()) is not null))
    )
  );
$$;

-- Avis (0010) : ni en donner, ni en supprimer.
create or replace function public.peut_donner_avis(p_formation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and not public.compte_suspendu()
    and exists (select 1 from public.formations f where f.id = p_formation and f.statut = 'publiee')
    and (
      select count(*) > 0 and count(p.terminee_le) * 2 >= count(*)
      from public.lecons l
      join public.modules m on m.id = l.module_id
      left join public.progression_lecons p on p.lecon_id = l.id and p.profil_id = (select auth.uid())
      where m.formation_id = p_formation
    );
$$;

create or replace function public.supprimer_avis(p_formation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.compte_suspendu() then
    raise exception 'Ce compte est suspendu.' using errcode = '42501';
  end if;
  delete from public.avis where profil_id = (select auth.uid()) and formation_id = p_formation;
end;
$$;

-- Ses propres données : ni lecture ni écriture. Ces règles « restrictives » s'ajoutent aux règles existantes
-- (elles doivent toutes deux être vraies) sans les réécrire. Elles ne visent que le compte qui demande :
-- l'équipe lit toujours le profil d'un compte suspendu.
do $$
declare
  t text;
begin
  foreach t in array array['profils', 'notes_lecons', 'favoris', 'avis', 'progression_lecons'] loop
    execute format('drop policy if exists %I on public.%I', 'compte suspendu : rien', t);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated
         using (not (select public.compte_suspendu())) with check (not (select public.compte_suspendu()))',
      'compte suspendu : rien', t
    );
  end loop;
end;
$$;

-- ─── Suspendre et réactiver ─────────────────────────────────────────────────────────────────────────
-- Un admin ou le super admin, pour un étudiant ou un formateur ; le super admin seul pour un membre de l'équipe.
-- Personne ne se suspend soi-même ; un compte super admin ne se suspend pas (retirer d'abord son rôle).
-- Suspendre un compte déjà suspendu ne change rien (date, auteur et motif d'origine gardés).
create or replace function public.suspendre_compte(p_compte uuid, p_motif text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.a_role('admin') or public.a_role('super_admin')) then
    raise exception 'Seuls un admin ou le super admin suspendent un compte.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profils where id = p_compte) then
    raise exception 'Compte introuvable.';
  end if;
  if p_compte = (select auth.uid()) then
    raise exception 'Vous ne pouvez pas suspendre votre propre compte.';
  end if;
  if exists (select 1 from public.roles where profil_id = p_compte and role = 'super_admin') then
    raise exception 'Retirez d’abord le rôle super admin de ce compte.';
  end if;
  if exists (select 1 from public.roles where profil_id = p_compte and role in ('moderateur', 'admin'))
     and not public.a_role('super_admin') then
    raise exception 'Seul le super admin suspend un membre de l’équipe.';
  end if;
  insert into public.suspensions (profil_id, par, motif)
  values (p_compte, (select auth.uid()), left(regexp_replace(coalesce(p_motif, ''), '^\s+|\s+$', '', 'g'), 500))
  on conflict (profil_id) do nothing;
end;
$$;

create or replace function public.reactiver_compte(p_compte uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.a_role('admin') or public.a_role('super_admin')) then
    raise exception 'Seuls un admin ou le super admin réactivent un compte.' using errcode = '42501';
  end if;
  if exists (select 1 from public.roles where profil_id = p_compte and role in ('moderateur', 'admin', 'super_admin'))
     and not public.a_role('super_admin') then
    raise exception 'Seul le super admin réactive un membre de l’équipe.';
  end if;
  delete from public.suspensions where profil_id = p_compte;
end;
$$;

revoke execute on function public.suspendre_compte(uuid, text) from public, anon;
revoke execute on function public.reactiver_compte(uuid) from public, anon;
grant execute on function public.suspendre_compte(uuid, text) to authenticated;
grant execute on function public.reactiver_compte(uuid) to authenticated;

-- ─── Lire les comptes (équipe du back-office) ───────────────────────────────────────────────────────
-- L'adresse e-mail et la dernière connexion sont dans l'authentification de Supabase, que l'application ne lit pas :
-- ces fonctions les lisent pour l'équipe seulement.

-- Minuscules et sans accents, pour chercher « Fifamè » en tapant « fifame ».
create or replace function public.sans_accents(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(translate(
    coalesce(t, ''),
    'àâäáãåéèêëíìîïóòôöõúùûüçñÿÀÂÄÁÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÇÑŸ',
    'aaaaaaeeeeiiiiooooouuuucnyAAAAAAEEEEIIIIOOOOOUUUUCNY'
  ));
$$;

-- Une page de 25 comptes, les plus récents d'abord, et le nombre total. Recherche dans le nom (sans accents ni
-- majuscules) ou l'adresse e-mail, par simple inclusion (strpos : « % » ou « _ » ne sont jamais des jokers).
-- Filtres : etudiants (aucun autre rôle), formateurs, equipe, suspendus ; toute autre valeur : tous.
create or replace function public.comptes_equipe(p_recherche text default '', p_filtre text default 'tous', p_page integer default 1)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := public.sans_accents(btrim(coalesce(p_recherche, '')));
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_resultat jsonb;
begin
  if not public.equipe_contenus() then
    raise exception 'Accès réservé à l’équipe.' using errcode = '42501';
  end if;

  with comptes as (
    select
      p.id, p.prenom, p.nom, coalesce(u.email, '') as email, p.cree_le, u.last_sign_in_at,
      coalesce((select array_agg(r.role order by r.role) from public.roles r where r.profil_id = p.id), '{}') as roles,
      exists (select 1 from public.suspensions s where s.profil_id = p.id) as suspendu
    from public.profils p
    left join auth.users u on u.id = p.id
  ),
  retenus as (
    select * from comptes c
    where (v_q = '' or strpos(public.sans_accents(c.prenom || ' ' || c.nom), v_q) > 0 or strpos(lower(c.email), v_q) > 0)
      and case p_filtre
        when 'etudiants' then not (c.roles && array['formateur', 'moderateur', 'admin', 'super_admin']::public.role_etudium[])
        when 'formateurs' then 'formateur' = any (c.roles)
        when 'equipe' then c.roles && array['moderateur', 'admin', 'super_admin']::public.role_etudium[]
        when 'suspendus' then c.suspendu
        else true
      end
  ),
  page as (
    select * from retenus order by cree_le desc, id limit 25 offset (v_page - 1) * 25
  )
  select jsonb_build_object(
    'total', (select count(*) from retenus),
    'comptes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'prenom', g.prenom,
        'nom', g.nom,
        'email', g.email,
        'roles', to_jsonb(g.roles::text[]),
        'inscrit_le', g.cree_le,
        'derniere_connexion', g.last_sign_in_at,
        'suspendu', g.suspendu
      ) order by g.cree_le desc, g.id)
      from page g
    ), '[]'::jsonb)
  ) into v_resultat;
  return v_resultat;
end;
$$;

-- La fiche d'un compte : identité, rôles, suspension, fiche formateur reliée, formations suivies (au moins une
-- leçon ouverte) et avis laissés. Null si le compte n'existe pas.
create or replace function public.compte_equipe(p_compte uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_resultat jsonb;
begin
  if not public.equipe_contenus() then
    raise exception 'Accès réservé à l’équipe.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', p.id,
    'prenom', p.prenom,
    'nom', p.nom,
    'email', coalesce(u.email, ''),
    'inscrit_le', p.cree_le,
    'derniere_connexion', u.last_sign_in_at,
    'roles', to_jsonb(coalesce((select array_agg(r.role order by r.role) from public.roles r where r.profil_id = p.id), '{}')::text[]),
    'suspension', (
      select jsonb_build_object('depuis', s.depuis, 'par_nom', coalesce(btrim(a.prenom || ' ' || a.nom), ''), 'motif', s.motif)
      from public.suspensions s
      left join public.profils a on a.id = s.par
      where s.profil_id = p.id
    ),
    'fiche_formateur', (select jsonb_build_object('id', f.id, 'nom', f.nom) from public.formateurs f where f.compte_id = p.id),
    'formations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'titre', t.titre, 'slug', t.slug, 'terminees', t.terminees, 'total', t.total, 'derniere_activite', t.derniere_activite
      ) order by t.derniere_activite desc)
      from (
        select
          fo.id, fo.titre, fo.slug,
          count(pl.terminee_le) as terminees,
          (select count(*) from public.lecons l2 join public.modules m2 on m2.id = l2.module_id where m2.formation_id = fo.id) as total,
          max(greatest(pl.vue_le, pl.terminee_le, pl.dernier_envoi)) as derniere_activite
        from public.progression_lecons pl
        join public.lecons l on l.id = pl.lecon_id
        join public.modules m on m.id = l.module_id
        join public.formations fo on fo.id = m.formation_id
        where pl.profil_id = p.id
        group by fo.id
      ) t
    ), '[]'::jsonb),
    'avis', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', av.id, 'formation_titre', fo.titre, 'note', av.note, 'commentaire', av.commentaire, 'masque', av.masque, 'cree_le', av.cree_le
      ) order by av.cree_le desc)
      from public.avis av
      join public.formations fo on fo.id = av.formation_id
      where av.profil_id = p.id
    ), '[]'::jsonb)
  ) into v_resultat
  from public.profils p
  left join auth.users u on u.id = p.id
  where p.id = p_compte;
  return v_resultat;
end;
$$;

-- ─── Changer les rôles d'un compte (super admin seul) ───────────────────────────────────────────────
-- Une fiche formateur n'est reliée qu'à un compte.
create unique index if not exists formateurs_compte_unique on public.formateurs (compte_id) where compte_id is not null;

-- D'un seul coup : les rôles voulus (Étudiant toujours gardé) et, pour Formateur, la fiche reliée (existante libre,
-- ou créée à son nom). Retirer Formateur détache la fiche, qui reste avec ses formations.
create or replace function public.changer_roles(
  p_compte uuid,
  p_roles public.role_etudium[],
  p_fiche uuid default null,
  p_nouvelle_fiche boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prenom text;
  v_nom text;
  v_roles public.role_etudium[];
  v_actuels public.role_etudium[];
begin
  if not public.a_role('super_admin') then
    raise exception 'Seul le super admin change les rôles.' using errcode = '42501';
  end if;
  select prenom, nom into v_prenom, v_nom from public.profils where id = p_compte;
  if not found then
    raise exception 'Compte introuvable.';
  end if;

  select coalesce(array_agg(distinct r), '{}') into v_roles from unnest(coalesce(p_roles, '{}') || 'etudiant'::public.role_etudium) r;
  select coalesce(array_agg(role), '{}') into v_actuels from public.roles where profil_id = p_compte;

  if p_compte = (select auth.uid()) and not ('super_admin' = any (v_roles)) then
    raise exception 'Vous ne pouvez pas vous retirer le rôle super admin.';
  end if;
  if exists (select 1 from public.suspensions where profil_id = p_compte)
     and not (array_remove(v_roles, 'etudiant') <@ v_actuels) then
    raise exception 'Réactivez le compte avant de lui donner un rôle.';
  end if;

  if 'formateur' = any (v_roles) then
    if not exists (select 1 from public.formateurs where compte_id = p_compte) then
      if p_nouvelle_fiche then
        insert into public.formateurs (nom, compte_id)
        values (left(coalesce(nullif(btrim(v_prenom || ' ' || v_nom), ''), 'Formateur'), 80), p_compte);
      elsif p_fiche is not null then
        update public.formateurs set compte_id = p_compte where id = p_fiche and compte_id is null;
        if not found then
          raise exception 'Cette fiche formateur n’existe plus ou est déjà reliée à un compte.';
        end if;
      else
        raise exception 'Choisissez la fiche formateur de ce compte.';
      end if;
    end if;
  else
    update public.formateurs set compte_id = null where compte_id = p_compte;
  end if;

  delete from public.roles where profil_id = p_compte and not (role = any (v_roles));
  insert into public.roles (profil_id, role) select p_compte, r from unnest(v_roles) r on conflict do nothing;
end;
$$;

revoke execute on function public.comptes_equipe(text, text, integer) from public, anon;
revoke execute on function public.compte_equipe(uuid) from public, anon;
revoke execute on function public.changer_roles(uuid, public.role_etudium[], uuid, boolean) from public, anon;
grant execute on function public.comptes_equipe(text, text, integer) to authenticated;
grant execute on function public.compte_equipe(uuid) to authenticated;
grant execute on function public.changer_roles(uuid, public.role_etudium[], uuid, boolean) to authenticated;

commit;
