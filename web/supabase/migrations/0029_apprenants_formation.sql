-- Étudium · migration 0029 : l'onglet « Apprenants » d'une formation (refonte des formations, étape C,
-- spec docs/superpowers/specs/2026-10-15-apprenants-formation-design.md).
-- À appliquer dans Supabase, après la 0028 : SQL Editor → New query → coller tout le fichier → Run. Rejouable.
--
-- Dans l'éditeur d'une formation, l'équipe et le formateur de la formation voient qui la suit : progression, première
-- leçon ouverte, dernière activité, état. Mêmes définitions que la page « Étudiants » (0015, reprise en 0027) :
-- apprenant = a ouvert une leçon publiée ; ni le formateur de la formation ni l'équipe ; à risque après 10 jours sans
-- activité ; terminée quand toutes les leçons publiées le sont. Jamais d'adresse e-mail.

begin;

-- ─── Une ligne par apprenant ────────────────────────────────────────────────────────────────────────
-- Interne : appelée seulement par apprenants_formation, jamais directement (aucun droit d'exécution).
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
      (select count(*) from public.lecons l join public.modules m on m.id = l.module_id where m.formation_id = f.id and l.publiee)::integer as nb_lecons
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
  join public.lecons l on l.module_id = m.id and l.publiee
  join public.progression_lecons p on p.lecon_id = l.id
  join public.profils pr on pr.id = p.profil_id
  where p.profil_id is distinct from lf.compte_id
    and not exists (select 1 from public.roles r where r.profil_id = p.profil_id and r.role in ('moderateur', 'admin', 'super_admin'))
  group by p.profil_id, pr.prenom, pr.nom, lf.nb_lecons;
$$;

-- ─── Les apprenants d'une formation ─────────────────────────────────────────────────────────────────
-- Une page de 25 apprenants, les plus récemment actifs d'abord, et le résumé de toute la formation. Filtres : l'état
-- (a_risque, terminees ; toute autre valeur : tous), le nom (sans accents ni majuscules, jamais de joker).
create or replace function public.apprenants_formation(
  p_formation uuid,
  p_recherche text default '',
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
  v_q text := public.sans_accents(btrim(coalesce(p_recherche, '')));
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_resultat jsonb;
begin
  if not (public.equipe_contenus() or public.formateur_de(p_formation)) then
    raise exception 'Cette formation n’est pas l’une de vos formations.' using errcode = '42501';
  end if;

  with lignes as (
    select s.*, public.etat_suivi(s.terminees, s.total, s.derniere_activite, p_maintenant) as etat
    from public.suivi_formation(p_formation) s
  ),
  retenues as (
    select * from lignes x
    where (v_q = '' or strpos(public.sans_accents(x.prenom || ' ' || x.nom), v_q) > 0)
      and case p_etat
        when 'a_risque' then x.etat = 'a_risque'
        when 'terminees' then x.etat = 'terminee'
        else true
      end
  ),
  page as (
    select * from retenues order by derniere_activite desc, etudiant limit 25 offset (v_page - 1) * 25
  )
  select jsonb_build_object(
    'resume', (
      select jsonb_build_object(
        'apprenants', count(*),
        'progression_moyenne', coalesce(round(avg(case when x.total > 0 then 100.0 * x.terminees / x.total else 0 end))::integer, 0),
        'terminees', count(*) filter (where x.etat = 'terminee'),
        'a_risque', count(*) filter (where x.etat = 'a_risque')
      )
      from lignes x
    ),
    'total', (select count(*) from retenues),
    'lignes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'etudiant_id', g.etudiant,
        'prenom', g.prenom,
        'nom', g.nom,
        'terminees', g.terminees,
        'total', g.total,
        'premiere_ouverture', g.premiere_ouverture,
        'derniere_activite', g.derniere_activite,
        'etat', g.etat
      ) order by g.derniere_activite desc, g.etudiant)
      from page g
    ), '[]'::jsonb)
  ) into v_resultat;
  return v_resultat;
end;
$$;

-- ─── Droits d'exécution ─────────────────────────────────────────────────────────────────────────────
revoke execute on function public.suivi_formation(uuid) from public, anon, authenticated;
revoke execute on function public.apprenants_formation(uuid, text, text, integer, timestamptz) from public, anon;
grant execute on function public.apprenants_formation(uuid, text, text, integer, timestamptz) to authenticated;

commit;
