-- Migration 0065 : les chiffres de la page Parcours du back-office (demande du 2 novembre 2026 : « un tableau de bord
-- avec le nombre de formations par parcours », option A choisie). Par parcours : les formations publiées et en
-- brouillon, les apprenants (comptes étudiants, sans autre rôle, qui ont commencé une de ses formations) et les
-- certificats délivrés pour ses formations. En haut : les parcours actifs, les formations publiées, les apprenants et
-- les certificats, chacun compté une seule fois. Réservé à l'équipe des contenus. À appliquer après la 0064.
-- Rejouable.

begin;

create or replace function public.parcours_back_office()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.a_domaine('contenus') then
    raise exception 'Réservé à l’équipe des contenus.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'totaux', jsonb_build_object(
      'parcours_actifs', (select count(*) from public.parcours p where p.actif),
      'formations_publiees', (select count(*) from public.formations f where f.statut = 'publiee'),
      'apprenants', (
        select count(distinct pl.profil_id) from public.progression_lecons pl
        where not exists (select 1 from public.roles r where r.profil_id = pl.profil_id and r.role <> 'etudiant')
      ),
      'certificats', (select count(*) from public.certificats c)
    ),
    'parcours', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'formations_publiees', (
          select count(*) from public.formations_parcours fp join public.formations f on f.id = fp.formation_id
          where fp.parcours_id = p.id and f.statut = 'publiee'
        ),
        'formations_brouillons', (
          select count(*) from public.formations_parcours fp join public.formations f on f.id = fp.formation_id
          where fp.parcours_id = p.id and f.statut = 'brouillon'
        ),
        'apprenants', (
          select count(distinct pl.profil_id)
          from public.formations_parcours fp
          join public.modules m on m.formation_id = fp.formation_id
          join public.lecons l on l.module_id = m.id
          join public.progression_lecons pl on pl.lecon_id = l.id
          where fp.parcours_id = p.id
            and not exists (select 1 from public.roles r where r.profil_id = pl.profil_id and r.role <> 'etudiant')
        ),
        'certificats', (
          select count(*) from public.certificats c join public.formations_parcours fp on fp.formation_id = c.formation_id
          where fp.parcours_id = p.id
        )
      ) order by p.ordre, p.cree_le)
      from public.parcours p
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.parcours_back_office() from public, anon;
grant execute on function public.parcours_back_office() to authenticated;

commit;
