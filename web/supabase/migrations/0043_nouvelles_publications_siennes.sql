-- Migration 0043 : le bandeau « Nouvelles publications » compte aussi les siennes (liste du 31 octobre 2026, tâche 9).
-- La 0042 les écartait : publiée depuis le téléphone, une publication n'était donc jamais annoncée sur l'ordinateur du
-- même compte. Elles comptent désormais ; l'appareil qui publie l'a déjà en tête de son fil, et son repère (la plus
-- récente du fil) avance avec elle : rien n'y est annoncé en double. Même définition qu'en 0042, sans cette exclusion.
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
