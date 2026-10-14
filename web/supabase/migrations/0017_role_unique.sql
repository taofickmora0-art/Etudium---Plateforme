-- Étudium · migration 0017 : un seul rôle en plus d'étudiant (décision du 14 octobre 2026).
-- Deux espaces au plus : étudiant et formateur, ou étudiant et back-office. L'équipe gère déjà les formations de tous
-- les formateurs : un compte de l'équipe n'est jamais formateur. Donner le rôle Formateur crée sa fiche formateur, ou
-- lui rend la sienne : plus jamais de fiche à choisir.
-- À appliquer dans Supabase, après la 0016 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancé sur une base qui l'a déjà, il ne change rien et ne casse rien. Si une migration plus ancienne
-- est rejouée un jour (0013 surtout), rejouer celle-ci ensuite.

begin;

-- ─── La fiche garde le compte qui l'a eue ───────────────────────────────────────────────────────────
-- Un compte qui perd le rôle Formateur est détaché de sa fiche (ses formations y restent) ; s'il redevient formateur,
-- il la retrouve. Aucun droit pour les comptes sur cette colonne (0013 n'accorde que nom, titre, domaine…).
alter table public.formateurs add column if not exists compte_precedent uuid references public.profils (id) on delete set null;

-- ─── Remise en ordre des comptes existants ──────────────────────────────────────────────────────────
-- Un compte qui a plusieurs rôles en plus d'étudiant garde le plus élevé (ordre du type : formateur, modérateur, admin,
-- super admin) : formateur et admin → admin ; admin et modérateur → admin. Celui qui perd Formateur est détaché de sa
-- fiche, gardée pour la lui rendre.
update public.formateurs f
set compte_precedent = f.compte_id, compte_id = null
where f.compte_id in (select profil_id from public.roles where role in ('moderateur', 'admin', 'super_admin'));

delete from public.roles r
where r.role <> 'etudiant'
  and exists (select 1 from public.roles e where e.profil_id = r.profil_id and e.role > r.role);

-- Chaque formateur a sa fiche, à son nom.
insert into public.formateurs (nom, compte_id)
select left(coalesce(nullif(btrim(coalesce(p.prenom, '') || ' ' || coalesce(p.nom, '')), ''), 'Formateur'), 80), p.id
from public.roles r
join public.profils p on p.id = r.profil_id
where r.role = 'formateur' and not exists (select 1 from public.formateurs f where f.compte_id = p.id);

-- ─── Un seul rôle en plus d'étudiant, vérifié par la base ───────────────────────────────────────────
-- Même une insertion directe (éditeur SQL) est refusée.
create or replace function public.roles_un_seul()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role <> 'etudiant' and exists (
    select 1 from public.roles
    where profil_id = new.profil_id
      and role <> 'etudiant'
      and role <> new.role
      and (tg_op = 'INSERT' or role <> old.role)
  ) then
    raise exception 'Un compte n’a qu’un rôle en plus d’étudiant : formateur, ou un rôle de l’équipe.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists roles_un_seul on public.roles;
create trigger roles_un_seul
  before insert or update on public.roles
  for each row execute function public.roles_un_seul();

-- ─── Changer le rôle d'un compte (super admin seul) ─────────────────────────────────────────────────
-- Remplace changer_roles (0013) : un seul rôle, et la fiche formateur suit toute seule.
drop function if exists public.changer_roles(uuid, public.role_etudium[], uuid, boolean);

create or replace function public.changer_role(p_compte uuid, p_role public.role_etudium)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prenom text;
  v_nom text;
  v_actuel public.role_etudium;
  v_equipe constant public.role_etudium[] := array['moderateur', 'admin', 'super_admin']::public.role_etudium[];
begin
  if not public.a_role('super_admin') then
    raise exception 'Seul le super admin change les rôles.' using errcode = '42501';
  end if;
  select prenom, nom into v_prenom, v_nom from public.profils where id = p_compte;
  if not found then
    raise exception 'Compte introuvable.';
  end if;
  if p_role is null then
    raise exception 'Choisissez un rôle.';
  end if;

  select coalesce(max(role), 'etudiant') into v_actuel from public.roles where profil_id = p_compte and role <> 'etudiant';
  if v_actuel = p_role then
    return;
  end if;
  if p_compte = (select auth.uid()) and v_actuel = 'super_admin' then
    raise exception 'Vous ne pouvez pas vous retirer le rôle super admin.';
  end if;
  if p_role <> 'etudiant' and exists (select 1 from public.suspensions where profil_id = p_compte) then
    raise exception 'Réactivez le compte avant de lui donner un rôle.';
  end if;

  if v_actuel = any (v_equipe) and p_role = any (v_equipe) then
    -- D'un rôle d'équipe à un autre : le même espace, aucune notification « Vous faites partie de l’équipe ».
    update public.roles set role = p_role where profil_id = p_compte and role = v_actuel;
    return;
  end if;

  if v_actuel = 'formateur' then
    update public.formateurs set compte_precedent = compte_id, compte_id = null where compte_id = p_compte;
  end if;
  delete from public.roles where profil_id = p_compte and role <> 'etudiant';
  insert into public.roles (profil_id, role) values (p_compte, 'etudiant') on conflict do nothing;
  if p_role <> 'etudiant' then
    insert into public.roles (profil_id, role) values (p_compte, p_role);
  end if;

  -- Formateur : sa fiche d'avant s'il en a eu une, sinon une fiche à son nom.
  if p_role = 'formateur' and not exists (select 1 from public.formateurs where compte_id = p_compte) then
    update public.formateurs set compte_id = p_compte, compte_precedent = null
    where id = (select id from public.formateurs where compte_precedent = p_compte order by modifie_le desc limit 1);
    if not found then
      insert into public.formateurs (nom, compte_id)
      values (left(coalesce(nullif(btrim(coalesce(v_prenom, '') || ' ' || coalesce(v_nom, '')), ''), 'Formateur'), 80), p_compte);
    end if;
  end if;
end;
$$;

revoke execute on function public.roles_un_seul() from public, anon, authenticated;
revoke execute on function public.changer_role(uuid, public.role_etudium) from public, anon;
grant execute on function public.changer_role(uuid, public.role_etudium) to authenticated;

commit;
