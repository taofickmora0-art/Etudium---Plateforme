-- Étudium · migration 0016 : centre de notifications (spec des notifications, 14 octobre 2026).
-- À appliquer dans Supabase, après la 0015 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancé sur une base qui l'a déjà, il ne change rien et ne casse rien. Si une migration plus ancienne
-- est rejouée un jour (0004, 0010, 0013, 0014…), rejouer celle-ci ensuite.

begin;

-- ─── Notifications ──────────────────────────────────────────────────────────────────────────────────
-- Une ligne par destinataire. Seule la base les écrit (notifier, plus bas) ; chacun lit les siennes et les marque lues.
-- Catégories : les 8 de l'onglet Notifications du profil, plus « service » (compte et travail : toujours envoyée).
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  destinataire uuid not null references public.profils (id) on delete cascade,
  categorie text not null,
  titre text not null,
  texte text not null default '',
  -- Toujours une adresse du site.
  lien text,
  cree_le timestamptz not null default now(),
  lue_le timestamptz,
  constraint notifications_categorie check (categorie in (
    'nouveaux_contenus', 'sessions_live', 'expiration_renouvellement', 'exercices', 'rappels_apprentissage',
    'communaute', 'recommandations', 'annonces', 'service'
  )),
  constraint notifications_titre_longueur check (char_length(titre) between 1 and 200),
  constraint notifications_texte_longueur check (char_length(texte) <= 400),
  constraint notifications_lien check (lien is null or (lien ~ '^/' and lien !~ '^//'))
);
-- La cloche et la page lisent les plus récentes d'un compte ; l'identifiant croissant sert aussi de curseur.
create index if not exists notifications_destinataire_idx on public.notifications (destinataire, id desc);

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (lue_le) on public.notifications to authenticated;

drop policy if exists "ses notifications : lecture" on public.notifications;
create policy "ses notifications : lecture" on public.notifications
  for select to authenticated
  using (destinataire = (select auth.uid()));

drop policy if exists "ses notifications : marquées lues" on public.notifications;
create policy "ses notifications : marquées lues" on public.notifications
  for update to authenticated
  using (destinataire = (select auth.uid()))
  with check (destinataire = (select auth.uid()));

-- Comme les autres tables du compte (0013) : plus rien pour un compte suspendu.
drop policy if exists "compte suspendu : rien" on public.notifications;
create policy "compte suspendu : rien" on public.notifications
  as restrictive for all to authenticated
  using (not (select public.compte_suspendu())) with check (not (select public.compte_suspendu()));

-- ─── Envoyer ────────────────────────────────────────────────────────────────────────────────────────
-- Interne : appelée par les déclencheurs et les fonctions de cette migration, jamais par un compte.
-- - Jamais pour l'auteur de l'action (le compte de la requête).
-- - « Notifications dans l’appli » coupé : rien, service compris ; une catégorie coupée : rien de cette catégorie.
--   Une clé absente des préférences vaut « activée », comme dans l'appli.
-- - Efface au passage les notifications de plus de 6 mois de ces destinataires.
-- Rend le nombre de notifications enregistrées.
create or replace function public.notifier(p_destinataires uuid[], p_categorie text, p_titre text, p_texte text, p_lien text)
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

  insert into public.notifications (destinataire, categorie, titre, texte, lien)
  select p.id, p_categorie, left(p_titre, 200), left(coalesce(p_texte, ''), 400), p_lien
  from public.profils p
  where p.id = any (p_destinataires)
    and p.id is distinct from (select auth.uid())
    and (p.preferences_notifications ->> 'canal_appli') is distinct from 'false'
    and (p_categorie = 'service' or (p.preferences_notifications ->> p_categorie) is distinct from 'false');
  get diagnostics v_nombre = row_count;
  return v_nombre;
end;
$$;

-- ─── Lire et marquer lues ───────────────────────────────────────────────────────────────────────────
-- Les plus récentes d'abord ; « Voir plus » repart de la dernière lue (p_avant). Les règles d'accès filtrent.
create or replace function public.mes_notifications(p_non_lues boolean default false, p_avant bigint default null, p_nombre integer default 20)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with taille as (
    select least(greatest(coalesce(p_nombre, 20), 1), 50) as n
  ),
  lot as (
    select n.id, n.categorie, n.titre, n.texte, n.lien, n.cree_le, n.lue_le is not null as lue
    from public.notifications n
    where n.destinataire = (select auth.uid())
      and (not coalesce(p_non_lues, false) or n.lue_le is null)
      and (p_avant is null or n.id < p_avant)
    order by n.id desc
    limit (select n + 1 from taille)
  )
  select jsonb_build_object(
    'lignes', coalesce(
      (select jsonb_agg(to_jsonb(l) order by l.id desc)
       from (select * from lot order by id desc limit (select n from taille)) l),
      '[]'::jsonb
    ),
    'suite', (select count(*) from lot) > (select n from taille),
    'non_lues', (
      select count(*)::integer from public.notifications
      where destinataire = (select auth.uid()) and lue_le is null
    )
  );
$$;

-- Toutes les siennes (p_ids nul), ou seulement celles-ci.
create or replace function public.marquer_lues(p_ids bigint[] default null)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.notifications set lue_le = now()
  where destinataire = (select auth.uid()) and lue_le is null and (p_ids is null or id = any (p_ids));
$$;

-- ─── Qui notifier ───────────────────────────────────────────────────────────────────────────────────
-- Règle provisoire avant les abonnements (lot 2) : un compte suit une formation dès qu'il en a ouvert une leçon.
create or replace function public.suiveurs_formation(p_formation uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct p.profil_id), '{}')
  from public.progression_lecons p
  join public.lecons l on l.id = p.lecon_id
  join public.modules m on m.id = l.module_id
  where m.formation_id = p_formation;
$$;

-- L'équipe (admin, modérateur, super admin), sans les comptes suspendus.
create or replace function public.membres_equipe()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct r.profil_id), '{}')
  from public.roles r
  where r.role in ('admin', 'moderateur', 'super_admin')
    and not exists (select 1 from public.suspensions s where s.profil_id = r.profil_id);
$$;

-- ─── Formations : publication, archivage, relecture ─────────────────────────────────────────────────
-- Des déclencheurs plutôt que des fonctions réécrites : une action faite ailleurs (éditeur SQL) notifie aussi.
create or replace function public.notifications_formations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_formateur uuid;
  v_deja uuid[] := '{}';
  v_parcours record;
  v_suiveurs uuid[];
  v_remarque text;
begin
  select compte_id into v_formateur from public.formateurs where id = new.formateur_id;

  -- Première publication (republier une formation archivée ne compte pas) : les étudiants de ses parcours, une
  -- seule fois chacun, avec le premier parcours qu'ils suivent ; puis son formateur.
  if new.publiee_le is not null and (tg_op = 'INSERT' or old.publiee_le is null) then
    for v_parcours in
      select pa.id, pa.nom_court
      from public.formations_parcours fp
      join public.parcours pa on pa.id = fp.parcours_id
      where fp.formation_id = new.id
      order by pa.ordre, pa.nom_court
    loop
      select coalesce(array_agg(distinct p.profil_id), '{}') into v_suiveurs
      from public.progression_lecons p
      join public.lecons l on l.id = p.lecon_id
      join public.modules m on m.id = l.module_id
      join public.formations_parcours fp on fp.formation_id = m.formation_id
      where fp.parcours_id = v_parcours.id
        and not (p.profil_id = any (v_deja))
        and p.profil_id is distinct from v_formateur;
      perform public.notifier(
        v_suiveurs, 'nouveaux_contenus', 'Nouvelle formation : ' || new.titre,
        'Dans le parcours ' || v_parcours.nom_court || '.', '/formations/' || new.slug
      );
      v_deja := v_deja || v_suiveurs;
    end loop;
    if v_formateur is not null then
      perform public.notifier(array[v_formateur], 'service', 'Votre formation est en ligne', new.titre, '/formateur/formations/' || new.id);
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.statut = 'archivee' and old.statut <> 'archivee' then
      perform public.notifier(
        public.suiveurs_formation(new.id), 'service', 'Formation archivée',
        new.titre || ' n’est plus disponible. Votre progression est conservée.', '/mes-formations'
      );
    end if;

    if new.envoyee_le is not null and old.envoyee_le is null then
      perform public.notifier(
        public.membres_equipe(), 'service', 'Formation à valider',
        new.titre || ', par ' || coalesce((select nom from public.formateurs where id = new.formateur_id), 'un formateur'),
        '/admin/formations/' || new.id || '?onglet=publication'
      );
    end if;

    if new.renvoyee_le is not null and new.renvoyee_le is distinct from old.renvoyee_le and v_formateur is not null then
      v_remarque := coalesce(new.remarque_relecture, '');
      if char_length(v_remarque) > 120 then
        v_remarque := left(v_remarque, 119) || '…';
      end if;
      perform public.notifier(
        array[v_formateur], 'service', 'Votre formation est à corriger', v_remarque,
        '/formateur/formations/' || new.id || '?onglet=publication'
      );
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists notifications_formations on public.formations;
create trigger notifications_formations
  after insert or update on public.formations
  for each row execute function public.notifications_formations();

-- ─── Une leçon ajoutée à une formation en ligne ─────────────────────────────────────────────────────
create or replace function public.notifications_lecons()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_formation record;
begin
  select f.id, f.titre, f.slug, f.statut into v_formation
  from public.modules m
  join public.formations f on f.id = m.formation_id
  where m.id = new.module_id;
  if found and v_formation.statut = 'publiee' then
    perform public.notifier(
      public.suiveurs_formation(v_formation.id), 'nouveaux_contenus', 'Nouvelle leçon dans ' || v_formation.titre,
      new.titre, '/formations/' || v_formation.slug || '/lecons/' || new.id
    );
  end if;
  return null;
end;
$$;

drop trigger if exists notifications_lecons on public.lecons;
create trigger notifications_lecons
  after insert on public.lecons
  for each row execute function public.notifications_lecons();

-- ─── Un nouvel avis ─────────────────────────────────────────────────────────────────────────────────
-- Une modification passe par « on conflict do update » (0010) : elle ne déclenche rien. Masquer non plus.
create or replace function public.notifications_avis()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_formation record;
  v_auteur record;
begin
  select f.titre, f.slug, fo.compte_id into v_formation
  from public.formations f
  left join public.formateurs fo on fo.id = f.formateur_id
  where f.id = new.formation_id;
  if v_formation.compte_id is null then
    return null;
  end if;
  select prenom, nom into v_auteur from public.profils where id = new.profil_id;
  perform public.notifier(
    array[v_formation.compte_id], 'service', 'Nouvel avis sur ' || v_formation.titre,
    public.nom_avis(v_auteur.prenom, v_auteur.nom) || ' : ' || new.note || '/5', '/formations/' || v_formation.slug
  );
  return null;
end;
$$;

drop trigger if exists notifications_avis on public.avis;
create trigger notifications_avis
  after insert on public.avis
  for each row execute function public.notifications_avis();

-- ─── Un rôle donné ──────────────────────────────────────────────────────────────────────────────────
-- Par requête, pas par ligne : un compte qui reçoit admin et modérateur d'un coup n'est averti qu'une fois, et un
-- membre de l'équipe qui reçoit un rôle d'équipe de plus ne l'est pas.
create or replace function public.notifications_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comptes uuid[];
begin
  v_comptes := array(select distinct profil_id from nouveaux where role = 'formateur');
  if cardinality(v_comptes) > 0 then
    perform public.notifier(v_comptes, 'service', 'Vous êtes formateur', 'Créez et suivez vos formations depuis l’espace formateur.', '/formateur');
  end if;

  v_comptes := array(
    select distinct n.profil_id from nouveaux n
    where n.role in ('moderateur', 'admin', 'super_admin')
      and not exists (
        select 1 from public.roles r
        where r.profil_id = n.profil_id
          and r.role in ('moderateur', 'admin', 'super_admin')
          and not exists (select 1 from nouveaux n2 where n2.profil_id = r.profil_id and n2.role = r.role)
      )
  );
  if cardinality(v_comptes) > 0 then
    perform public.notifier(v_comptes, 'service', 'Vous faites partie de l’équipe', 'Le back-office vous est ouvert.', '/admin');
  end if;
  return null;
end;
$$;

drop trigger if exists notifications_roles on public.roles;
create trigger notifications_roles
  after insert on public.roles
  referencing new table as nouveaux
  for each statement execute function public.notifications_roles();

-- ─── Un compte réactivé ─────────────────────────────────────────────────────────────────────────────
-- Supprimer un compte suspendu efface aussi sa suspension : son profil n'existe plus, personne n'est averti.
create or replace function public.notifications_reactivation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.profils where id = old.profil_id) then
    perform public.notifier(array[old.profil_id], 'service', 'Votre compte est réactivé', 'Vous retrouvez tous vos accès.', '/accueil');
  end if;
  return null;
end;
$$;

drop trigger if exists notifications_reactivation on public.suspensions;
create trigger notifications_reactivation
  after delete on public.suspensions
  for each row execute function public.notifications_reactivation();

-- ─── Annonces de l'équipe ───────────────────────────────────────────────────────────────────────────
-- Une rubrique du back-office : l'annonce va à tous les comptes (catégorie « Annonces » du profil). Ni lecture ni
-- écriture directes : tout passe par les deux fonctions ci-dessous, réservées à l'équipe.
create table if not exists public.annonces (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  texte text not null,
  lien text,
  auteur uuid references public.profils (id) on delete set null,
  cree_le timestamptz not null default now(),
  destinataires integer not null default 0,
  constraint annonces_titre_longueur check (char_length(titre) between 1 and 80),
  constraint annonces_texte_longueur check (char_length(texte) between 1 and 300),
  -- Une adresse du site : « / » d'abord, jamais « // » (autre site), ni espace ni barre oblique inversée.
  constraint annonces_lien check (
    lien is null or (lien ~ '^/' and lien !~ '^//' and lien !~ '[[:space:]\\]' and char_length(lien) <= 300)
  )
);
alter table public.annonces enable row level security;
revoke all on public.annonces from anon, authenticated;

-- Rend le nombre de comptes qui la reçoivent (tous, sauf son auteur et ceux qui ont coupé les annonces).
create or replace function public.publier_annonce(p_titre text, p_texte text, p_lien text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_titre text := regexp_replace(coalesce(p_titre, ''), '^\s+|\s+$', '', 'g');
  v_texte text := regexp_replace(coalesce(p_texte, ''), '^\s+|\s+$', '', 'g');
  v_lien text := nullif(regexp_replace(coalesce(p_lien, ''), '^\s+|\s+$', '', 'g'), '');
  v_annonce uuid;
  v_nombre integer;
begin
  if not public.equipe_contenus() then
    raise exception 'Accès réservé à l’équipe.' using errcode = '42501';
  end if;
  if char_length(v_titre) not between 1 and 80 then
    raise exception 'Écrivez un titre (80 caractères au plus).';
  end if;
  if char_length(v_texte) not between 1 and 300 then
    raise exception 'Écrivez le texte de l’annonce (300 caractères au plus).';
  end if;
  if v_lien is not null
     and not (v_lien ~ '^/' and v_lien !~ '^//' and v_lien !~ '[[:space:]\\]' and char_length(v_lien) <= 300) then
    raise exception 'Le lien doit être une adresse du site, commençant par « / ».';
  end if;

  insert into public.annonces (titre, texte, lien, auteur)
  values (v_titre, v_texte, v_lien, (select auth.uid()))
  returning id into v_annonce;
  v_nombre := public.notifier(array(select id from public.profils), 'annonces', v_titre, v_texte, v_lien);
  update public.annonces set destinataires = v_nombre where id = v_annonce;
  return v_nombre;
end;
$$;

-- Les 100 dernières, des plus récentes aux plus anciennes, avec le nom de leur auteur.
create or replace function public.annonces_equipe()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.equipe_contenus() then
    raise exception 'Accès réservé à l’équipe.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'titre', a.titre,
        'texte', a.texte,
        'lien', a.lien,
        'auteur', case
          when p.id is null then 'Compte supprimé'
          else coalesce(nullif(btrim(coalesce(p.prenom, '') || ' ' || coalesce(p.nom, '')), ''), 'Membre de l’équipe')
        end,
        'cree_le', a.cree_le,
        'destinataires', a.destinataires
      )
      order by a.cree_le desc, a.id
    )
    from (select * from public.annonces order by cree_le desc, id limit 100) a
    left join public.profils p on p.id = a.auteur
  ), '[]'::jsonb);
end;
$$;

-- ─── Avis masqués : l'auteur ne le sait pas ─────────────────────────────────────────────────────────
-- Son avis masqué lui reste visible, exactement comme un autre : la colonne « masque » lui est toujours rendue fausse
-- (gardée pour que la 0010 reste rejouable). Les autres ne le voient toujours pas ; il ne compte pas dans la note.
create or replace function public.avis_formation(p_formation uuid, p_limite integer default 6)
returns table (
  id uuid,
  note smallint,
  commentaire text,
  auteur text,
  initiales text,
  cree_le timestamptz,
  modifie_le timestamptz,
  est_moi boolean,
  masque boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.id,
    a.note,
    a.commentaire,
    public.nom_avis(p.prenom, p.nom),
    public.initiales_avis(p.prenom, p.nom),
    a.cree_le,
    a.modifie_le,
    coalesce(a.profil_id = (select auth.uid()), false),
    false
  from public.avis a
  join public.profils p on p.id = a.profil_id
  join public.formations f on f.id = a.formation_id
  where a.formation_id = p_formation
    and f.statut = 'publiee'
    and (not a.masque or a.profil_id = (select auth.uid()))
  order by coalesce(a.profil_id = (select auth.uid()), false) desc, a.modifie_le desc
  limit greatest(coalesce(p_limite, 6), 0);
$$;
revoke execute on function public.avis_formation(uuid, integer) from public;
grant execute on function public.avis_formation(uuid, integer) to anon, authenticated;

-- Ses propres avis restent lisibles, sauf la colonne « masque », que seule l'équipe connaît (avis_equipe, compte_equipe).
revoke select on public.avis from authenticated;
grant select (id, profil_id, formation_id, note, commentaire, cree_le, modifie_le) on public.avis to authenticated;

revoke execute on function public.publier_annonce(text, text, text) from public, anon;
revoke execute on function public.annonces_equipe() from public, anon;
grant execute on function public.publier_annonce(text, text, text) to authenticated;
grant execute on function public.annonces_equipe() to authenticated;

revoke execute on function public.notifier(uuid[], text, text, text, text) from public, anon, authenticated;
revoke execute on function public.suiveurs_formation(uuid) from public, anon, authenticated;
revoke execute on function public.membres_equipe() from public, anon, authenticated;
revoke execute on function public.notifications_formations() from public, anon, authenticated;
revoke execute on function public.notifications_lecons() from public, anon, authenticated;
revoke execute on function public.notifications_avis() from public, anon, authenticated;
revoke execute on function public.notifications_roles() from public, anon, authenticated;
revoke execute on function public.notifications_reactivation() from public, anon, authenticated;
revoke execute on function public.mes_notifications(boolean, bigint, integer) from public, anon;
revoke execute on function public.marquer_lues(bigint[]) from public, anon;
grant execute on function public.mes_notifications(boolean, bigint, integer) to authenticated;
grant execute on function public.marquer_lues(bigint[]) to authenticated;

commit;
