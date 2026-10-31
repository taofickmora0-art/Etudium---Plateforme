-- Migration 0042 : le bandeau « Nouvelles publications » (liste du 31 octobre 2026, tâche 9).
-- Le fil de la communauté vérifie de temps en temps s'il a du nouveau, sans recharger la page : la base compte les
-- publications parues dans l'espace affiché depuis la plus récente que le fil montre (`p_apres` ; nul pour un fil vide :
-- toutes), et rend les trois derniers auteurs (initiales, photo) pour le bandeau. Mêmes règles que le fil « Les plus
-- récentes » (fil_communaute, 0026) : espace ouvert au compte, publication parue. Pas les siennes, que le fil ajoute
-- lui-même, sauf une programmée qui vient de paraître (écrite plus d'une minute avant, comme en 0026 et 0041).
-- Rejouable.

begin;

create or replace function public.nouvelles_publications(p_espace text, p_apres timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
  v_general boolean := p_espace = 'general';
  v_parcours uuid;
  v_vide constant jsonb := jsonb_build_object('nombre', 0, 'auteurs', '[]'::jsonb);
  v_resultat jsonb;
begin
  perform public.exiger_compte_actif();
  if not v_general and p_espace is distinct from 'tous' then
    begin
      v_parcours := p_espace::uuid;
    exception when invalid_text_representation then
      return v_vide;
    end;
    if not public.peut_lire_espace(v_parcours) then
      return v_vide;
    end if;
  end if;

  with nouvelles as (
    select p.auteur, p.cree_le
    from public.publications p
    where (case when v_general then p.parcours_id is null when v_parcours is not null then p.parcours_id = v_parcours else public.peut_lire_espace(p.parcours_id) end)
      and p.statut = 'publiee' and p.cree_le <= now()
      and (p_apres is null or p.cree_le > p_apres)
      and (p.auteur <> v_moi or p.cree_le > p.ecrite_le + interval '1 minute')
  ),
  derniers as (
    select n.auteur, max(n.cree_le) as derniere
    from nouvelles n
    group by n.auteur
    order by max(n.cree_le) desc
    limit 3
  )
  select jsonb_build_object(
    'nombre', (select count(*) from nouvelles),
    'auteurs', coalesce((
      select jsonb_agg(jsonb_build_object('initiales', public.initiales_avis(pr.prenom, pr.nom), 'photo', pr.photo_url) order by d.derniere desc)
      from derniers d
      join public.profils pr on pr.id = d.auteur
    ), '[]'::jsonb)
  ) into v_resultat;
  return v_resultat;
end;
$$;

revoke execute on function public.nouvelles_publications(text, timestamptz) from public, anon;
grant execute on function public.nouvelles_publications(text, timestamptz) to authenticated;

commit;
