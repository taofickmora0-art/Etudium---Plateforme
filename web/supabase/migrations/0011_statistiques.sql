-- Étudium · migration 0011 : les chiffres du tableau de bord du back-office (vue globale de la plateforme).
-- À appliquer dans Supabase, après la 0010 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancé sur une base qui l'a déjà, il ne change rien et ne casse rien.

begin;

-- Réservé à l'équipe (admin, moderateur, super_admin) : un étudiant ne lit jamais ces chiffres.
-- `p_maintenant` fixe la date de référence (les tests s'en servent) ; par défaut, maintenant.
-- Les revenus, abonnés et sessions live arrivent avec leurs lots (2 et 5) : la fonction s'enrichira alors.
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
      group by p.profil_id, m.formation_id
    ),
    totaux as (
      select m.formation_id, count(*) as lecons
      from public.lecons l
      join public.modules m on m.id = l.module_id
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

revoke execute on function public.statistiques_back_office(timestamptz) from public, anon;
grant execute on function public.statistiques_back_office(timestamptz) to authenticated;

commit;
