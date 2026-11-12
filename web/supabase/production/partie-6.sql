-- Étudium · base de production · partie 6 sur 6 (migrations 0078 à 0081).
-- Fichier produit par scripts/assembler-migrations.mjs : ne pas le modifier à la main.
-- Supabase › SQL Editor › New query : colle tout ce fichier, puis Run. Attends « Success » avant la partie suivante.
-- C'était la dernière partie : reprends le guide « Mise en ligne ».

-- ═══ 0078_blocage_et_parcours.sql ═══
-- Migration 0078 (tes décisions du 5 novembre 2026) :
--   1. Le blocage du code de « Mes résultats » s'allonge.
--      - 5 codes faux : bloqué 15 minutes ; 5 de plus : 1 heure ; puis 24 heures à chaque fois.
--      - Le bon code remet le compte à zéro, comme un nouveau code ou un code retiré (ou oublié).
--      - Pendant un blocage, le message dit le temps qui reste, en minutes, puis en heures au-delà d'une heure.
--   2. Trois parcours : Réussite académique, Compétences digitales, Entrepreneuriat.
--      - Compétences digitales reprend le contenu de Business & revenus en ligne : ses formations (à la suite des
--        siennes), ses livres et ses sessions.
--      - La place de Business (sa ligne, sa couleur orange, son groupe et son espace de la communauté, avec leurs
--        messages) devient Entrepreneuriat. Rien n'est supprimé.
--      - « Compétences à vendre » (0048) : la formation qui apprend à vendre une compétence est dans Compétences
--        digitales ou Entrepreneuriat ; la compétence, toujours dans Compétences digitales.
--   3. Une formation sans formateur est présentée par l'Équipe Étudium (son profil : /formateurs/etudium).
-- À appliquer après la 0077. Rejouable.

begin;

-- Le nombre de blocages depuis le dernier bon code.
alter table public.verrou_resultats add column if not exists blocages integer not null default 0;

-- Un nouveau code (créé, retiré, oublié) repart de zéro.
create or replace function public.remettre_blocages_resultats()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.empreinte is distinct from old.empreinte then
    new.blocages := 0;
  end if;
  return new;
end;
$$;

drop trigger if exists remettre_blocages_resultats on public.verrou_resultats;
create trigger remettre_blocages_resultats before update on public.verrou_resultats for each row execute function public.remettre_blocages_resultats();

-- « 12 minutes », « 1 heure », « 24 heures » : le temps qui reste avant `fin`.
create or replace function public.attente_resultats(fin timestamptz)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  minutes integer := greatest(1, ceil(extract(epoch from fin - now()) / 60)::integer);
  heures integer;
begin
  if minutes < 60 then
    return minutes || case when minutes > 1 then ' minutes' else ' minute' end;
  end if;
  heures := ceil(minutes / 60.0)::integer;
  return heures || case when heures > 1 then ' heures' else ' heure' end;
end;
$$;

-- Vérifie le code (ouvrir, changer, retirer) : le résultat est rendu, jamais levé, pour que l'erreur comptée reste.
create or replace function public.verifier_pin_resultats(p_pin text, p_quoi text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.verrou_resultats%rowtype;
  restants integer;
  duree interval;
begin
  select * into v from public.verrou_resultats where profil_id = (select auth.uid()) for update;
  if not found or v.empreinte is null then
    return jsonb_build_object('ok', true);
  end if;
  if v.bloque_jusqua is not null and v.bloque_jusqua > now() then
    return jsonb_build_object('ok', false, 'message', 'Trop d’essais : réessaie dans ' || public.attente_resultats(v.bloque_jusqua) || '.');
  end if;
  if coalesce(p_pin, '') ~ '^[0-9]{4}$' and public.empreinte_pin_resultats(v.sel, p_pin) = v.empreinte then
    update public.verrou_resultats set echecs = 0, blocages = 0, bloque_jusqua = null where profil_id = v.profil_id;
    return jsonb_build_object('ok', true);
  end if;
  if v.echecs + 1 >= 5 then
    duree := case v.blocages when 0 then interval '15 minutes' when 1 then interval '1 hour' else interval '24 hours' end;
    update public.verrou_resultats set echecs = 0, blocages = v.blocages + 1, bloque_jusqua = now() + duree where profil_id = v.profil_id;
    return jsonb_build_object('ok', false, 'message', 'Trop d’essais : réessaie dans ' || public.attente_resultats(now() + duree) || '.');
  end if;
  update public.verrou_resultats set echecs = v.echecs + 1 where profil_id = v.profil_id;
  restants := 5 - (v.echecs + 1);
  return jsonb_build_object('ok', false, 'message', p_quoi || ' incorrect. Encore ' || restants || case when restants > 1 then ' essais.' else ' essai.' end);
end;
$$;

revoke execute on function public.remettre_blocages_resultats() from public, anon, authenticated;
revoke execute on function public.attente_resultats(timestamptz) from public, anon, authenticated;
revoke execute on function public.verifier_pin_resultats(text, text) from public, anon, authenticated;


-- ─── 2. Les trois parcours ──────────────────────────────────────────────────────────────────────────
do $$
declare
  v_digital uuid := (select p.id from public.parcours p where p.slug = 'competences-digitales');
  v_business uuid := (select p.id from public.parcours p where p.slug = 'business-revenus-en-ligne');
  v_suite integer;
begin
  -- Déjà fait (Business est devenu Entrepreneuriat), ou base sans ces parcours : rien à faire.
  if v_digital is null or v_business is null then
    return;
  end if;
  -- Les formations de Business, à la suite de celles de Compétences digitales (une seule fois si elle y était déjà).
  v_suite := (select coalesce(max(fp.ordre), 0) from public.formations_parcours fp where fp.parcours_id = v_digital);
  insert into public.formations_parcours (formation_id, parcours_id, ordre)
  select fp.formation_id, v_digital, v_suite + row_number() over (order by fp.ordre, fp.formation_id)
  from public.formations_parcours fp
  where fp.parcours_id = v_business
    and not exists (select 1 from public.formations_parcours d where d.parcours_id = v_digital and d.formation_id = fp.formation_id);
  delete from public.formations_parcours fp where fp.parcours_id = v_business;
  insert into public.livres_parcours (livre_id, parcours_id)
  select lp.livre_id, v_digital from public.livres_parcours lp where lp.parcours_id = v_business
  on conflict do nothing;
  delete from public.livres_parcours lp where lp.parcours_id = v_business;
  update public.sessions_live s set parcours_id = v_digital where s.parcours_id = v_business;

  update public.parcours p
  set description = 'Design, intelligence artificielle, contenu, automatisation, freelance et vente en ligne : les compétences numériques recherchées, et comment en vivre.'
  where p.id = v_digital;
  -- Le groupe suit le nom du parcours (0075) ; son adresse, elle, est changée ici.
  update public.parcours p
  set slug = 'entrepreneuriat',
      nom = 'Entrepreneuriat',
      nom_court = 'Entrepreneuriat',
      description = 'De l’idée à l’entreprise : trouver une idée, bâtir son projet, le financer et le gérer, pendant ses études et après.'
  where p.id = v_business;
  update public.groupes g set slug = public.slug_groupe_libre('entrepreneuriat', g.id) where g.parcours_id = v_business;
end;
$$;

-- « Compétences à vendre » : depuis une formation de Compétences digitales ou d'Entrepreneuriat, vers une compétence
-- publiée de Compétences digitales.
create or replace function public.verifier_monetisation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.formations_parcours fp
    join public.parcours pa on pa.id = fp.parcours_id
    where fp.formation_id = new.business_id and pa.couleur in ('digital', 'business')
  ) then
    raise exception 'Seule une formation de Compétences digitales ou d’Entrepreneuriat se lie à une compétence.';
  end if;
  if not exists (
    select 1 from public.formations f
    join public.formations_parcours fp on fp.formation_id = f.id
    join public.parcours pa on pa.id = fp.parcours_id
    where f.id = new.competence_id and f.statut = 'publiee' and pa.couleur = 'digital'
  ) then
    raise exception 'Choisissez une formation publiée du parcours Compétences digitales.';
  end if;
  return new;
end;
$$;

-- ─── Changer une formation de parcours (0066) : ses liens « compétences à vendre » restent valables ─────
create or replace function public.changer_parcours_formation(p_formation uuid, p_depuis uuid, p_vers uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message constant text := 'Cette formation est liée à une compétence (« Compétences à vendre ») : retirez d’abord ce lien dans sa fiche.';
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
  -- Ses liens « compétences à vendre » doivent rester valables : la formation qui apprend à vendre reste dans
  -- Compétences digitales ou Entrepreneuriat, la compétence dans Compétences digitales (0078).
  if exists (select 1 from public.formations_monetisation fm where fm.business_id = p_formation)
     and not exists (
       select 1 from public.parcours pa
       where pa.couleur in ('digital', 'business')
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

revoke execute on function public.verifier_monetisation() from public, anon, authenticated;

-- ─── 3. L'Équipe Étudium, formatrice des formations sans formateur ──────────────────────────────────
-- Une formation sans formateur (réalisée avec un coach qui n'est pas sur Étudium) est présentée par l'Équipe Étudium :
-- son profil public (/formateurs/etudium) a la même forme que celui d'un formateur (0070), avec ces formations.
create or replace function public.formateur_etudium()
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
    where f.formateur_id is null and f.statut = 'publiee'
  )
  select jsonb_build_object(
    'id', 'etudium',
    'nom', 'Équipe Étudium',
    'titre', 'L’équipe pédagogique d’Étudium',
    'domaine', '',
    'presentation', 'Des formations conçues par Étudium avec des coachs et des experts de chaque domaine.',
    'reseaux', '{}'::jsonb,
    'photo', null,
    'rejoint_le', null,
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
    'peut_ecrire', false
  );
$$;

revoke execute on function public.formateur_etudium() from public;
grant execute on function public.formateur_etudium() to anon, authenticated;

commit;

-- ═══ 0079_plusieurs_roles.sql ═══
-- Migration 0079 : plusieurs rôles pour un compte (ta demande du 11 novembre 2026).
--   - Un compte est étudiant, formateur, ou les deux, avec au plus un rôle de l'équipe (modérateur, admin ou super
--     admin). Le super admin les choisit (changer_roles) ; changer_role (0017, un seul rôle) marche encore.
--   - « Étudiant » ouvre l'espace étudiant, même à un formateur. Un formateur sans « Étudiant » reste sans espace
--     étudiant (règle du 20 octobre, 0036) : les formateurs d'avant la 0079 la gardent (ils perdent la ligne
--     « étudiant », que changer_role leur donnait sans effet).
--   - Les vérifications « un formateur n'est pas étudiant » deviennent « le compte a le rôle étudiant » : accès aux
--     leçons et formations ouvertes, inscription, actions d'étudiant, conversation côté étudiant, abonnements (payé ou
--     attribué), notifications d'apprentissage. Le reste (badges, espace formateur, groupes, messagerie du formateur)
--     ne change pas, sauf pour un formateur qui est aussi étudiant : les groupes le traitent en étudiant.
--   - Un visiteur garde les aperçus ; on ne s'inscrit pas à sa propre formation ; un formateur étudiant inscrit à la
--     formation d'un autre est prévenu de sa désactivation ; le journal note aussi le rôle « Étudiant ».
--   - Un seul rôle de l'équipe, garanti par la base ; les rôles ne s'écrivent plus que par changer_roles.
--   - Après la 0079, ne plus rejouer la 0017 : elle remettrait un seul rôle par compte.
-- À appliquer après la 0078. Rejouable.

begin;

-- ─── 1. Plus d'un rôle par compte ───────────────────────────────────────────────────────────────────
drop trigger if exists roles_un_seul on public.roles;
drop function if exists public.roles_un_seul();

-- Une seule fois (avant la 0079, changer_roles n'existe pas) : les formateurs d'avant gardent la règle du 20 octobre.
do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'changer_roles'
  ) then
    delete from public.roles e
    where e.role = 'etudiant'
      and exists (select 1 from public.roles f where f.profil_id = e.profil_id and f.role = 'formateur');
  end if;
end;
$$;
drop index if exists public.roles_un_seul_role;

-- Un seul rôle de l'équipe par compte, garanti par la base (même pour deux demandes simultanées).
create unique index if not exists roles_une_equipe on public.roles (profil_id) where role in ('moderateur', 'admin', 'super_admin');

-- Les rôles ne s'écrivent que par changer_roles (et l'inscription) : plus d'écriture directe par l'API, qui pourrait
-- laisser un compte ni étudiant ni formateur.
revoke insert, update, delete on public.roles from anon, authenticated;

-- ─── 2. Choisir les rôles d'un compte (super admin seul) ────────────────────────────────────────────
create or replace function public.changer_roles(p_compte uuid, p_roles public.role_etudium[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prenom text;
  v_nom text;
  v_voulus public.role_etudium[];
  v_actuels public.role_etudium[];
  v_equipe constant public.role_etudium[] := array['moderateur', 'admin', 'super_admin']::public.role_etudium[];
  v_equipe_avant public.role_etudium;
  v_equipe_apres public.role_etudium;
begin
  if not public.a_role('super_admin') then
    raise exception 'Seul le super admin change les rôles.' using errcode = '42501';
  end if;
  select prenom, nom into v_prenom, v_nom from public.profils where id = p_compte for update;
  if not found then
    raise exception 'Compte introuvable.';
  end if;
  v_voulus := array(select distinct x from unnest(coalesce(p_roles, '{}'::public.role_etudium[])) as t(x) where x is not null order by x);
  if not ('etudiant' = any (v_voulus) or 'formateur' = any (v_voulus)) then
    raise exception 'Un compte est étudiant, formateur, ou les deux.';
  end if;
  if (select count(*) from unnest(v_voulus) as t(x) where x = any (v_equipe)) > 1 then
    raise exception 'Un seul rôle de l’équipe à la fois.';
  end if;
  v_actuels := array(select r.role from public.roles r where r.profil_id = p_compte order by r.role);
  if v_actuels = v_voulus then
    return;
  end if;
  if p_compte = (select auth.uid()) and 'super_admin' = any (v_actuels) and not ('super_admin' = any (v_voulus)) then
    raise exception 'Vous ne pouvez pas vous retirer le rôle super admin.';
  end if;
  if exists (select 1 from public.suspensions where profil_id = p_compte)
     and exists (select 1 from unnest(v_voulus) as t(x) where x <> 'etudiant' and not (x = any (v_actuels))) then
    raise exception 'Réactivez le compte avant de lui donner un rôle.';
  end if;

  -- Formateur retiré : sa fiche est détachée (ses formations y restent), gardée pour la lui rendre.
  if 'formateur' = any (v_actuels) and not ('formateur' = any (v_voulus)) then
    update public.formateurs set compte_precedent = compte_id, compte_id = null where compte_id = p_compte;
  end if;

  -- D'un rôle de l'équipe à un autre : la même ligne, sans « Vous faites partie de l’équipe » (0016).
  select x into v_equipe_avant from unnest(v_actuels) as t(x) where x = any (v_equipe) limit 1;
  select x into v_equipe_apres from unnest(v_voulus) as t(x) where x = any (v_equipe) limit 1;
  if v_equipe_avant is not null and v_equipe_apres is not null and v_equipe_avant <> v_equipe_apres then
    update public.roles set role = v_equipe_apres where profil_id = p_compte and role = v_equipe_avant;
  end if;

  delete from public.roles where profil_id = p_compte and not (role = any (v_voulus));
  insert into public.roles (profil_id, role) select p_compte, x from unnest(v_voulus) as t(x) on conflict do nothing;

  -- Formateur donné : sa fiche d'avant s'il en a eu une, sinon une fiche à son nom.
  if 'formateur' = any (v_voulus) and not exists (select 1 from public.formateurs where compte_id = p_compte) then
    update public.formateurs set compte_id = p_compte, compte_precedent = null
    where id = (select id from public.formateurs where compte_precedent = p_compte order by modifie_le desc limit 1);
    if not found then
      insert into public.formateurs (nom, compte_id)
      values (left(coalesce(nullif(btrim(coalesce(v_prenom, '') || ' ' || coalesce(v_nom, '')), ''), 'Formateur'), 80), p_compte);
    end if;
  end if;
end;
$$;

-- Un seul rôle (0017), pour l'appli d'avant : formateur seul, étudiant seul, ou étudiant et un rôle de l'équipe.
create or replace function public.changer_role(p_compte uuid, p_role public.role_etudium)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_role is null then
    raise exception 'Choisissez un rôle.';
  end if;
  perform public.changer_roles(
    p_compte,
    case
      when p_role = 'formateur' then array['formateur']
      when p_role = 'etudiant' then array['etudiant']
      else array['etudiant', p_role::text]
    end::public.role_etudium[]
  );
end;
$$;

-- ─── 3. « Étudiant » plutôt que « pas formateur » (dernières versions, seule cette vérification change) ──
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
      ((select auth.uid()) is null or public.a_role('etudiant'))
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
      ((select auth.uid()) is null or public.a_role('etudiant'))
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
  if not public.a_role('etudiant') then
    raise exception 'Un compte formateur ne suit pas de formation.' using errcode = '42501';
  end if;
  if public.formateur_de(p_formation) then
    raise exception 'Vous êtes le formateur de cette formation.' using errcode = '42501';
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

create or replace function public.refuser_compte_formateur()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.profil_id is distinct from (select auth.uid()) then
    return new;
  end if;
  if not exists (select 1 from public.roles r where r.profil_id = new.profil_id and r.role = 'etudiant') then
    raise exception 'Un compte formateur ne suit pas de formation.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.refuser_formateur_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_compte uuid;
begin
  if tg_table_name = 'conversations' then
    v_compte := new.etudiant_id;
  elsif new.de_etudiant then
    v_compte := new.auteur_id;
  end if;
  if v_compte is not null and not exists (select 1 from public.roles r where r.profil_id = v_compte and r.role = 'etudiant') then
    raise exception 'Un compte formateur ne suit pas de formation.' using errcode = '42501';
  end if;
  return new;
end;
$$;

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
      and not exists (select 1 from public.roles r where r.profil_id = p.id and r.role = 'etudiant')
    );
  get diagnostics v_nombre = row_count;
  return v_nombre;
end;
$$;

create or replace function public.preparer_paiement(p_formule uuid, p_code text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v public.paiements%rowtype;
  v_calcul jsonb;
begin
  perform public.exiger_compte_actif();
  if not public.a_role('etudiant') then
    raise exception 'Un compte formateur n’a pas d’abonnement.' using errcode = '42501';
  end if;
  -- Deux demandes simultanées d'un même compte passent l'une après l'autre ; un code promo est verrouillé le temps de
  -- compter ses utilisations (un code à 100 % active l'abonnement dans la même transaction).
  perform pg_advisory_xact_lock(hashtext('etudium.paiement.' || v_uid::text));
  if coalesce(trim(p_code), '') <> '' then
    perform 1 from public.codes_promo where code = upper(trim(p_code)) for update;
    -- Un code saisi compte comme un essai (limite contre les codes devinés, 0053).
    if not public.noter_essai_code() then
      raise exception 'Trop d’essais de code. Réessayez dans quelques minutes.';
    end if;
  end if;

  select * into v from public.paiements
  where profil_id = v_uid and statut = 'en_attente' and payiz_id is not null and essai_le > now() - interval '3 minutes'
  order by essai_le desc limit 1;
  if found then
    return public.carte_paiement(v) || jsonb_build_object('repris', true);
  end if;

  v_calcul := public.remise_code(p_code, p_formule, v_uid);
  if not (v_calcul ->> 'ok')::boolean then
    raise exception '%', v_calcul ->> 'message';
  end if;
  if (v_calcul ->> 'montant')::integer > 0 and not public.paiements_ouverts() then
    raise exception 'Les paiements ouvrent bientôt.';
  end if;

  -- Une préparation jamais partie chez Payiz (coupure réseau, Payiz lent) est reprise pour le même abonnement, le même
  -- code et le même montant : même identifiant, donc même clé d'idempotence, et pas de seconde demande au téléphone (0053).
  select * into v from public.paiements
  where profil_id = v_uid and statut = 'en_attente' and payiz_id is null
    and formule_id = p_formule
    and code_promo_id is not distinct from (v_calcul ->> 'code_id')::uuid
    and montant = (v_calcul ->> 'montant')::integer
    and cree_le > now() - interval '15 minutes'
  order by cree_le desc limit 1;
  if found then
    return public.carte_paiement(v) || jsonb_build_object('repris', false);
  end if;

  insert into public.paiements (profil_id, formule_id, code_promo_id, prix_initial, remise, montant)
  values (v_uid, p_formule, (v_calcul ->> 'code_id')::uuid, (v_calcul ->> 'prix_initial')::integer,
          (v_calcul ->> 'remise')::integer, (v_calcul ->> 'montant')::integer)
  returning * into v;
  if v.montant = 0 then
    perform public.activer_paiement(v.id);
    select * into v from public.paiements where id = v.id;
  end if;
  return public.carte_paiement(v) || jsonb_build_object('repris', false);
end;
$$;

create or replace function public.attribuer_abonnement(p_compte uuid, p_formule uuid, p_moyen text, p_montant integer, p_reference text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_formule public.formules%rowtype;
  v_reference text := nullif(btrim(coalesce(p_reference, '')), '');
  v_montant integer;
  v_prix integer;
  v public.paiements%rowtype;
begin
  perform public.exiger_equipe_paiements();
  if not exists (select 1 from public.profils where id = p_compte) then
    raise exception 'Compte inconnu.';
  end if;
  if not exists (select 1 from public.roles r where r.profil_id = p_compte and r.role = 'etudiant') then
    raise exception 'Un compte formateur n’a pas d’abonnement.';
  end if;
  select * into v_formule from public.formules where id = p_formule;
  if not found then
    raise exception 'Abonnement inconnu.';
  end if;
  if p_moyen is null or p_moyen not in ('mobile_money', 'especes', 'virement', 'offert') then
    raise exception 'Choisissez le moyen de paiement.';
  end if;
  if p_moyen = 'offert' then
    v_montant := 0;
  elsif p_montant is null or p_montant < 0 then
    raise exception 'Indiquez le montant reçu.';
  else
    v_montant := p_montant;
  end if;
  if char_length(coalesce(v_reference, '')) > 120 then
    raise exception 'La référence compte 120 caractères au plus.';
  end if;
  v_prix := coalesce(v_formule.prix_fcfa, v_montant);

  insert into public.paiements (profil_id, formule_id, prix_initial, remise, montant, source, moyen_manuel, reference_manuelle, attribue_par)
  values (p_compte, p_formule, v_prix, greatest(v_prix - v_montant, 0), v_montant, 'manuel', p_moyen, v_reference, (select auth.uid()))
  returning * into v;
  -- Le numéro de reçu et l'abonnement, à la suite de celui en cours (comme un paiement en ligne).
  perform public.activer_paiement(v.id);
  select * into v from public.paiements where id = v.id;

  perform public.notifier(
    array[p_compte], 'service', 'Votre abonnement ' || v_formule.nom || ' est actif',
    'Jusqu’au ' || public.date_longue(public.fin_abonnement(p_compte)) || '.', '/abonnement'
  );
  return public.carte_paiement(v);
end;
$$;

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
    and exists (select 1 from public.roles r where r.profil_id = s and r.role = 'etudiant')
    and not exists (select 1 from public.roles r where r.profil_id = s and r.role in ('admin', 'moderateur', 'super_admin'))
    and not exists (
      select 1 from public.formations f join public.formateurs fo on fo.id = f.formateur_id
      where f.id = p_formation and fo.compte_id = s
    );
$$;

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

create or replace function public.lien_groupe(p_profil uuid, p_slug text, p_message uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
      when exists (select 1 from public.roles r where r.profil_id = p_profil and r.role = 'formateur')
        and not exists (select 1 from public.roles r where r.profil_id = p_profil and r.role = 'etudiant')
      then '/formateur/groupes/' else '/groupes/' end
    || p_slug || coalesce('?message=' || p_message::text, '');
$$;

create or replace function public.groupe_par_slug(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  g public.groupes%rowtype;
  v_ouvert boolean;
  v_base jsonb;
begin
  perform public.exiger_compte_actif();
  select * into g from public.groupes where slug = lower(btrim(coalesce(p_slug, '')));
  if not found or (g.formation_id is null and not g.actif) then
    return null;
  end if;
  v_ouvert := public.peut_lire_groupe(g.id);
  v_base := jsonb_build_object(
    'id', g.id,
    'slug', g.slug,
    'nom', g.nom,
    'type', public.type_groupe(g),
    'couleur', public.couleur_groupe(g),
    'actif', g.actif,
    'ouvert', v_ouvert,
    'parcours', (select jsonb_build_object('nom', pa.nom, 'slug', pa.slug) from public.parcours pa where pa.id = g.parcours_id),
    'formation', (select jsonb_build_object('titre', f.titre, 'slug', f.slug) from public.formations f where f.id = g.formation_id)
  );
  if not v_ouvert then
    return v_base || jsonb_build_object('raison', case
      when g.formation_id is not null and not g.actif then 'desactive'
      when g.formation_id is not null then 'inscription'
      when public.a_role('formateur') and not public.a_role('etudiant') then 'formateur'
      else 'abonnement'
    end);
  end if;
  return v_base || jsonb_build_object(
    'raison', null,
    'membres', public.compter_membres_groupe(g.id),
    'coupe', exists (select 1 from public.groupes_coupes c where c.groupe_id = g.id and c.profil_id = (select auth.uid())),
    'peut_moderer', public.peut_moderer_groupe(g.id),
    -- L'équipe modère depuis la file : elle ne signale pas.
    'equipe', public.equipe_communaute(),
    'peut_ecrire', g.actif,
    'non_lus', public.non_lus_groupe(g.id, (select auth.uid())),
    'epingle', (
      select public.message_groupe_json(m)
      from public.messages_groupes m
      where m.id = g.epingle_id and m.supprime_le is null and m.moderation = 'visible'
    )
  );
end;
$$;

revoke execute on function public.changer_roles(uuid, public.role_etudium[]) from public, anon;
grant execute on function public.changer_roles(uuid, public.role_etudium[]) to authenticated;

commit;

-- ═══ 0080_notifications_groupes.sql ═══
-- Migration 0080 : une notification à chaque message d'un groupe (ta demande du 11 novembre 2026).
--   - Chaque nouveau message d'un groupe prévient ses membres : la cloche (avec son son, site ouvert), le téléphone (s'il
--     a activé les notifications) ; un clic mène au groupe, sur le message.
--   - Ni l'auteur, ni ceux qui ont coupé le groupe (« Couper les notifications »), ni l'auteur du message cité : il reçoit
--     déjà « Nouvelle réponse » (0075).
--   - Une seule notification non lue par groupe et par compte : la précédente laisse sa place à la nouvelle.
--   - Un message que l'IA doit encore relire n'est pas cité dans la notification.
-- À appliquer après la 0076 (après la 0079 si tu l'appliques aussi). Rejouable.

begin;

-- ─── Les membres d'un groupe ────────────────────────────────────────────────────────────────────────
-- La règle de peut_lire_groupe, vue pour chaque compte (comme compter_membres_groupe, 0075).
create or replace function public.comptes_du_groupe(p_groupe uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.groupes g
  cross join public.profils p
  where g.id = p_groupe
    and not exists (select 1 from public.suspensions s where s.profil_id = p.id)
    and (
      (g.parcours_id is null and g.formation_id is null)
      or exists (select 1 from public.roles r where r.profil_id = p.id and 'communaute' = any (public.domaines_role(r.role::text)))
      or (g.parcours_id is not null and (
        public.abonne(p.id)
        or exists (
          select 1
          from public.formations_parcours fp
          join public.formations f on f.id = fp.formation_id
          join public.formateurs fo on fo.id = f.formateur_id
          where fp.parcours_id = g.parcours_id and fo.compte_id = p.id
            and exists (select 1 from public.roles r where r.profil_id = p.id and r.role = 'formateur')
        )
        or exists (
          select 1
          from public.inscriptions_formations i
          join public.formations_parcours fp on fp.formation_id = i.formation_id
          where fp.parcours_id = g.parcours_id and i.profil_id = p.id
        )
      ))
      or (g.formation_id is not null and (
        exists (
          select 1 from public.formations f
          join public.formateurs fo on fo.id = f.formateur_id
          where f.id = g.formation_id and fo.compte_id = p.id
            and exists (select 1 from public.roles r where r.profil_id = p.id and r.role = 'formateur')
        )
        or exists (
          select 1 from public.inscriptions_formations i
          join public.formations f on f.id = i.formation_id
          where i.formation_id = g.formation_id and i.profil_id = p.id and f.statut in ('publiee', 'archivee')
        )
      ))
    );
$$;

-- ─── La notification d'un nouveau message ───────────────────────────────────────────────────────────
create or replace function public.notifier_message_groupe()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_groupe public.groupes%rowtype;
  v_cite uuid;
  v_titre text;
  v_texte text;
  v_envoi record;
begin
  if new.supprime_le is not null or new.moderation <> 'visible' then
    return null;
  end if;
  select * into v_groupe from public.groupes where id = new.groupe_id;
  if not found or not v_groupe.actif then
    return null;
  end if;
  select m.auteur_id into v_cite from public.messages_groupes m where m.id = new.reponse_a;
  v_titre := left('Nouveau message dans le groupe ' || v_groupe.nom, 200);
  v_texte := coalesce((select public.nom_avis(p.prenom, p.nom) from public.profils p where p.id = new.auteur_id), 'Un membre') || ' : '
    || case
         when new.duree_ms is not null then 'Note vocale'
         when new.analyse_attendue then 'nouveau message'
         else '« ' || public.extrait_message_groupe(new.texte, new.image is not null) || ' »'
       end;
  -- Le lien dépend du compte (l'espace formateur pour un formateur sans espace étudiant) : un envoi par lien.
  for v_envoi in
    select public.lien_groupe(d.compte, v_groupe.slug, new.id) as lien, array_agg(d.compte) as comptes
    from (
      select m.compte
      from public.comptes_du_groupe(new.groupe_id) as m(compte)
      where m.compte <> new.auteur_id
        and m.compte is distinct from v_cite
        and not exists (select 1 from public.groupes_coupes c where c.groupe_id = new.groupe_id and c.profil_id = m.compte)
    ) d
    group by 1
  loop
    -- Une seule notification non lue par groupe : la précédente laisse sa place.
    delete from public.notifications n
    where n.destinataire = any (v_envoi.comptes) and n.lue_le is null and n.titre = v_titre;
    perform public.notifier(v_envoi.comptes, 'communaute', v_titre, v_texte, v_envoi.lien, false);
  end loop;
  return null;
end;
$$;

drop trigger if exists messages_groupes_notifier on public.messages_groupes;
create trigger messages_groupes_notifier
  after insert on public.messages_groupes
  for each row execute function public.notifier_message_groupe();

revoke execute on function public.comptes_du_groupe(uuid) from public, anon, authenticated;
revoke execute on function public.notifier_message_groupe() from public, anon, authenticated;

commit;

-- ═══ 0081_saspay_secours.sql ═══
-- Migration 0081 : SasPay en secours de Payiz (demande du 12 novembre 2026 : Payiz ne couvre pas plusieurs pays
-- d'Afrique). L'étudiant voit une seule liste de pays et d'opérateurs ; un opérateur que Payiz encaisse part chez Payiz,
-- les autres chez SasPay, sans que l'étudiant le sache. L'identifiant du paiement chez SasPay est gardé dans payiz_id,
-- préfixé « softpay: » : aucune colonne nouvelle, et aucun nom de prestataire dans les données envoyées au navigateur.
--   - noter_essai : après un échec, un nouvel essai peut porter un autre identifiant (SasPay crée une demande à chaque
--     essai ; un réessai peut aussi changer de prestataire). Tant qu'une demande attend sur le téléphone, l'identifiant
--     ne change pas (« Paiement Payiz différent. », comme avant).
--   - noter_echec reçoit la référence du paiement qui a échoué (facultative : l'appli d'avant cette version l'appelle
--     sans) : un échec qui arrive en retard pour une demande remplacée (Payiz qui fait expirer son ancien paiement après un
--     réessai chez SasPay) ne touche pas la demande en cours.
--   - paiements_softpay_en_attente : pour les notifications de SasPay, qui ne nomment pas notre paiement : les paiements
--     SasPay en attente depuis moins de 24 h, relus chez SasPay. Gardée par le jeton du serveur.
-- À appliquer après la 0080. Rejouable.

begin;

-- ─── Noter un essai (dernière définition : 0072_paiements_tous_pays.sql) ────────────────────────────
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
  -- Une demande qui attend encore peut aboutir : on ne la remplace pas. Après un échec, la nouvelle demande la remplace.
  if v.statut = 'en_attente' and v.payiz_id is not null and v.payiz_id is distinct from p_payiz then
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

-- ─── Noter un échec (dernière définition : 0049_abonnements_paiements.sql) ──────────────────────────
-- Avec la référence : ignoré si ce n'est plus la demande notée (la carte est renvoyée telle quelle).
drop function if exists public.noter_echec(uuid, text, text, text);
create or replace function public.noter_echec(p_paiement uuid, p_statut text, p_motif text, p_jeton text, p_payiz text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.paiements%rowtype;
begin
  perform public.exiger_jeton_paiement(p_jeton);
  if p_statut is null or p_statut not in ('echoue', 'expire', 'annule') then
    raise exception 'État de paiement inconnu.';
  end if;
  select * into v from public.paiements where id = p_paiement for update;
  if not found then
    raise exception 'Paiement inconnu.';
  end if;
  if v.statut <> 'reussi' and (p_payiz is null or v.payiz_id is not distinct from p_payiz) then
    update public.paiements
    set statut = p_statut,
        motif_echec = case
          when p_statut <> 'echoue' then null
          when p_motif in ('insufficient_funds', 'payer_declined', 'timeout', 'invalid_phone', 'operator_limit', 'operator_unavailable', 'declined', 'unknown') then p_motif
          else 'unknown'
        end
    where id = p_paiement
    returning * into v;
  end if;
  return public.carte_paiement(v);
end;
$$;

revoke execute on function public.noter_echec(uuid, text, text, text, text) from public, anon, authenticated;
-- Appelée par le serveur, avec ou sans session : le jeton la garde (comme en 0049).
grant execute on function public.noter_echec(uuid, text, text, text, text) to anon, authenticated;

-- ─── Les paiements SasPay en attente (pour ses notifications) ───────────────────────────────────────
create or replace function public.paiements_softpay_en_attente(p_jeton text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_jeton_paiement(p_jeton);
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'ref', p.payiz_id, 'montant', p.montant) order by p.essai_le desc)
    from (
      select id, payiz_id, montant, essai_le
      from public.paiements
      where statut = 'en_attente' and payiz_id like 'softpay:%' and essai_le > now() - interval '24 hours'
      order by essai_le desc
      limit 50
    ) p
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.paiements_softpay_en_attente(text) from public, anon, authenticated;
grant execute on function public.paiements_softpay_en_attente(text) to anon, authenticated;

commit;
