-- Étudium · migration 0031 : les quiz (lot 3, étape A ; spec docs/superpowers/specs/2026-10-15-lot-3-quiz-exercices-certificats-design.md).
-- À appliquer dans Supabase, après la 0030 : SQL Editor → New query → coller tout le fichier → Run. Rejouable.
--
-- Un quiz est une leçon de type « quiz » dans le programme. Le formateur de la formation (ou l'équipe) en écrit les
-- questions : choix unique, réponses multiples, vrai ou faux, réponse courte. L'étudiant le passe autant de fois qu'il
-- veut ; la base corrige, garde le meilleur score et le compare au score minimal de la formation. Les bonnes réponses
-- ne quittent la base qu'avec le résultat. Quiz et exercices ne comptent pas dans la progression (R17).

begin;

-- ─── Le type d'un élément du programme ; le score minimal d'une formation ────────────────────────────
alter table public.lecons add column if not exists type text not null default 'lecon';
alter table public.lecons drop constraint if exists lecons_type;
alter table public.lecons add constraint lecons_type check (type in ('lecon', 'quiz', 'exercice'));

alter table public.formations add column if not exists score_quiz smallint not null default 70;
alter table public.formations drop constraint if exists formations_score_quiz;
alter table public.formations add constraint formations_score_quiz check (score_quiz between 0 and 100);

-- ─── Questions et tentatives (lues et écrites par les fonctions seulement) ─────────────────────────────
create table if not exists public.questions_quiz (
  id uuid primary key default gen_random_uuid(),
  lecon_id uuid not null references public.lecons (id) on delete cascade,
  ordre integer not null default 0,
  genre text not null,
  enonce text not null,
  -- [{ "texte": "Zotero", "correcte": true }, …] ; vide pour une réponse courte.
  choix jsonb not null default '[]'::jsonb,
  -- Les réponses acceptées d'une réponse courte.
  reponses text[] not null default '{}',
  explication text not null default '',
  constraint questions_quiz_genre check (genre in ('unique', 'multiple', 'vrai_faux', 'courte')),
  constraint questions_quiz_enonce check (char_length(enonce) between 1 and 1000),
  constraint questions_quiz_explication check (char_length(explication) <= 1000)
);
create index if not exists questions_quiz_lecon_idx on public.questions_quiz (lecon_id, ordre);
alter table public.questions_quiz enable row level security;
revoke all on public.questions_quiz from anon, authenticated;

create table if not exists public.tentatives_quiz (
  id uuid primary key default gen_random_uuid(),
  profil_id uuid not null references public.profils (id) on delete cascade,
  lecon_id uuid not null references public.lecons (id) on delete cascade,
  numero integer not null,
  bonnes integer not null,
  total integer not null,
  score smallint not null,
  -- La correction telle qu'elle a été rendue (les questions peuvent changer ensuite).
  detail jsonb not null default '[]'::jsonb,
  cree_le timestamptz not null default now(),
  constraint tentatives_quiz_score check (score between 0 and 100)
);
create index if not exists tentatives_quiz_profil_idx on public.tentatives_quiz (profil_id, lecon_id);
create index if not exists tentatives_quiz_lecon_idx on public.tentatives_quiz (lecon_id);
alter table public.tentatives_quiz enable row level security;
revoke all on public.tentatives_quiz from anon, authenticated;

-- ─── Outils ─────────────────────────────────────────────────────────────────────────────────────────
-- Le formateur de la formation de la leçon, ou l'équipe.
create or replace function public.editeur_de_lecon(p_lecon uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not public.compte_suspendu() and (public.equipe_contenus() or public.formateur_de(public.formation_de_la_lecon(p_lecon)));
$$;

-- Une réponse courte, sans majuscules, accents ni espaces en trop.
create or replace function public.normaliser_reponse(p_texte text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(btrim(public.sans_accents(coalesce(p_texte, ''))), '\s+', ' ', 'g');
$$;

-- ─── Écrire un quiz ─────────────────────────────────────────────────────────────────────────────────
-- Les questions avec leurs bonnes réponses, pour l'éditeur.
create or replace function public.quiz_editeur(p_lecon uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.editeur_de_lecon(p_lecon) then
    raise exception 'Cette formation n’est pas l’une de vos formations.' using errcode = '42501';
  end if;
  return jsonb_build_object('questions', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', q.id, 'genre', q.genre, 'enonce', q.enonce, 'choix', q.choix, 'reponses', to_jsonb(q.reponses), 'explication', q.explication
    ) order by q.ordre)
    from public.questions_quiz q
    where q.lecon_id = p_lecon
  ), '[]'::jsonb));
end;
$$;

-- Remplace toutes les questions, après les avoir vérifiées (rien n'est remplacé si l'une est mal formée).
create or replace function public.enregistrer_quiz(p_lecon uuid, p_questions jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_q jsonb;
  v_i integer := 0;
  v_genre text;
  v_enonce text;
  v_choix jsonb;
  v_nb integer;
  v_bonnes integer;
begin
  if not public.editeur_de_lecon(p_lecon) then
    raise exception 'Cette formation n’est pas l’une de vos formations.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.lecons where id = p_lecon and type = 'quiz') then
    raise exception 'Cette leçon n’est pas un quiz.';
  end if;
  if p_questions is null or jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) = 0 then
    raise exception 'Ajoutez au moins une question.';
  end if;
  if jsonb_array_length(p_questions) > 100 then
    raise exception 'Un quiz compte 100 questions au plus.';
  end if;

  for v_q in select value from jsonb_array_elements(p_questions) loop
    v_i := v_i + 1;
    v_genre := v_q ->> 'genre';
    v_enonce := btrim(coalesce(v_q ->> 'enonce', ''));
    if v_genre is null or v_genre not in ('unique', 'multiple', 'vrai_faux', 'courte') then
      raise exception 'La question % a un type inconnu.', v_i;
    end if;
    if v_enonce = '' then
      raise exception 'La question % n’a pas d’énoncé.', v_i;
    end if;
    if char_length(v_enonce) > 1000 then
      raise exception 'La question % : l’énoncé dépasse 1 000 caractères.', v_i;
    end if;
    if char_length(coalesce(v_q ->> 'explication', '')) > 1000 then
      raise exception 'La question % : l’explication dépasse 1 000 caractères.', v_i;
    end if;
    if v_genre = 'courte' then
      if jsonb_typeof(coalesce(v_q -> 'reponses', '[]'::jsonb)) <> 'array' or not exists (
        select 1 from jsonb_array_elements_text(coalesce(v_q -> 'reponses', '[]'::jsonb)) x where btrim(x) <> ''
      ) then
        raise exception 'La question % doit avoir au moins une réponse acceptée.', v_i;
      end if;
    else
      v_choix := coalesce(v_q -> 'choix', '[]'::jsonb);
      if jsonb_typeof(v_choix) <> 'array' then
        raise exception 'La question % doit proposer de 2 à 6 réponses.', v_i;
      end if;
      v_nb := jsonb_array_length(v_choix);
      if v_nb < 2 or v_nb > 6 then
        raise exception 'La question % doit proposer de 2 à 6 réponses.', v_i;
      end if;
      if exists (select 1 from jsonb_array_elements(v_choix) c where btrim(coalesce(c ->> 'texte', '')) = '') then
        raise exception 'La question % a une réponse vide.', v_i;
      end if;
      select count(*) filter (where c ->> 'correcte' = 'true') into v_bonnes from jsonb_array_elements(v_choix) c;
      if v_genre = 'multiple' and v_bonnes < 1 then
        raise exception 'La question % doit avoir au moins une bonne réponse.', v_i;
      end if;
      if v_genre <> 'multiple' and v_bonnes <> 1 then
        raise exception 'La question % doit avoir une seule bonne réponse.', v_i;
      end if;
      if v_genre = 'vrai_faux' and (v_nb <> 2 or v_choix -> 0 ->> 'texte' <> 'Vrai' or v_choix -> 1 ->> 'texte' <> 'Faux') then
        raise exception 'La question % : vrai ou faux attend les réponses « Vrai » et « Faux ».', v_i;
      end if;
    end if;
  end loop;

  delete from public.questions_quiz where lecon_id = p_lecon;
  insert into public.questions_quiz (lecon_id, ordre, genre, enonce, choix, reponses, explication)
  select
    p_lecon,
    e.ord,
    e.q ->> 'genre',
    btrim(e.q ->> 'enonce'),
    case when e.q ->> 'genre' = 'courte' then '[]'::jsonb else (
      select jsonb_agg(jsonb_build_object('texte', btrim(c ->> 'texte'), 'correcte', c ->> 'correcte' = 'true') order by o)
      from jsonb_array_elements(e.q -> 'choix') with ordinality as t(c, o)
    ) end,
    case when e.q ->> 'genre' = 'courte' then array(
      select btrim(x) from jsonb_array_elements_text(e.q -> 'reponses') x where btrim(x) <> ''
    ) else '{}'::text[] end,
    btrim(coalesce(e.q ->> 'explication', ''))
  from jsonb_array_elements(p_questions) with ordinality as e(q, ord);
  return jsonb_array_length(p_questions);
end;
$$;

-- ─── Passer un quiz ─────────────────────────────────────────────────────────────────────────────────
-- Les questions, sans les bonnes réponses ni les explications ; null sans accès (ou si ce n'est pas un quiz).
create or replace function public.quiz_a_passer(p_lecon uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_score smallint;
begin
  if v_uid is null or not public.acces_lecon(p_lecon) then
    return null;
  end if;
  select f.score_quiz into v_score
  from public.lecons l
  join public.modules m on m.id = l.module_id
  join public.formations f on f.id = m.formation_id
  where l.id = p_lecon and l.type = 'quiz';
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'score_minimal', v_score,
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'genre', q.genre, 'enonce', q.enonce,
        'choix', (select coalesce(jsonb_agg(c ->> 'texte' order by o), '[]'::jsonb) from jsonb_array_elements(q.choix) with ordinality as t(c, o))
      ) order by q.ordre)
      from public.questions_quiz q
      where q.lecon_id = p_lecon
    ), '[]'::jsonb),
    'meilleur', (select max(t.score) from public.tentatives_quiz t where t.profil_id = v_uid and t.lecon_id = p_lecon),
    'tentatives', (select count(*) from public.tentatives_quiz t where t.profil_id = v_uid and t.lecon_id = p_lecon)
  );
end;
$$;

-- Corrige les réponses ({ "<question>": [indices] | "texte" }), enregistre la tentative et rend le détail.
-- Une question sans réponse est fausse ; des réponses multiples ne sont justes que si ce sont exactement les bonnes.
create or replace function public.envoyer_quiz(p_lecon uuid, p_reponses jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_score_min smallint;
  v_total integer;
  v_bonnes integer := 0;
  v_detail jsonb := '[]'::jsonb;
  v_q record;
  v_rep jsonb;
  v_ok boolean;
  v_votre text;
  v_bonne text;
  v_indices integer[];
  v_correctes integer[];
  v_numero integer;
  v_score smallint;
  v_meilleur smallint;
begin
  if v_uid is null or not public.acces_lecon(p_lecon) then
    raise exception 'Ce quiz ne vous est pas ouvert.' using errcode = '42501';
  end if;
  select f.score_quiz into v_score_min
  from public.lecons l
  join public.modules m on m.id = l.module_id
  join public.formations f on f.id = m.formation_id
  where l.id = p_lecon and l.type = 'quiz';
  if not found then
    raise exception 'Ce quiz ne vous est pas ouvert.' using errcode = '42501';
  end if;
  if (select count(*) from public.tentatives_quiz where profil_id = v_uid and cree_le > now() - interval '10 minutes') >= 30 then
    raise exception 'Trop de tentatives en peu de temps : réessayez dans quelques minutes.';
  end if;
  select count(*) into v_total from public.questions_quiz where lecon_id = p_lecon;
  if v_total = 0 then
    raise exception 'Ce quiz n’a pas encore de questions.';
  end if;
  if p_reponses is null or jsonb_typeof(p_reponses) <> 'object' then
    p_reponses := '{}'::jsonb;
  end if;

  for v_q in select * from public.questions_quiz where lecon_id = p_lecon order by ordre loop
    v_rep := p_reponses -> v_q.id::text;
    if v_q.genre = 'courte' then
      v_votre := case when jsonb_typeof(v_rep) = 'string' then left(v_rep #>> '{}', 500) else '' end;
      v_ok := public.normaliser_reponse(v_votre) <> ''
        and exists (select 1 from unnest(v_q.reponses) r where public.normaliser_reponse(r) = public.normaliser_reponse(v_votre));
      v_bonne := v_q.reponses[1];
    else
      v_indices := case when jsonb_typeof(v_rep) = 'array' then array(
        select distinct x::integer from jsonb_array_elements_text(v_rep) x where x ~ '^[0-9]{1,2}$' order by 1
      ) else '{}'::integer[] end;
      v_correctes := array(
        select (o - 1)::integer from jsonb_array_elements(v_q.choix) with ordinality as t(c, o) where c ->> 'correcte' = 'true' order by 1
      );
      v_ok := cardinality(v_indices) > 0 and v_indices = v_correctes;
      v_votre := coalesce((
        select string_agg(c ->> 'texte', ', ' order by o)
        from jsonb_array_elements(v_q.choix) with ordinality as t(c, o)
        where (o - 1)::integer = any (v_indices)
      ), '');
      v_bonne := (
        select string_agg(c ->> 'texte', ', ' order by o)
        from jsonb_array_elements(v_q.choix) with ordinality as t(c, o)
        where c ->> 'correcte' = 'true'
      );
    end if;
    if v_ok then
      v_bonnes := v_bonnes + 1;
    end if;
    v_detail := v_detail || jsonb_build_array(jsonb_build_object(
      'question_id', v_q.id, 'enonce', v_q.enonce, 'genre', v_q.genre, 'votre_reponse', v_votre,
      'correcte', v_ok, 'bonne_reponse', coalesce(v_bonne, ''), 'explication', v_q.explication
    ));
  end loop;

  v_score := round(100.0 * v_bonnes / v_total);
  select coalesce(max(numero), 0) + 1 into v_numero from public.tentatives_quiz where profil_id = v_uid and lecon_id = p_lecon;
  insert into public.tentatives_quiz (profil_id, lecon_id, numero, bonnes, total, score, detail)
  values (v_uid, p_lecon, v_numero, v_bonnes, v_total, v_score, v_detail);
  select max(score) into v_meilleur from public.tentatives_quiz where profil_id = v_uid and lecon_id = p_lecon;

  return jsonb_build_object(
    'score', v_score, 'bonnes', v_bonnes, 'total', v_total, 'reussi', v_score >= v_score_min,
    'meilleur', v_meilleur, 'numero', v_numero, 'score_minimal', v_score_min, 'detail', v_detail
  );
end;
$$;

-- Le meilleur score du compte à chaque quiz d'une formation : { "<leçon>": 75, … }.
create or replace function public.mes_scores_quiz(p_formation uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(s.lecon_id::text, s.meilleur), '{}'::jsonb)
  from (
    select t.lecon_id, max(t.score) as meilleur
    from public.tentatives_quiz t
    join public.lecons l on l.id = t.lecon_id
    join public.modules m on m.id = l.module_id
    where t.profil_id = (select auth.uid()) and m.formation_id = p_formation
    group by t.lecon_id
  ) s;
$$;

-- ─── Les comptages de leçons ignorent les quiz et les exercices (0027, 0029 reprises) ─────────────────
create or replace function public.peut_donner_avis(p_formation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and not public.compte_suspendu()
    and not public.formateur_de(p_formation)
    and exists (select 1 from public.formations f where f.id = p_formation and f.statut = 'publiee')
    and (
      select count(*) > 0 and count(p.terminee_le) * 2 >= count(*)
      from public.lecons l
      join public.modules m on m.id = l.module_id
      left join public.progression_lecons p on p.lecon_id = l.id and p.profil_id = (select auth.uid())
      where m.formation_id = p_formation and l.publiee and l.type = 'lecon'
    );
$$;

create or replace function public.suivi_formateur(p_fiche uuid)
returns table (
  etudiant uuid,
  prenom text,
  nom text,
  formation uuid,
  formation_titre text,
  terminees integer,
  total integer,
  secondes integer,
  derniere_activite timestamptz,
  premiere_ouverture timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with mes_formations as (
    select
      f.id, f.titre, fo.compte_id,
      (select count(*) from public.lecons l join public.modules m on m.id = l.module_id where m.formation_id = f.id and l.publiee and l.type = 'lecon')::integer as nb_lecons
    from public.formations f
    join public.formateurs fo on fo.id = f.formateur_id
    where f.formateur_id = p_fiche
  )
  select
    p.profil_id, pr.prenom, pr.nom, mf.id, mf.titre,
    count(p.terminee_le)::integer,
    mf.nb_lecons,
    coalesce(sum(public.secondes_couvertes(p.passages)), 0)::integer,
    max(greatest(p.vue_le, p.terminee_le, p.dernier_envoi)),
    min(p.ouverte_le)
  from mes_formations mf
  join public.modules m on m.formation_id = mf.id
  join public.lecons l on l.module_id = m.id and l.publiee and l.type = 'lecon'
  join public.progression_lecons p on p.lecon_id = l.id
  join public.profils pr on pr.id = p.profil_id
  where p.profil_id is distinct from mf.compte_id
    and not exists (select 1 from public.roles r where r.profil_id = p.profil_id and r.role in ('moderateur', 'admin', 'super_admin'))
  group by p.profil_id, pr.prenom, pr.nom, mf.id, mf.titre, mf.nb_lecons;
$$;

create or replace function public.etudiant_formateur(p_etudiant uuid, p_maintenant timestamptz default now())
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_fiche uuid := public.ma_fiche_formateur();
  v_resultat jsonb;
begin
  if v_fiche is null then
    raise exception 'Votre compte n’est pas encore relié à une fiche formateur.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.suivi_formateur(v_fiche) s where s.etudiant = p_etudiant) then
    return null;
  end if;

  select jsonb_build_object(
    'id', pr.id,
    'prenom', pr.prenom,
    'nom', pr.nom,
    'formations', (
      select jsonb_agg(jsonb_build_object(
        'id', s.formation,
        'titre', s.formation_titre,
        'terminees', s.terminees,
        'total', s.total,
        'secondes', s.secondes,
        'derniere_activite', s.derniere_activite,
        'etat', public.etat_suivi(s.terminees, s.total, s.derniere_activite, p_maintenant),
        'modules', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', m.id,
            'titre', m.titre,
            'lecons', (
              select coalesce(jsonb_agg(jsonb_build_object(
                'id', l.id,
                'titre', l.titre,
                'etat', case when p.terminee_le is not null then 'terminee' when p.lecon_id is not null then 'ouverte' else 'non_ouverte' end,
                'terminee_le', p.terminee_le,
                'secondes', coalesce(public.secondes_couvertes(p.passages), 0)
              ) order by l.ordre, l.cree_le), '[]'::jsonb)
              from public.lecons l
              left join public.progression_lecons p on p.lecon_id = l.id and p.profil_id = p_etudiant
              where l.module_id = m.id and l.publiee and l.type = 'lecon'
            )
          ) order by m.ordre, m.cree_le), '[]'::jsonb)
          from public.modules m
          where m.formation_id = s.formation
        )
      ) order by s.derniere_activite desc)
      from public.suivi_formateur(v_fiche) s
      where s.etudiant = p_etudiant
    ),
    'remarque', (
      select jsonb_build_object('texte', r.texte, 'modifiee_le', r.modifiee_le)
      from public.remarques_formateur r
      where r.formateur = (select auth.uid()) and r.etudiant = p_etudiant
    )
  ) into v_resultat
  from public.profils pr
  where pr.id = p_etudiant;
  return v_resultat;
end;
$$;

create or replace function public.statistiques_back_office(p_maintenant timestamptz default now())
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_mois timestamptz := date_trunc('month', p_maintenant);
  v_resultat jsonb;
begin
  if not public.equipe_contenus() then
    raise exception 'Les statistiques sont réservées à l’équipe.' using errcode = '42501';
  end if;

  with
    -- Une ligne par étudiant et par formation commencée : sa part de leçons terminées.
    suivis as (
      select p.profil_id, m.formation_id, count(p.terminee_le) as terminees
      from public.progression_lecons p
      join public.lecons l on l.id = p.lecon_id
      join public.modules m on m.id = l.module_id
      where l.publiee and l.type = 'lecon'
      group by p.profil_id, m.formation_id
    ),
    totaux as (
      select m.formation_id, count(*) as lecons
      from public.lecons l
      join public.modules m on m.id = l.module_id
      where l.publiee and l.type = 'lecon'
      group by m.formation_id
    ),
    top as (
      select f.titre, f.slug, count(*)::integer as etudiants
      from suivis s
      join public.formations f on f.id = s.formation_id
      where f.statut = 'publiee'
      group by f.id, f.titre, f.slug
      order by count(*) desc, f.titre
      limit 5
    )
  select jsonb_build_object(
    'utilisateurs', (select count(*) from public.profils),
    'inscrits_semaine', (select count(*) from public.profils where cree_le > p_maintenant - interval '7 days' and cree_le <= p_maintenant),
    'inscrits_mois', (select count(*) from public.profils where cree_le >= v_mois and cree_le <= p_maintenant),
    'inscrits_mois_precedent', (select count(*) from public.profils where cree_le >= v_mois - interval '1 month' and cree_le < v_mois),
    'progression_moyenne', (
      select round(avg(100.0 * s.terminees / t.lecons))::integer
      from suivis s
      join totaux t on t.formation_id = s.formation_id
      where t.lecons > 0
    ),
    'formations_suivies', coalesce((select jsonb_agg(jsonb_build_object('titre', titre, 'slug', slug, 'etudiants', etudiants) order by etudiants desc, titre) from top), '[]'::jsonb)
  )
  into v_resultat;

  return v_resultat;
end;
$$;

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
          count(pl.terminee_le) filter (where l.publiee and l.type = 'lecon') as terminees,
          (select count(*) from public.lecons l2 join public.modules m2 on m2.id = l2.module_id where m2.formation_id = fo.id and l2.publiee and l2.type = 'lecon') as total,
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

create or replace function public.envoyer_en_relecture(p_formation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.formateur_de(p_formation) then
    raise exception 'Cette formation n’est pas la vôtre.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.formations where id = p_formation and statut = 'brouillon') then
    raise exception 'Seul un brouillon s’envoie en relecture.';
  end if;
  if not exists (
    select 1 from public.lecons l join public.modules m on m.id = l.module_id where m.formation_id = p_formation and l.publiee and l.type = 'lecon'
  ) then
    raise exception 'Publiez au moins une leçon avant d’envoyer la formation en relecture.';
  end if;
  update public.formations
  set envoyee_le = now(), renvoyee_le = null, remarque_relecture = null
  where id = p_formation;
end;
$$;

create or replace function public.suivi_formation(p_formation uuid)
returns table (
  etudiant uuid,
  prenom text,
  nom text,
  terminees integer,
  total integer,
  premiere_ouverture timestamptz,
  derniere_activite timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with la_formation as (
    select
      f.id,
      fo.compte_id,
      (select count(*) from public.lecons l join public.modules m on m.id = l.module_id where m.formation_id = f.id and l.publiee and l.type = 'lecon')::integer as nb_lecons
    from public.formations f
    left join public.formateurs fo on fo.id = f.formateur_id
    where f.id = p_formation
  )
  select
    p.profil_id, pr.prenom, pr.nom,
    count(p.terminee_le)::integer,
    lf.nb_lecons,
    min(p.ouverte_le),
    max(greatest(p.vue_le, p.terminee_le, p.dernier_envoi))
  from la_formation lf
  join public.modules m on m.formation_id = lf.id
  join public.lecons l on l.module_id = m.id and l.publiee and l.type = 'lecon'
  join public.progression_lecons p on p.lecon_id = l.id
  join public.profils pr on pr.id = p.profil_id
  where p.profil_id is distinct from lf.compte_id
    and not exists (select 1 from public.roles r where r.profil_id = p.profil_id and r.role in ('moderateur', 'admin', 'super_admin'))
  group by p.profil_id, pr.prenom, pr.nom, lf.nb_lecons;
$$;

-- ─── Droits d'exécution ─────────────────────────────────────────────────────────────────────────────
revoke execute on function public.editeur_de_lecon(uuid) from public, anon, authenticated;
revoke execute on function public.normaliser_reponse(text) from public, anon, authenticated;
revoke execute on function public.quiz_editeur(uuid) from public, anon;
grant execute on function public.quiz_editeur(uuid) to authenticated;
revoke execute on function public.enregistrer_quiz(uuid, jsonb) from public, anon;
grant execute on function public.enregistrer_quiz(uuid, jsonb) to authenticated;
revoke execute on function public.quiz_a_passer(uuid) from public, anon;
grant execute on function public.quiz_a_passer(uuid) to authenticated;
revoke execute on function public.envoyer_quiz(uuid, jsonb) from public, anon;
grant execute on function public.envoyer_quiz(uuid, jsonb) to authenticated;
revoke execute on function public.mes_scores_quiz(uuid) from public, anon;
grant execute on function public.mes_scores_quiz(uuid) to authenticated;

commit;
