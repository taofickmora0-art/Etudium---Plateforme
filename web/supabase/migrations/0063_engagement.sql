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

-- ─── Ma progression : série, points, niveau, semaine, badges (en-tête, profil, tableau de bord) ──────
create or replace function public.ma_progression_jeu()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
  v_aujourdhui date := public.jour_benin(now());
  v_lundi date := date_trunc('week', public.jour_benin(now())::timestamp)::date;
  v_total integer;
begin
  if v_moi is null then
    raise exception 'Connectez-vous pour voir votre progression.' using errcode = '42501';
  end if;
  select coalesce(sum(g.points), 0)::integer into v_total from public.points_gagnes g where g.profil_id = v_moi;
  return jsonb_build_object(
    'serie', public.serie_de(v_moi, v_aujourdhui),
    'points_total', v_total,
    'points_semaine', (
      select coalesce(sum(g.points), 0)::integer from public.points_gagnes g
      where g.profil_id = v_moi and g.gagne_le >= (v_lundi::timestamp at time zone 'Africa/Porto-Novo')
    ),
    -- Un niveau tous les 200 points : niveau 1 de 0 à 199, niveau 2 à partir de 200…
    'niveau', v_total / 200 + 1,
    'points_avant_niveau', (v_total / 200 + 1) * 200 - v_total,
    'objectif_jours', coalesce((select p.objectif_jours from public.profils p where p.id = v_moi), 5),
    'jours_semaine', (
      select jsonb_agg(exists (select 1 from public.activite_jours a where a.profil_id = v_moi and a.jour = v_lundi + i) order by i)
      from generate_series(0, 6) as i
    ),
    'badges', coalesce((
      select jsonb_agg(jsonb_build_object('code', b.badge, 'obtenu_le', b.obtenu_le) order by b.obtenu_le, b.badge)
      from public.badges_obtenus b where b.profil_id = v_moi
    ), '[]'::jsonb)
  );
end;
$$;

-- ─── Les recommandations (Q7) ───────────────────────────────────────────────────────────────────────
-- Dans cet ordre, chaque formation une seule fois, à son premier rang :
--   1. « suite » : après un certificat (le plus récent d'abord), la première formation qui suit dans chacun de ses
--      parcours (ordre du parcours, puis titre), avec « Vous avez terminé « X ». Découvrez maintenant « Y ». » ;
--   2. « monetisation » : la formation Business liée à une compétence digitale commencée ; puis celles sans lien, qui
--      valent pour toutes les compétences (0048) ;
--   3. « parcours » : les formations des parcours où le compte a commencé quelque chose, populaires (étudiants qui l'ont
--      commencée) puis nouvelles ;
--   4. « catalogue » : les autres, dans le même ordre.
-- Seulement des formations publiées que le compte n'a ni commencées ni terminées.
create or replace function public.recommandations_pour_moi(p_nombre integer default 3)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
  v_nombre integer := least(greatest(coalesce(p_nombre, 3), 1), 12);
begin
  if v_moi is null then
    raise exception 'Connectez-vous pour voir vos recommandations.' using errcode = '42501';
  end if;
  return coalesce((
    with mes_lecons as (
      select m.formation_id, max(pl.vue_le) as vue_le
      from public.progression_lecons pl
      join public.lecons l on l.id = pl.lecon_id
      join public.modules m on m.id = l.module_id
      where pl.profil_id = v_moi
      group by m.formation_id
    ),
    commencees as (
      select formation_id as id from mes_lecons
      union
      select c.formation_id from public.certificats c where c.profil_id = v_moi and c.formation_id is not null
    ),
    candidates as (
      select f.id, f.slug, f.titre, f.publiee_le, coalesce(po.apprenants, 0) as apprenants
      from public.formations f
      left join (
        select m.formation_id, count(distinct pl.profil_id) as apprenants
        from public.progression_lecons pl
        join public.lecons l on l.id = pl.lecon_id
        join public.modules m on m.id = l.module_id
        where not exists (select 1 from public.roles r where r.profil_id = pl.profil_id and r.role <> 'etudiant')
        group by m.formation_id
      ) po on po.formation_id = f.id
      where f.statut = 'publiee' and not exists (select 1 from commencees c where c.id = f.id)
    ),
    suites as (
      select x.id, x.message, row_number() over (order by x.cree_le desc, x.parcours_ordre, x.parcours_id) as rang
      from (
        select distinct on (c.id, fp.parcours_id)
          ca.id, c.cree_le, p.ordre as parcours_ordre, fp.parcours_id,
          format('Vous avez terminé « %s ». Découvrez maintenant « %s ».', ft.titre, ca.titre) as message
        from public.certificats c
        join public.formations ft on ft.id = c.formation_id
        join public.formations_parcours fp on fp.formation_id = c.formation_id
        join public.parcours p on p.id = fp.parcours_id
        join public.formations_parcours apres on apres.parcours_id = fp.parcours_id
        join candidates ca on ca.id = apres.formation_id
        where c.profil_id = v_moi and (apres.ordre, ca.titre) > (fp.ordre, ft.titre)
        order by c.id, fp.parcours_id, apres.ordre, ca.titre
      ) x
    ),
    competences as (
      select ml.formation_id as id, ml.vue_le
      from mes_lecons ml
      where exists (
        select 1 from public.formations_parcours fp join public.parcours p on p.id = fp.parcours_id
        where fp.formation_id = ml.formation_id and p.couleur = 'digital'
      )
    ),
    monetisation as (
      select y.id, row_number() over (order by y.liee desc, y.vue_le desc nulls last, y.apprenants desc, y.titre) as rang
      from (
        select ca.id, ca.titre, ca.apprenants, true as liee, max(co.vue_le) as vue_le
        from public.formations_monetisation fm
        join candidates ca on ca.id = fm.business_id
        join competences co on co.id = fm.competence_id
        group by ca.id, ca.titre, ca.apprenants
        union all
        select ca.id, ca.titre, ca.apprenants, false, null
        from candidates ca
        where exists (select 1 from competences)
          and not exists (select 1 from public.formations_monetisation fm where fm.business_id = ca.id)
          and exists (
            select 1 from public.formations_parcours fp join public.parcours p on p.id = fp.parcours_id
            where fp.formation_id = ca.id and p.couleur = 'business'
          )
      ) y
    ),
    mes_parcours as (
      select distinct fp.parcours_id from public.formations_parcours fp join commencees c on c.id = fp.formation_id
    ),
    toutes as (
      select s.id, s.message, 1 as regle, s.rang from suites s
      union all
      select mo.id, null, 2, mo.rang from monetisation mo
      union all
      select ca.id, null, 3, row_number() over (order by ca.apprenants desc, ca.publiee_le desc nulls last, ca.titre)
      from candidates ca
      where exists (select 1 from public.formations_parcours fp join mes_parcours mp on mp.parcours_id = fp.parcours_id where fp.formation_id = ca.id)
      union all
      select ca.id, null, 4, row_number() over (order by ca.apprenants desc, ca.publiee_le desc nulls last, ca.titre)
      from candidates ca
    ),
    retenues as (
      select r.* from (select distinct on (t.id) t.id, t.message, t.regle, t.rang from toutes t order by t.id, t.regle, t.rang) r
      order by r.regle, r.rang
      limit v_nombre
    )
    select jsonb_agg(
      jsonb_build_object(
        'id', ca.id, 'slug', ca.slug, 'titre', ca.titre,
        'motif', case r.regle when 1 then 'suite' when 2 then 'monetisation' when 3 then 'parcours' else 'catalogue' end,
        'message', r.message
      ) order by r.regle, r.rang
    )
    from retenues r join candidates ca on ca.id = r.id
  ), '[]'::jsonb);
end;
$$;

-- ─── Le tableau de bord de l'étudiant (§1), en une lecture ──────────────────────────────────────────
-- La progression des formations (indicateurs, « Continuer », leçon suivante) est calculée par l'appli, avec les règles de
-- « Mes formations » ; la prochaine session vient de prochaine_session(). Ici : le reste.
create or replace function public.mon_tableau_de_bord()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
begin
  if v_moi is null then
    raise exception 'Connectez-vous pour voir votre tableau de bord.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'certificats', jsonb_build_object(
      'nombre', (select count(*) from public.certificats c where c.profil_id = v_moi),
      'titres', coalesce((
        select jsonb_agg(x.formation_titre order by x.cree_le desc)
        from (select c.formation_titre, c.cree_le from public.certificats c where c.profil_id = v_moi order by c.cree_le desc limit 2) x
      ), '[]'::jsonb)
    ),
    -- À faire : l'exercice dont la correction demande une reprise, le quiz tenté mais pas encore réussi.
    'a_faire', coalesce((
      select jsonb_agg(jsonb_build_object('type', x.type, 'formation', x.formation, 'slug', x.slug, 'lecon_id', x.lecon_id, 'lecon', x.lecon) order by x.rang, x.quand desc)
      from (
        select y.* from (
          select 1 as rang, 'exercice' as type, f.titre as formation, f.slug, l.id as lecon_id, l.titre as lecon, coalesce(d.corrige_le, d.cree_le) as quand
          from public.derniers_rendus d
          join public.lecons l on l.id = d.lecon_id
          join public.modules m on m.id = l.module_id
          join public.formations f on f.id = m.formation_id
          where d.profil_id = v_moi and d.statut = 'a_corriger' and l.publiee and f.statut = 'publiee'
          union all
          select 2, 'quiz', f.titre, f.slug, l.id, l.titre, max(t.cree_le)
          from public.tentatives_quiz t
          join public.lecons l on l.id = t.lecon_id
          join public.modules m on m.id = l.module_id
          join public.formations f on f.id = m.formation_id
          where t.profil_id = v_moi and l.publiee and f.statut = 'publiee'
          group by f.titre, f.slug, l.id, l.titre, f.score_quiz
          having max(t.score) < f.score_quiz
        ) y
        order by y.rang, y.quand desc
        limit 6
      ) x
    ), '[]'::jsonb),
    -- L'activité récente : quiz réussis, exercices validés, certificats et badges (pas les leçons ni les jours).
    'activite', coalesce((
      select jsonb_agg(jsonb_build_object('type', x.type, 'titre', x.titre, 'formation', x.formation, 'score', x.score, 'quand', x.quand) order by x.quand desc, x.genre)
      from (
        select z.* from (
          select g.raison as type, l.titre, f.titre as formation,
            case when g.raison = 'quiz' then (select max(t.score) from public.tentatives_quiz t where t.profil_id = v_moi and t.lecon_id = l.id)::integer end as score,
            g.gagne_le as quand, 0 as genre
          from public.points_gagnes g
          join public.lecons l on l.id::text = g.reference
          join public.modules m on m.id = l.module_id
          join public.formations f on f.id = m.formation_id
          where g.profil_id = v_moi and g.raison in ('quiz', 'exercice')
          union all
          select 'certificat', c.formation_titre, null, null, g.gagne_le, 0
          from public.points_gagnes g
          join public.certificats c on c.id::text = g.reference
          where g.profil_id = v_moi and g.raison = 'certificat'
          union all
          select 'badge', b.badge, null, null, b.obtenu_le, 1
          from public.badges_obtenus b
          where b.profil_id = v_moi
        ) z
        order by z.quand desc, z.genre
        limit 3
      ) x
    ), '[]'::jsonb),
    'jeu', public.ma_progression_jeu(),
    'recommandations', public.recommandations_pour_moi(3)
  );
end;
$$;

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
revoke execute on function public.ma_progression_jeu() from public, anon;
grant execute on function public.ma_progression_jeu() to authenticated;
revoke execute on function public.recommandations_pour_moi(integer) from public, anon;
grant execute on function public.recommandations_pour_moi(integer) to authenticated;
revoke execute on function public.mon_tableau_de_bord() from public, anon;
grant execute on function public.mon_tableau_de_bord() to authenticated;

commit;
