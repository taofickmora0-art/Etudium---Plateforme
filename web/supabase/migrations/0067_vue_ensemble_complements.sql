-- Migration 0067 : deux indicateurs de plus sur la vue d'ensemble du back-office (choisis par l'utilisateur le 2 novembre
-- 2026), à côté des six du design :
--   - le taux de conversion : les étudiants abonnés sur les étudiants inscrits ;
--   - les abonnements à renouveler : ceux qui se terminent dans les 7 prochains jours, et parmi eux ceux qui ont déjà un
--     abonnement à la suite.
-- Seulement les comptes étudiants (sans autre rôle). Réservé à qui voit les statistiques. À appliquer après la 0066.
-- Rejouable.

begin;

create or replace function public.vue_ensemble_complements(p_maintenant timestamptz default now())
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_inscrits integer;
  v_abonnes integer;
begin
  perform public.exiger_statistiques();
  select count(*)::integer into v_inscrits
  from public.profils p
  where p.cree_le <= p_maintenant
    and not exists (select 1 from public.roles r where r.profil_id = p.id and r.role <> 'etudiant');
  select count(distinct a.profil_id)::integer into v_abonnes
  from public.abonnements a
  where a.annule_le is null and a.debut <= p_maintenant and a.fin > p_maintenant
    and not exists (select 1 from public.roles r where r.profil_id = a.profil_id and r.role <> 'etudiant');
  return jsonb_build_object(
    'conversion', jsonb_build_object(
      'abonnes', v_abonnes,
      'inscrits', v_inscrits,
      'taux', case when v_inscrits > 0 then round(100.0 * v_abonnes / v_inscrits)::integer end
    ),
    'a_renouveler', (
      select jsonb_build_object('total', count(*)::integer, 'renouveles', count(*) filter (where x.renouvele)::integer)
      from (
        -- Un compte dont l'abonnement en cours se termine dans les 7 jours ; renouvelé s'il en a déjà un à la suite.
        select a.profil_id,
          bool_or(exists (
            select 1 from public.abonnements b
            where b.profil_id = a.profil_id and b.id <> a.id and b.annule_le is null and b.debut >= a.fin - interval '1 minute'
          )) as renouvele
        from public.abonnements a
        where a.annule_le is null and a.debut <= p_maintenant and a.fin > p_maintenant and a.fin <= p_maintenant + interval '7 days'
          and not exists (select 1 from public.roles r where r.profil_id = a.profil_id and r.role <> 'etudiant')
        group by a.profil_id
      ) x
    )
  );
end;
$$;

revoke execute on function public.vue_ensemble_complements(timestamptz) from public, anon;
grant execute on function public.vue_ensemble_complements(timestamptz) to authenticated;

commit;
