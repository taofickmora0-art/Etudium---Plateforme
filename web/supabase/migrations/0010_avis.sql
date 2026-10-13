-- Étudium · migration 0010 : avis des étudiants, note moyenne des formations, masquage par l’équipe (tâche 1.11).
-- À appliquer dans Supabase, après la 0009 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancé sur une base qui l'a déjà, il ne change rien et ne casse rien.

begin;

-- ─── Avis : une note de 1 à 5 et un commentaire facultatif, un par compte et par formation (spec Q8) ───
create table if not exists public.avis (
  id uuid primary key default gen_random_uuid(),
  profil_id uuid not null default auth.uid() references public.profils (id) on delete cascade,
  formation_id uuid not null references public.formations (id) on delete cascade,
  note smallint not null,
  commentaire text not null default '',
  -- Masqué par l’équipe : invisible pour les autres, hors moyenne ; son auteur le voit encore.
  masque boolean not null default false,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  constraint avis_un_par_formation unique (profil_id, formation_id),
  constraint avis_note check (note between 1 and 5),
  constraint avis_commentaire_longueur check (char_length(commentaire) <= 1000)
);
create index if not exists avis_formation_idx on public.avis (formation_id, modifie_le desc);

-- Aucune écriture directe : tout passe par les fonctions ci-dessous, qui vérifient la règle des 50 %. La lecture
-- publique passe aussi par des fonctions, qui ne livrent jamais l’identifiant de l’auteur.
alter table public.avis enable row level security;
revoke all on public.avis from anon;
revoke insert, update, delete, truncate on public.avis from authenticated;

drop policy if exists "ses avis : lecture" on public.avis;
create policy "ses avis : lecture" on public.avis
  for select to authenticated
  using (profil_id = (select auth.uid()));

-- ─── Note moyenne et nombre d’avis, tenus à jour par la base (spec §4) ──────────────────────────────
alter table public.formations add column if not exists note_moyenne numeric(2, 1);
alter table public.formations add column if not exists nb_avis integer not null default 0;

-- Les avis masqués ne comptent pas. La date de modification de la formation avance avec sa note (déclencheur de la 0004).
create or replace function public.recalculer_note(p_formation uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.formations f
  set note_moyenne = s.moyenne, nb_avis = s.nombre
  from (
    select round(avg(a.note)::numeric, 1) as moyenne, count(*)::integer as nombre
    from public.avis a
    where a.formation_id = p_formation and not a.masque
  ) s
  where f.id = p_formation and (f.note_moyenne is distinct from s.moyenne or f.nb_avis <> s.nombre);
$$;

create or replace function public.avis_recalculer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' then
    perform public.recalculer_note(old.formation_id);
  end if;
  if tg_op <> 'DELETE' then
    perform public.recalculer_note(new.formation_id);
  end if;
  return null;
end;
$$;

drop trigger if exists avis_recalculer on public.avis;
create trigger avis_recalculer after insert or update or delete on public.avis
  for each row execute function public.avis_recalculer();

-- ─── Nom affiché : « Fifamè A. », le prénom seul sans nom, « Membre d’Étudium » sans prénom ─────────
create or replace function public.nom_avis(p_prenom text, p_nom text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when btrim(coalesce(p_prenom, '')) = '' then 'Membre d’Étudium'
    when btrim(coalesce(p_nom, '')) = '' then btrim(p_prenom)
    else btrim(p_prenom) || ' ' || upper(left(btrim(p_nom), 1)) || '.'
  end;
$$;

create or replace function public.initiales_avis(p_prenom text, p_nom text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(nullif(upper(left(btrim(coalesce(p_prenom, '')), 1)) || upper(left(btrim(coalesce(p_nom, '')), 1)), ''), 'É');
$$;

-- ─── À partir de 50 % : leçons terminées × 2 ≥ leçons de la formation (spec Q2, §7), formation publiée ───
create or replace function public.peut_donner_avis(p_formation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (select 1 from public.formations f where f.id = p_formation and f.statut = 'publiee')
    and (
      select count(*) > 0 and count(p.terminee_le) * 2 >= count(*)
      from public.lecons l
      join public.modules m on m.id = l.module_id
      left join public.progression_lecons p on p.lecon_id = l.id and p.profil_id = (select auth.uid())
      where m.formation_id = p_formation
    );
$$;

-- Écrire ou modifier son avis. Un avis masqué le reste après modification : l’équipe décide.
create or replace function public.enregistrer_avis(p_formation uuid, p_note smallint, p_commentaire text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_commentaire text := regexp_replace(coalesce(p_commentaire, ''), '^\s+|\s+$', '', 'g');
begin
  if p_note is null or p_note not between 1 and 5 then
    raise exception 'La note va de 1 à 5.' using errcode = '22023';
  end if;
  if char_length(v_commentaire) > 1000 then
    raise exception 'Le commentaire dépasse 1 000 caractères.' using errcode = '22023';
  end if;
  if not public.peut_donner_avis(p_formation) then
    raise exception 'Un avis se donne à partir de 50 %% de progression, sur une formation publiée.' using errcode = '42501';
  end if;
  insert into public.avis (profil_id, formation_id, note, commentaire)
  values ((select auth.uid()), p_formation, p_note, v_commentaire)
  on conflict (profil_id, formation_id)
  do update set note = excluded.note, commentaire = excluded.commentaire, modifie_le = now();
end;
$$;

-- Supprimer son avis : toujours permis, même si l’accès à la formation est perdu.
create or replace function public.supprimer_avis(p_formation uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.avis where profil_id = (select auth.uid()) and formation_id = p_formation;
$$;

-- ─── Lecture publique : les avis visibles d’une formation publiée, et le sien même masqué, en premier ───
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
    a.masque
  from public.avis a
  join public.profils p on p.id = a.profil_id
  join public.formations f on f.id = a.formation_id
  where a.formation_id = p_formation
    and f.statut = 'publiee'
    and (not a.masque or a.profil_id = (select auth.uid()))
  order by coalesce(a.profil_id = (select auth.uid()), false) desc, a.modifie_le desc
  limit greatest(coalesce(p_limite, 6), 0);
$$;

-- Nombre d’avis visibles par note (barres de la fiche).
create or replace function public.repartition_avis(p_formation uuid)
returns table (note smallint, nombre integer)
language sql
stable
security definer
set search_path = ''
as $$
  select a.note, count(*)::integer
  from public.avis a
  join public.formations f on f.id = a.formation_id
  where a.formation_id = p_formation and f.statut = 'publiee' and not a.masque
  group by a.note;
$$;

-- ─── Équipe : tous les avis, et le masquage (back-office, spec §10) ────────────────────────────────
create or replace function public.avis_equipe()
returns table (
  id uuid,
  formation_titre text,
  formation_slug text,
  auteur text,
  note smallint,
  commentaire text,
  masque boolean,
  cree_le timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, f.titre, f.slug, public.nom_avis(p.prenom, p.nom), a.note, a.commentaire, a.masque, a.cree_le
  from public.avis a
  join public.formations f on f.id = a.formation_id
  join public.profils p on p.id = a.profil_id
  where public.equipe_contenus()
  order by a.cree_le desc;
$$;

create or replace function public.masquer_avis(p_avis uuid, p_masque boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.equipe_contenus() then
    raise exception 'Le masquage des avis est réservé à l’équipe.' using errcode = '42501';
  end if;
  update public.avis set masque = coalesce(p_masque, false) where id = p_avis;
end;
$$;

-- ─── Droits : rien pour public ; la lecture pour tous, l’écriture pour les comptes ───────────────────
revoke execute on function public.recalculer_note(uuid) from public, anon, authenticated;
revoke execute on function public.avis_recalculer() from public, anon, authenticated;
revoke execute on function public.nom_avis(text, text) from public, anon, authenticated;
revoke execute on function public.initiales_avis(text, text) from public, anon, authenticated;
revoke execute on function public.peut_donner_avis(uuid) from public, anon;
revoke execute on function public.enregistrer_avis(uuid, smallint, text) from public, anon;
revoke execute on function public.supprimer_avis(uuid) from public, anon;
revoke execute on function public.avis_formation(uuid, integer) from public;
revoke execute on function public.repartition_avis(uuid) from public;
revoke execute on function public.avis_equipe() from public, anon;
revoke execute on function public.masquer_avis(uuid, boolean) from public, anon;

grant execute on function public.avis_formation(uuid, integer) to anon, authenticated;
grant execute on function public.repartition_avis(uuid) to anon, authenticated;
grant execute on function public.peut_donner_avis(uuid) to authenticated;
grant execute on function public.enregistrer_avis(uuid, smallint, text) to authenticated;
grant execute on function public.supprimer_avis(uuid) to authenticated;
grant execute on function public.avis_equipe() to authenticated;
grant execute on function public.masquer_avis(uuid, boolean) to authenticated;

-- ─── Moyennes recalculées (rejouable) ──────────────────────────────────────────────────────────────
do $$
begin
  perform public.recalculer_note(f.id) from public.formations f;
end;
$$;

commit;
