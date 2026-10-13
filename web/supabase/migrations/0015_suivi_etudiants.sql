-- Étudium · migration 0015 : suivi des étudiants par le formateur et tableau de bord du formateur
-- (spec « Étudiants » et tableau de bord du formateur, 14 octobre 2026).
-- À appliquer dans Supabase, après la 0014 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancé sur une base qui l'a déjà, il ne change rien et ne casse rien.

begin;

-- ─── Définitions (spec, §2) ─────────────────────────────────────────────────────────────────────────
-- État d'un étudiant sur une formation : terminée (toutes les leçons), à risque (rien depuis plus de 10 jours),
-- sinon en cours.
create or replace function public.etat_suivi(p_terminees integer, p_total integer, p_derniere timestamptz, p_maintenant timestamptz)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_total > 0 and p_terminees >= p_total then 'terminee'
    when p_derniere < p_maintenant - interval '10 days' then 'a_risque'
    else 'en_cours'
  end;
$$;

-- Une ligne par étudiant et par formation d'une fiche formateur. Étudiant : un compte qui a ouvert au moins une leçon
-- de la formation (pas encore d'inscription : lot 2). Le compte relié à la fiche et ceux de l'équipe ne comptent pas.
-- Interne : appelée seulement par les fonctions ci-dessous, jamais directement (aucun droit d'exécution).
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
      (select count(*) from public.lecons l join public.modules m on m.id = l.module_id where m.formation_id = f.id)::integer as nb_lecons
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
  join public.lecons l on l.module_id = m.id
  join public.progression_lecons p on p.lecon_id = l.id
  join public.profils pr on pr.id = p.profil_id
  where p.profil_id is distinct from mf.compte_id
    and not exists (select 1 from public.roles r where r.profil_id = p.profil_id and r.role in ('moderateur', 'admin', 'super_admin'))
  group by p.profil_id, pr.prenom, pr.nom, mf.id, mf.titre, mf.nb_lecons;
$$;
revoke execute on function public.suivi_formateur(uuid) from public, anon, authenticated;

-- ─── Les étudiants du formateur ─────────────────────────────────────────────────────────────────────
-- Une page de 25 lignes (étudiant, formation), les plus récemment actifs d'abord. Filtres : une de ses formations,
-- l'état (a_risque, terminees ; toute autre valeur : tous), le nom (sans accents ni majuscules, jamais de joker).
-- Jamais d'adresse e-mail.
create or replace function public.etudiants_formateur(
  p_recherche text default '',
  p_formation uuid default null,
  p_etat text default 'tous',
  p_page integer default 1,
  p_maintenant timestamptz default now()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_fiche uuid := public.ma_fiche_formateur();
  v_q text := public.sans_accents(btrim(coalesce(p_recherche, '')));
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_resultat jsonb;
begin
  if v_fiche is null then
    raise exception 'Votre compte n’est pas encore relié à une fiche formateur.' using errcode = '42501';
  end if;

  with lignes as (
    select s.*, public.etat_suivi(s.terminees, s.total, s.derniere_activite, p_maintenant) as etat
    from public.suivi_formateur(v_fiche) s
  ),
  retenues as (
    select * from lignes x
    where (p_formation is null or x.formation = p_formation)
      and (v_q = '' or strpos(public.sans_accents(x.prenom || ' ' || x.nom), v_q) > 0)
      and case p_etat
        when 'a_risque' then x.etat = 'a_risque'
        when 'terminees' then x.etat = 'terminee'
        else true
      end
  ),
  page as (
    select * from retenues order by derniere_activite desc, etudiant, formation limit 25 offset (v_page - 1) * 25
  )
  select jsonb_build_object(
    'total', (select count(*) from retenues),
    'lignes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'etudiant_id', g.etudiant,
        'prenom', g.prenom,
        'nom', g.nom,
        'formation_id', g.formation,
        'formation_titre', g.formation_titre,
        'terminees', g.terminees,
        'total', g.total,
        'derniere_activite', g.derniere_activite,
        'etat', g.etat
      ) order by g.derniere_activite desc, g.etudiant, g.formation)
      from page g
    ), '[]'::jsonb)
  ) into v_resultat;
  return v_resultat;
end;
$$;

-- La fiche d'un étudiant : chacune des formations du formateur qu'il suit, leçon par leçon (terminée, ouverte, pas
-- encore ouverte ; temps de vidéo). Null s'il ne suit aucune de ses formations.
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
              where l.module_id = m.id
            )
          ) order by m.ordre, m.cree_le), '[]'::jsonb)
          from public.modules m
          where m.formation_id = s.formation
        )
      ) order by s.derniere_activite desc)
      from public.suivi_formateur(v_fiche) s
      where s.etudiant = p_etudiant
    ),
    'remarque', null
  ) into v_resultat
  from public.profils pr
  where pr.id = p_etudiant;
  return v_resultat;
end;
$$;

revoke execute on function public.etudiants_formateur(text, uuid, text, integer, timestamptz) from public, anon;
revoke execute on function public.etudiant_formateur(uuid, timestamptz) from public, anon;
grant execute on function public.etudiants_formateur(text, uuid, text, integer, timestamptz) to authenticated;
grant execute on function public.etudiant_formateur(uuid, timestamptz) to authenticated;

commit;
