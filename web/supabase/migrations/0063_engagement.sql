-- Migration 0063 : l'engagement de l'étudiant (lot 6, partie B ; spec du 2 novembre 2026, validée le jour même).
--   - Chaque jour d'apprentissage (heure du Bénin) est noté au moment de l'activité : leçon ouverte ou regardée, leçon
--     terminée, quiz passé, exercice rendu.
--   - Les points : leçon terminée +10, quiz réussi +20, exercice validé +30, certificat +100, jour d'apprentissage +5.
--     Une seule ligne par raison et par référence : rien ne compte deux fois, rien ne se perd. Pas de classement.
--   - Les 8 badges, donnés avec les points ; un niveau tous les 200 points.
--   - L'objectif de la semaine : 3, 5 ou 7 jours.
-- Le passé ne se reconstruit pas, sauf les certificats déjà obtenus, qui donnent leurs points et leurs badges.
-- Rejouable.

begin;

-- ─── Le jour au Bénin (UTC+1 toute l'année) ─────────────────────────────────────────────────────────
create or replace function public.jour_benin(p_moment timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  select (p_moment at time zone 'Africa/Porto-Novo')::date;
$$;

-- ─── Les tables (écrites seulement par la base ; chacun lit les siennes) ────────────────────────────
create table if not exists public.activite_jours (
  profil_id uuid not null references public.profils (id) on delete cascade,
  jour date not null,
  activites integer not null default 0,
  secondes_video integer not null default 0,
  primary key (profil_id, jour)
);

create table if not exists public.points_gagnes (
  id bigint generated always as identity primary key,
  profil_id uuid not null references public.profils (id) on delete cascade,
  raison text not null,
  reference text not null,
  points integer not null,
  gagne_le timestamptz not null default now(),
  constraint points_gagnes_raison check (raison in ('lecon', 'quiz', 'exercice', 'certificat', 'jour')),
  constraint points_gagnes_positifs check (points > 0),
  constraint points_gagnes_une_fois unique (profil_id, raison, reference)
);
create index if not exists points_gagnes_profil_date on public.points_gagnes (profil_id, gagne_le desc);

create table if not exists public.badges_obtenus (
  profil_id uuid not null references public.profils (id) on delete cascade,
  badge text not null,
  obtenu_le timestamptz not null default now(),
  primary key (profil_id, badge),
  constraint badges_obtenus_code check (badge in (
    'premier_pas', 'serie_3', 'serie_7', 'serie_30', 'premier_quiz', 'premier_exercice', 'premier_certificat', 'trois_certificats'
  ))
);

alter table public.activite_jours enable row level security;
alter table public.points_gagnes enable row level security;
alter table public.badges_obtenus enable row level security;
revoke all on public.activite_jours, public.points_gagnes, public.badges_obtenus from anon, authenticated;
grant select on public.activite_jours, public.points_gagnes, public.badges_obtenus to authenticated;
drop policy if exists "activite_jours : chacun les siennes" on public.activite_jours;
create policy "activite_jours : chacun les siennes" on public.activite_jours
  for select to authenticated using (profil_id = (select auth.uid()));
drop policy if exists "points_gagnes : chacun les siens" on public.points_gagnes;
create policy "points_gagnes : chacun les siens" on public.points_gagnes
  for select to authenticated using (profil_id = (select auth.uid()));
drop policy if exists "badges_obtenus : chacun les siens" on public.badges_obtenus;
create policy "badges_obtenus : chacun les siens" on public.badges_obtenus
  for select to authenticated using (profil_id = (select auth.uid()));

-- ─── L'objectif de la semaine (préférence du profil, choisie par une fonction) ──────────────────────
alter table public.profils add column if not exists objectif_jours smallint not null default 5;
alter table public.profils drop constraint if exists profils_objectif_jours;
alter table public.profils add constraint profils_objectif_jours check (objectif_jours in (3, 5, 7));

create or replace function public.choisir_objectif(p_jours integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
begin
  if v_moi is null or public.compte_suspendu() then
    raise exception 'Connectez-vous pour choisir votre objectif.' using errcode = '42501';
  end if;
  if p_jours is null or p_jours not in (3, 5, 7) then
    raise exception 'Choisissez 3, 5 ou 7 jours.' using errcode = '22023';
  end if;
  update public.profils set objectif_jours = p_jours where id = v_moi;
end;
$$;

-- ─── La série : les jours d'affilée qui finissent aujourd'hui (déjà actif) ou hier ──────────────────
create or replace function public.serie_de(p_profil uuid, p_jour date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with depart as (
    select case
      when exists (select 1 from public.activite_jours a where a.profil_id = p_profil and a.jour = p_jour) then p_jour
      when exists (select 1 from public.activite_jours a where a.profil_id = p_profil and a.jour = p_jour - 1) then p_jour - 1
    end as d
  ),
  jours as (
    -- D'affilée tant que l'écart au départ égale le rang (du plus récent au plus ancien).
    select (dp.d - a.jour) as ecart, (row_number() over (order by a.jour desc) - 1)::integer as rang
    from public.activite_jours a, depart dp
    where a.profil_id = p_profil and a.jour <= dp.d
  )
  select count(*)::integer from jours where ecart = rang;
$$;

-- ─── Les points, puis les badges de cette raison ────────────────────────────────────────────────────
create or replace function public.gagner_points(p_profil uuid, p_raison text, p_reference text, p_points integer, p_quand timestamptz default now())
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_badges text[];
  v_serie integer;
begin
  if p_profil is null then
    return false;
  end if;
  insert into public.points_gagnes (profil_id, raison, reference, points, gagne_le)
  values (p_profil, p_raison, p_reference, p_points, p_quand)
  on conflict (profil_id, raison, reference) do nothing;
  if not found then
    return false;
  end if;

  if p_raison = 'lecon' then
    v_badges := array['premier_pas'];
  elsif p_raison = 'quiz' then
    v_badges := array['premier_quiz'];
  elsif p_raison = 'exercice' then
    v_badges := array['premier_exercice'];
  elsif p_raison = 'certificat' then
    v_badges := array['premier_certificat'];
    if (select count(*) from public.points_gagnes g where g.profil_id = p_profil and g.raison = 'certificat') >= 3 then
      v_badges := v_badges || 'trois_certificats'::text;
    end if;
  elsif p_raison = 'jour' then
    v_serie := public.serie_de(p_profil, p_reference::date);
    select coalesce(array_agg(s.badge), '{}') into v_badges
    from (values (3, 'serie_3'), (7, 'serie_7'), (30, 'serie_30')) as s (jours, badge)
    where v_serie >= s.jours;
  end if;

  insert into public.badges_obtenus (profil_id, badge, obtenu_le)
  select p_profil, b, p_quand from unnest(coalesce(v_badges, '{}')) as b
  on conflict (profil_id, badge) do nothing;
  return true;
end;
$$;

-- ─── Le jour d'apprentissage : la première activité du jour vaut 5 points ───────────────────────────
create or replace function public.noter_activite(p_profil uuid, p_secondes integer, p_jour date default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jour date := coalesce(p_jour, public.jour_benin(now()));
  v_secondes integer := greatest(coalesce(p_secondes, 0), 0);
begin
  if p_profil is null then
    return;
  end if;
  insert into public.activite_jours (profil_id, jour, activites, secondes_video)
  values (p_profil, v_jour, 1, v_secondes)
  on conflict (profil_id, jour) do nothing;
  if found then
    perform public.gagner_points(p_profil, 'jour', v_jour::text, 5);
  else
    update public.activite_jours
    set activites = activites + 1, secondes_video = secondes_video + v_secondes
    where profil_id = p_profil and jour = v_jour;
  end if;
end;
$$;

-- ─── Les déclencheurs, sur les tables de l'étudiant ─────────────────────────────────────────────────
-- Leçon ouverte, vidéo regardée ou leçon terminée : une activité ; terminée pour la première fois : +10.
create or replace function public.engagement_progression()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secondes integer := 0;
begin
  if tg_op = 'INSERT' then
    v_secondes := public.secondes_couvertes(new.passages);
  elsif new.passages is distinct from old.passages then
    v_secondes := public.secondes_couvertes(new.passages) - public.secondes_couvertes(old.passages);
  end if;
  perform public.noter_activite(new.profil_id, v_secondes);
  if new.terminee_le is not null and (tg_op = 'INSERT' or old.terminee_le is null) then
    perform public.gagner_points(new.profil_id, 'lecon', new.lecon_id::text, 10);
  end if;
  return null;
end;
$$;
drop trigger if exists progression_engagement on public.progression_lecons;
create trigger progression_engagement
  after insert or update on public.progression_lecons
  for each row execute function public.engagement_progression();

-- Quiz passé : une activité ; réussi (score au moins égal au minimum de la formation) : +20, une fois par quiz.
create or replace function public.engagement_quiz()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.noter_activite(new.profil_id, 0);
  if new.score >= (
    select f.score_quiz
    from public.lecons l
    join public.modules m on m.id = l.module_id
    join public.formations f on f.id = m.formation_id
    where l.id = new.lecon_id
  ) then
    perform public.gagner_points(new.profil_id, 'quiz', new.lecon_id::text, 20);
  end if;
  return null;
end;
$$;
drop trigger if exists tentatives_engagement on public.tentatives_quiz;
create trigger tentatives_engagement
  after insert on public.tentatives_quiz
  for each row execute function public.engagement_quiz();

-- Exercice rendu : une activité (pas la correction du formateur) ; validé : +30, une fois par exercice.
create or replace function public.engagement_rendu()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.noter_activite(new.profil_id, 0);
  end if;
  if new.statut = 'valide' and (tg_op = 'INSERT' or old.statut is distinct from 'valide') then
    perform public.gagner_points(new.profil_id, 'exercice', new.lecon_id::text, 30);
  end if;
  return null;
end;
$$;
drop trigger if exists rendus_engagement on public.rendus_exercices;
create trigger rendus_engagement
  after insert or update of statut on public.rendus_exercices
  for each row execute function public.engagement_rendu();

-- Certificat délivré : +100.
create or replace function public.engagement_certificat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gagner_points(new.profil_id, 'certificat', new.id::text, 100, new.cree_le);
  return null;
end;
$$;
drop trigger if exists certificats_engagement on public.certificats;
create trigger certificats_engagement
  after insert on public.certificats
  for each row execute function public.engagement_certificat();

-- ─── Les certificats déjà obtenus : leurs points et leurs badges, à leur date ───────────────────────
do $rattrapage$
declare
  c record;
begin
  for c in select id, profil_id, cree_le from public.certificats where profil_id is not null order by cree_le, id loop
    perform public.gagner_points(c.profil_id, 'certificat', c.id::text, 100, c.cree_le);
  end loop;
end
$rattrapage$;

-- ─── Les droits ─────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public.jour_benin(timestamptz) from public, anon, authenticated;
revoke execute on function public.serie_de(uuid, date) from public, anon, authenticated;
revoke execute on function public.gagner_points(uuid, text, text, integer, timestamptz) from public, anon, authenticated;
revoke execute on function public.noter_activite(uuid, integer, date) from public, anon, authenticated;
revoke execute on function public.engagement_progression() from public, anon, authenticated;
revoke execute on function public.engagement_quiz() from public, anon, authenticated;
revoke execute on function public.engagement_rendu() from public, anon, authenticated;
revoke execute on function public.engagement_certificat() from public, anon, authenticated;
revoke execute on function public.choisir_objectif(integer) from public, anon;
grant execute on function public.choisir_objectif(integer) to authenticated;

commit;
