-- Migration 0062 : la vue d'ensemble du back-office (design NdAdmin) et les statistiques par période (lot 6, partie A ;
-- spec du 2 novembre 2026, §4). Domaine « statistiques » : admins et super admin. Calculées à la demande, aux heures et
-- aux mois du Bénin. Une plateforme vide donne des zéros (ou rien), jamais une division par zéro.
-- Rejouable.

begin;

create or replace function public.exiger_statistiques()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  if not public.a_domaine('statistiques') then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;
end;
$$;

-- Un étudiant : un compte sans autre rôle (ni l'équipe, ni un formateur).
create or replace function public.compte_etudiant(p_profil uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.roles r where r.profil_id = p_profil and r.role <> 'etudiant');
$$;

-- La formule de l'abonnement en cours d'un compte à un instant, ou null.
create or replace function public.formule_a(p_profil uuid, p_instant timestamptz)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select f.nom from public.abonnements a join public.formules f on f.id = a.formule_id
  where a.profil_id = p_profil and a.annule_le is null and a.debut <= p_instant and a.fin > p_instant
  order by a.debut desc limit 1;
$$;

-- Le nombre de comptes abonnés à un instant.
create or replace function public.abonnes_a(p_instant timestamptz)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct a.profil_id)::integer from public.abonnements a
  where a.annule_le is null and a.debut <= p_instant and a.fin > p_instant;
$$;

-- ─── La vue d'ensemble (NdAdmin) ────────────────────────────────────────────────────────────────────
create or replace function public.vue_ensemble_back_office(p_maintenant timestamptz default now())
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz constant text := 'Africa/Porto-Novo';
  v_mois timestamptz := date_trunc('month', p_maintenant at time zone v_tz) at time zone v_tz;
  v_actifs integer := public.abonnes_a(p_maintenant);
  v_commencees integer;
  v_terminees integer;
begin
  perform public.exiger_statistiques();

  select count(*)::integer, count(c.id)::integer into v_commencees, v_terminees
  from (
    select distinct p.profil_id, m.formation_id
    from public.progression_lecons p
    join public.lecons l on l.id = p.lecon_id
    join public.modules m on m.id = l.module_id
  ) s
  left join public.certificats c on c.profil_id = s.profil_id and c.formation_id = s.formation_id;

  return jsonb_build_object(
    'utilisateurs', jsonb_build_object(
      'total', (select count(*)::integer from public.profils),
      'ce_mois', (select count(*)::integer from public.profils where cree_le >= v_mois and cree_le <= p_maintenant)
    ),
    'abonnes', jsonb_build_object('actifs', v_actifs, 'mois_precedent', public.abonnes_a(p_maintenant - interval '1 month')),
    'revenus_mois', (select coalesce(sum(montant), 0)::integer from public.paiements
                     where statut = 'reussi' and confirme_le >= v_mois and confirme_le <= p_maintenant),
    'formations', jsonb_build_object(
      'total', (select count(*)::integer from public.formations),
      'brouillons', (select count(*)::integer from public.formations where statut = 'brouillon')
    ),
    'certificats', (select count(*)::integer from public.certificats),
    'taux_completion', case when v_commencees > 0 then round(100.0 * v_terminees / v_commencees)::integer end,
    -- Les abonnements souscrits chaque mois (6 mois) : un renouvellement si le compte en avait déjà un.
    'abonnements_par_mois', (
      select jsonb_agg(jsonb_build_object(
        'mois', to_char(m.debut, 'YYYY-MM'),
        'nouveaux', (select count(*)::integer from public.abonnements a
                     where a.cree_le >= m.debut at time zone v_tz and a.cree_le < (m.debut + interval '1 month') at time zone v_tz
                       and not exists (select 1 from public.abonnements b where b.profil_id = a.profil_id and b.cree_le < a.cree_le)),
        'renouvellements', (select count(*)::integer from public.abonnements a
                     where a.cree_le >= m.debut at time zone v_tz and a.cree_le < (m.debut + interval '1 month') at time zone v_tz
                       and exists (select 1 from public.abonnements b where b.profil_id = a.profil_id and b.cree_le < a.cree_le))
      ) order by m.debut)
      from generate_series(date_trunc('month', p_maintenant at time zone v_tz) - interval '5 months',
                           date_trunc('month', p_maintenant at time zone v_tz), interval '1 month') as m(debut)
    ),
    -- La part de chaque formule parmi les abonnements en cours.
    'formules', (
      select coalesce(jsonb_agg(jsonb_build_object('code', f.code, 'nom', f.nom,
        'part', case when v_actifs > 0 then round(100.0 * (
          select count(distinct a.profil_id) from public.abonnements a
          where a.formule_id = f.id and a.annule_le is null and a.debut <= p_maintenant and a.fin > p_maintenant
        ) / v_actifs)::integer else 0 end) order by f.ordre, f.code), '[]'::jsonb)
      from public.formules f
    ),
    'a_traiter', jsonb_build_object(
      'a_examiner', coalesce(public.nombre_a_examiner(), 0),
      'paiements_echoues', (
        select coalesce(jsonb_agg(x.e order by x.d desc), '[]'::jsonb) from (
          select jsonb_build_object('id', p.id, 'nom', coalesce(public.nom_du_profil(p.profil_id), 'Compte supprimé'), 'formule', f.nom,
                   'operateur', p.operateur, 'moyen_manuel', p.moyen_manuel, 'date', coalesce(p.essai_le, p.cree_le)) as e,
                 coalesce(p.essai_le, p.cree_le) as d
          from public.paiements p join public.formules f on f.id = p.formule_id
          where p.statut = 'echoue' and coalesce(p.essai_le, p.cree_le) between p_maintenant - interval '48 hours' and p_maintenant
          order by d desc limit 5
        ) x
      ),
      'paiements_en_attente', (
        select coalesce(jsonb_agg(x.e order by x.d desc), '[]'::jsonb) from (
          select jsonb_build_object('id', p.id, 'nom', coalesce(public.nom_du_profil(p.profil_id), 'Compte supprimé'), 'formule', f.nom,
                   'operateur', p.operateur, 'moyen_manuel', p.moyen_manuel, 'date', p.essai_le) as e, p.essai_le as d
          from public.paiements p join public.formules f on f.id = p.formule_id
          where p.statut = 'en_attente' and p.essai_le between p_maintenant - interval '24 hours' and p_maintenant - interval '15 minutes'
          order by d desc limit 5
        ) x
      ),
      -- Les abonnements qui finissent dans 7 jours, sans abonnement à la suite.
      'fins_proches', (
        select coalesce(jsonb_agg(x.e order by x.fin), '[]'::jsonb) from (
          select jsonb_build_object('profil_id', a.profil_id, 'nom', public.nom_du_profil(a.profil_id), 'formule', f.nom, 'fin', a.fin,
                   'jours', ceil(extract(epoch from a.fin - p_maintenant) / 86400)::integer) as e, a.fin
          from public.abonnements a join public.formules f on f.id = a.formule_id
          where a.annule_le is null and a.debut <= p_maintenant and a.fin > p_maintenant and a.fin <= p_maintenant + interval '7 days'
            and not exists (select 1 from public.abonnements b where b.profil_id = a.profil_id and b.id <> a.id and b.annule_le is null and b.debut >= a.debut and b.fin > a.fin)
          order by a.fin limit 5
        ) x
      )
    ),
    'dernieres_inscriptions', (
      select coalesce(jsonb_agg(x.e order by x.cree_le desc), '[]'::jsonb) from (
        select jsonb_build_object('id', p.id, 'nom', public.nom_du_profil(p.id), 'cree_le', p.cree_le,
                 'formule', public.formule_a(p.id, p_maintenant)) as e, p.cree_le
        from public.profils p
        where public.compte_etudiant(p.id) and p.cree_le <= p_maintenant
        order by p.cree_le desc limit 4
      ) x
    ),
    -- Les paiements jamais envoyés à Payiz n'y sont pas (comme la liste des paiements, 0051).
    'derniers_paiements', (
      select coalesce(jsonb_agg(x.e order by x.d desc), '[]'::jsonb) from (
        select jsonb_build_object('id', p.id, 'nom', coalesce(public.nom_du_profil(p.profil_id), 'Compte supprimé'), 'formule', f.nom, 'duree_mois', f.duree_mois,
                 'operateur', p.operateur, 'moyen_manuel', p.moyen_manuel, 'montant', p.montant, 'statut', p.statut,
                 'date', coalesce(p.confirme_le, p.essai_le, p.cree_le)) as e,
               coalesce(p.confirme_le, p.essai_le, p.cree_le) as d
        from public.paiements p join public.formules f on f.id = p.formule_id
        where (p.source = 'manuel' or p.essai_le is not null) and coalesce(p.confirme_le, p.essai_le, p.cree_le) <= p_maintenant
        order by d desc limit 5
      ) x
    )
  );
end;
$$;

-- ─── Les statistiques sur une période (30, 90 ou 365 jours) ─────────────────────────────────────────
create or replace function public.statistiques_periode(p_jours integer, p_maintenant timestamptz default now())
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz constant text := 'Africa/Porto-Novo';
  v_debut timestamptz := p_maintenant - make_interval(days => p_jours);
  v_unite text := case when p_jours = 365 then 'month' else 'week' end;
  v_pas interval := case when p_jours = 365 then interval '1 month' else interval '1 week' end;
  v_inscrits integer;
  v_convertis integer;
begin
  perform public.exiger_statistiques();
  if p_jours is null or p_jours not in (30, 90, 365) then
    raise exception 'Période inconnue.' using errcode = '22023';
  end if;

  select count(*)::integer, count(*) filter (where exists (select 1 from public.abonnements a where a.profil_id = p.id))::integer
  into v_inscrits, v_convertis
  from public.profils p
  where public.compte_etudiant(p.id) and p.cree_le >= v_debut and p.cree_le <= p_maintenant;

  return jsonb_build_object(
    'etudiants', jsonb_build_object(
      'inscrits', v_inscrits,
      'courbe', (
        select jsonb_agg(jsonb_build_object('debut', to_char(b.debut, 'YYYY-MM-DD'),
          'nombre', (select count(*)::integer from public.profils p
                     where public.compte_etudiant(p.id) and p.cree_le >= greatest(b.debut at time zone v_tz, v_debut)
                       and p.cree_le < least((b.debut + v_pas) at time zone v_tz, p_maintenant + interval '1 microsecond'))
        ) order by b.debut)
        from generate_series(date_trunc(v_unite, v_debut at time zone v_tz), date_trunc(v_unite, p_maintenant at time zone v_tz), v_pas) as b(debut)
      ),
      'actifs', (select count(distinct profil_id)::integer from public.progression_lecons where vue_le between v_debut and p_maintenant),
      'lecons_terminees', (select count(*)::integer from public.progression_lecons where terminee_le between v_debut and p_maintenant),
      'formations_terminees', (select count(*)::integer from public.certificats
                               where delivre_le between (v_debut at time zone v_tz)::date and (p_maintenant at time zone v_tz)::date),
      'quiz', (
        select jsonb_build_object('passes', count(*)::integer, 'reussis', count(*) filter (where t.score >= f.score_quiz)::integer)
        from public.tentatives_quiz t
        join public.lecons l on l.id = t.lecon_id
        join public.modules m on m.id = l.module_id
        join public.formations f on f.id = m.formation_id
        where t.cree_le between v_debut and p_maintenant
      ),
      'exercices_valides', (select count(*)::integer from public.rendus_exercices
                            where statut = 'valide' and corrige_le between v_debut and p_maintenant),
      'secondes_video', (select coalesce(sum(public.secondes_couvertes(passages)), 0)::integer from public.progression_lecons
                         where vue_le between v_debut and p_maintenant)
    ),
    'formations', (
      select coalesce(jsonb_agg(x.e order by x.titre), '[]'::jsonb) from (
        select f.titre, jsonb_build_object(
          'id', f.id, 'titre', f.titre, 'statut', f.statut::text,
          'suiveurs', s.suiveurs,
          'nouveaux', (select count(*)::integer from (
              select p.profil_id, min(coalesce(p.ouverte_le, p.vue_le)) as premiere
              from public.progression_lecons p join public.lecons l on l.id = p.lecon_id join public.modules m on m.id = l.module_id
              where m.formation_id = f.id group by p.profil_id
            ) n where n.premiere between v_debut and p_maintenant),
          'progression', case when s.suiveurs > 0 and s.publiees > 0 then round(100.0 * s.terminees / (s.suiveurs * s.publiees))::integer else 0 end,
          -- Les étudiants qui la suivent et ont leur certificat (jamais plus de 100 %, même avec des comptes supprimés).
          'achevement', case when s.suiveurs > 0 then round(100.0 * (
            select count(*) from public.certificats c
            where c.formation_id = f.id and exists (
              select 1 from public.progression_lecons p join public.lecons l on l.id = p.lecon_id join public.modules m on m.id = l.module_id
              where m.formation_id = f.id and p.profil_id = c.profil_id)
          ) / s.suiveurs)::integer else 0 end,
          'secondes_video', (select coalesce(sum(public.secondes_couvertes(p.passages)), 0)::integer
                             from public.progression_lecons p join public.lecons l on l.id = p.lecon_id join public.modules m on m.id = l.module_id
                             where m.formation_id = f.id and p.vue_le between v_debut and p_maintenant),
          'note', (select round(avg(a.note), 1) from public.avis a where a.formation_id = f.id and not a.masque),
          'avis', (select count(*)::integer from public.avis a where a.formation_id = f.id and not a.masque),
          'certificats', (select count(*)::integer from public.certificats c where c.formation_id = f.id
                          and c.delivre_le between (v_debut at time zone v_tz)::date and (p_maintenant at time zone v_tz)::date)
        ) as e
        from public.formations f
        cross join lateral (
          select
            (select count(distinct p.profil_id)::integer from public.progression_lecons p join public.lecons l on l.id = p.lecon_id
             join public.modules m on m.id = l.module_id where m.formation_id = f.id) as suiveurs,
            (select count(*)::integer from public.lecons l join public.modules m on m.id = l.module_id
             where m.formation_id = f.id and l.publiee) as publiees,
            (select count(*)::integer from public.progression_lecons p join public.lecons l on l.id = p.lecon_id
             join public.modules m on m.id = l.module_id where m.formation_id = f.id and l.publiee and p.terminee_le is not null) as terminees
        ) s
        where f.statut::text in ('publiee', 'desactivee')
      ) x
    ),
    'business', jsonb_build_object(
      'abonnes_actifs', public.abonnes_a(p_maintenant),
      'nouveaux', (select count(*)::integer from public.abonnements a where a.cree_le between v_debut and p_maintenant
                   and not exists (select 1 from public.abonnements b where b.profil_id = a.profil_id and b.cree_le < a.cree_le)),
      'renouvellements', (select count(*)::integer from public.abonnements a where a.cree_le between v_debut and p_maintenant
                   and exists (select 1 from public.abonnements b where b.profil_id = a.profil_id and b.cree_le < a.cree_le)),
      'revenus', (select coalesce(sum(montant), 0)::integer from public.paiements
                  where statut = 'reussi' and confirme_le between v_debut and p_maintenant),
      'courbe', (
        select jsonb_agg(jsonb_build_object('debut', to_char(b.debut, 'YYYY-MM-DD'),
          'montant', (select coalesce(sum(p.montant), 0)::integer from public.paiements p
                      where p.statut = 'reussi' and p.confirme_le >= greatest(b.debut at time zone v_tz, v_debut)
                        and p.confirme_le < least((b.debut + v_pas) at time zone v_tz, p_maintenant + interval '1 microsecond'))
        ) order by b.debut)
        from generate_series(date_trunc(v_unite, v_debut at time zone v_tz), date_trunc(v_unite, p_maintenant at time zone v_tz), v_pas) as b(debut)
      ),
      'conversion', case when v_inscrits > 0 then round(100.0 * v_convertis / v_inscrits)::integer end,
      'formules', (
        select coalesce(jsonb_agg(jsonb_build_object('code', f.code, 'nom', f.nom,
          'nombre', (select count(*)::integer from public.abonnements a where a.formule_id = f.id and a.cree_le between v_debut and p_maintenant)
        ) order by f.ordre, f.code), '[]'::jsonb)
        from public.formules f
      ),
      'codes_promo', (
        select jsonb_build_object('utilisations', count(*)::integer, 'remise', coalesce(sum(p.remise), 0)::integer)
        from public.paiements p
        where p.statut = 'reussi' and p.code_promo_id is not null and p.confirme_le between v_debut and p_maintenant
      )
    )
  );
end;
$$;

revoke execute on function public.exiger_statistiques() from public, anon, authenticated;
revoke execute on function public.compte_etudiant(uuid) from public, anon, authenticated;
revoke execute on function public.formule_a(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.abonnes_a(timestamptz) from public, anon, authenticated;
revoke execute on function public.vue_ensemble_back_office(timestamptz) from public, anon;
revoke execute on function public.statistiques_periode(integer, timestamptz) from public, anon;
grant execute on function public.vue_ensemble_back_office(timestamptz) to authenticated;
grant execute on function public.statistiques_periode(integer, timestamptz) to authenticated;

commit;
