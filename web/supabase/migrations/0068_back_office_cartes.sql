-- Migration 0068 : les chiffres des cartes du back-office (demande du 2 novembre 2026 : « reprendre les pages de l'admin
-- comme sur l'espace étudiant ») :
--   - formations_back_office : par formation, ses apprenants (comptes étudiants qui l'ont commencée), ses certificats
--     et ses exercices à corriger ; et le total des apprenants, chacun compté une fois ;
--   - formateurs_back_office : par fiche formateur, ses formations (publiées, toutes), ses apprenants, sa note (moyenne
--     de ses formations pondérée par leurs avis), ses corrections en attente et si un compte y est relié ; et les totaux.
-- Réservé à l'équipe des contenus. À appliquer après la 0067. Rejouable.

begin;

create or replace function public.formations_back_office()
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
  return (
    with suivis as (
      select distinct m.formation_id, pl.profil_id
      from public.progression_lecons pl
      join public.lecons l on l.id = pl.lecon_id
      join public.modules m on m.id = l.module_id
      where not exists (select 1 from public.roles r where r.profil_id = pl.profil_id and r.role <> 'etudiant')
    ),
    a_corriger as (
      select m.formation_id, count(*) as nombre
      from public.derniers_rendus d
      join public.lecons l on l.id = d.lecon_id
      join public.modules m on m.id = l.module_id
      where d.statut = 'en_attente'
      group by m.formation_id
    )
    select jsonb_build_object(
      'apprenants_total', (select count(distinct s.profil_id) from suivis s),
      'formations', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', f.id,
          'apprenants', (select count(*) from suivis s where s.formation_id = f.id),
          'certificats', (select count(*) from public.certificats c where c.formation_id = f.id),
          'a_corriger', coalesce((select a.nombre from a_corriger a where a.formation_id = f.id), 0)
        ))
        from public.formations f
      ), '[]'::jsonb)
    )
  );
end;
$$;

create or replace function public.formateurs_back_office()
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
  return (
    with suivis as (
      select distinct f.formateur_id, pl.profil_id
      from public.progression_lecons pl
      join public.lecons l on l.id = pl.lecon_id
      join public.modules m on m.id = l.module_id
      join public.formations f on f.id = m.formation_id
      where f.formateur_id is not null
        and not exists (select 1 from public.roles r where r.profil_id = pl.profil_id and r.role <> 'etudiant')
    ),
    a_corriger as (
      select f.formateur_id, count(*) as nombre
      from public.derniers_rendus d
      join public.lecons l on l.id = d.lecon_id
      join public.modules m on m.id = l.module_id
      join public.formations f on f.id = m.formation_id
      where d.statut = 'en_attente' and f.formateur_id is not null
      group by f.formateur_id
    ),
    par_formateur as (
      select fo.id,
        (select count(*) from public.formations f where f.formateur_id = fo.id and f.statut = 'publiee') as formations_publiees,
        (select count(*) from public.formations f where f.formateur_id = fo.id) as formations_total,
        (select count(*) from suivis s where s.formateur_id = fo.id) as apprenants,
        (select sum(f.note_moyenne * f.nb_avis) from public.formations f where f.formateur_id = fo.id and f.nb_avis > 0) as notes,
        (select coalesce(sum(f.nb_avis), 0) from public.formations f where f.formateur_id = fo.id and f.nb_avis > 0) as avis,
        coalesce((select a.nombre from a_corriger a where a.formateur_id = fo.id), 0) as a_corriger,
        fo.compte_id is not null as compte_relie
      from public.formateurs fo
    )
    select jsonb_build_object(
      'totaux', jsonb_build_object(
        'formateurs', (select count(*) from par_formateur),
        'formations_publiees', (select coalesce(sum(p.formations_publiees), 0) from par_formateur p),
        'a_corriger', (select coalesce(sum(p.a_corriger), 0) from par_formateur p),
        'note_moyenne', (select round(sum(p.notes) / nullif(sum(p.avis), 0), 1) from par_formateur p)
      ),
      'formateurs', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id,
          'formations_publiees', p.formations_publiees,
          'formations_total', p.formations_total,
          'apprenants', p.apprenants,
          'note', case when p.avis > 0 then round(p.notes / p.avis, 1) end,
          'avis', p.avis,
          'a_corriger', p.a_corriger,
          'compte_relie', p.compte_relie
        ))
        from par_formateur p
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke execute on function public.formations_back_office() from public, anon;
revoke execute on function public.formateurs_back_office() from public, anon;
grant execute on function public.formations_back_office() to authenticated;
grant execute on function public.formateurs_back_office() to authenticated;

commit;
