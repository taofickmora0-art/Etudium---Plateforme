-- Migration 0066 : la fiche d'un parcours au back-office (demande du 2 novembre 2026 : « voir les formations, changer
-- le parcours d'une formation, les apprenants aussi et autres »). L'équipe des contenus seulement.
--   - parcours_detail_back_office : les chiffres du parcours, ses formations dans l'ordre (statut, apprenants,
--     certificats, autres parcours), ses apprenants (le plus récemment actif d'abord) et ses prochaines sessions live ;
--   - ranger_formation_parcours : une formation à un rang du parcours ;
--   - changer_parcours_formation : une formation passe d'un parcours à un autre (en fin du parcours d'arrivée), sauf si
--     son lien de monétisation (compétence ↔ Business) n'est plus valable après ;
--   - ajouter_formation_parcours : une formation existante entre aussi dans ce parcours, en fin.
-- À appliquer après la 0065. Rejouable.

begin;

create or replace function public.exiger_equipe_contenus_parcours()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.a_domaine('contenus') then
    raise exception 'Réservé à l’équipe des contenus.' using errcode = '42501';
  end if;
end;
$$;

-- ─── La fiche ───────────────────────────────────────────────────────────────────────────────────────
create or replace function public.parcours_detail_back_office(p_parcours uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_equipe_contenus_parcours();
  if not exists (select 1 from public.parcours p where p.id = p_parcours) then
    return null;
  end if;
  return (
    with suivis as (
      -- Un compte étudiant (sans autre rôle) et une formation du parcours qu'il a commencée.
      select pl.profil_id, m.formation_id, max(pl.vue_le) as vue_le
      from public.formations_parcours fp
      join public.modules m on m.formation_id = fp.formation_id
      join public.lecons l on l.module_id = m.id
      join public.progression_lecons pl on pl.lecon_id = l.id
      where fp.parcours_id = p_parcours
        and not exists (select 1 from public.roles r where r.profil_id = pl.profil_id and r.role <> 'etudiant')
      group by pl.profil_id, m.formation_id
    ),
    certifies as (
      select c.profil_id, c.formation_id
      from public.certificats c
      join public.formations_parcours fp on fp.formation_id = c.formation_id
      where fp.parcours_id = p_parcours
    )
    select jsonb_build_object(
      'chiffres', jsonb_build_object(
        'formations_publiees', (
          select count(*) from public.formations_parcours fp join public.formations f on f.id = fp.formation_id
          where fp.parcours_id = p_parcours and f.statut = 'publiee'
        ),
        'formations_brouillons', (
          select count(*) from public.formations_parcours fp join public.formations f on f.id = fp.formation_id
          where fp.parcours_id = p_parcours and f.statut = 'brouillon'
        ),
        'apprenants', (select count(distinct s.profil_id) from suivis s),
        'certificats', (select count(*) from certifies),
        'sessions_a_venir', (
          select count(*) from public.sessions_live s where s.parcours_id = p_parcours and s.statut = 'programmee' and s.debut > now()
        ),
        'publications_30j', (
          select count(*) from public.publications pu
          where pu.parcours_id = p_parcours and pu.statut = 'publiee' and pu.cree_le > now() - interval '30 days' and pu.cree_le <= now()
        )
      ),
      'formations', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', f.id, 'titre', f.titre, 'slug', f.slug, 'statut', f.statut,
          'apprenants', (select count(*) from suivis s where s.formation_id = f.id),
          'certificats', (select count(*) from certifies c where c.formation_id = f.id),
          'autres_parcours', coalesce((
            select jsonb_agg(pa.nom order by pa.ordre, pa.cree_le)
            from public.formations_parcours fp2 join public.parcours pa on pa.id = fp2.parcours_id
            where fp2.formation_id = f.id and fp2.parcours_id <> p_parcours
          ), '[]'::jsonb)
        ) order by fp.ordre, f.titre)
        from public.formations_parcours fp join public.formations f on f.id = fp.formation_id
        where fp.parcours_id = p_parcours
      ), '[]'::jsonb),
      'apprenants', jsonb_build_object(
        'total', (select count(distinct s.profil_id) from suivis s),
        'liste', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', x.profil_id, 'nom', coalesce(public.nom_du_profil(x.profil_id), 'Compte supprimé'),
            'formations', x.formations, 'certificats', x.certificats, 'derniere_activite', x.derniere
          ) order by x.derniere desc)
          from (
            select s.profil_id, count(*) as formations, max(s.vue_le) as derniere,
              (select count(*) from certifies c where c.profil_id = s.profil_id) as certificats
            from suivis s
            group by s.profil_id
            order by max(s.vue_le) desc
            limit 100
          ) x
        ), '[]'::jsonb)
      ),
      -- Les formations qu'on peut encore y ajouter (pas archivées).
      'a_ajouter', coalesce((
        select jsonb_agg(jsonb_build_object('id', f.id, 'titre', f.titre, 'statut', f.statut) order by f.titre)
        from public.formations f
        where f.statut <> 'archivee'
          and not exists (select 1 from public.formations_parcours fp where fp.parcours_id = p_parcours and fp.formation_id = f.id)
      ), '[]'::jsonb),
      'sessions', coalesce((
        select jsonb_agg(jsonb_build_object('id', s.id, 'titre', s.titre, 'debut', s.debut) order by s.debut)
        from (
          select s.id, s.titre, s.debut from public.sessions_live s
          where s.parcours_id = p_parcours and s.statut = 'programmee' and s.debut > now()
          order by s.debut
          limit 3
        ) s
      ), '[]'::jsonb)
    )
  );
end;
$$;

-- ─── Ranger une formation dans le parcours ──────────────────────────────────────────────────────────
create or replace function public.ranger_formation_parcours(p_parcours uuid, p_formation uuid, p_position integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_rang integer;
begin
  perform public.exiger_equipe_contenus_parcours();
  perform 1 from public.parcours p where p.id = p_parcours for update;
  if not exists (select 1 from public.formations_parcours fp where fp.parcours_id = p_parcours and fp.formation_id = p_formation) then
    raise exception 'Cette formation n’est pas dans ce parcours.';
  end if;
  v_ids := array(
    select fp.formation_id from public.formations_parcours fp join public.formations f on f.id = fp.formation_id
    where fp.parcours_id = p_parcours and fp.formation_id <> p_formation
    order by fp.ordre, f.titre
  );
  v_rang := least(greatest(coalesce(p_position, 1), 1), coalesce(array_length(v_ids, 1), 0) + 1);
  v_ids := v_ids[1:v_rang - 1] || p_formation || v_ids[v_rang:];
  update public.formations_parcours fp set ordre = x.rang
  from unnest(v_ids) with ordinality as x (id, rang)
  where fp.parcours_id = p_parcours and fp.formation_id = x.id;
end;
$$;

-- ─── Changer une formation de parcours ──────────────────────────────────────────────────────────────
create or replace function public.changer_parcours_formation(p_formation uuid, p_depuis uuid, p_vers uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message constant text := 'Cette formation est liée à la monétisation (une compétence et sa formation Business) : retirez d’abord ce lien dans sa fiche.';
begin
  perform public.exiger_equipe_contenus_parcours();
  if p_depuis = p_vers then
    return;
  end if;
  if not exists (select 1 from public.formations_parcours fp where fp.parcours_id = p_depuis and fp.formation_id = p_formation) then
    raise exception 'Cette formation n’est pas dans ce parcours.';
  end if;
  if not exists (select 1 from public.parcours p where p.id = p_vers) then
    raise exception 'Ce parcours n’existe plus.';
  end if;
  -- Ses liens de monétisation doivent rester valables : une formation Business reste dans un parcours Business, une
  -- compétence dans un parcours Compétences digitales.
  if exists (select 1 from public.formations_monetisation fm where fm.business_id = p_formation)
     and not exists (
       select 1 from public.parcours pa
       where pa.couleur = 'business'
         and (pa.id = p_vers or pa.id in (select fp.parcours_id from public.formations_parcours fp where fp.formation_id = p_formation and fp.parcours_id <> p_depuis))
     ) then
    raise exception '%', v_message;
  end if;
  if exists (select 1 from public.formations_monetisation fm where fm.competence_id = p_formation)
     and not exists (
       select 1 from public.parcours pa
       where pa.couleur = 'digital'
         and (pa.id = p_vers or pa.id in (select fp.parcours_id from public.formations_parcours fp where fp.formation_id = p_formation and fp.parcours_id <> p_depuis))
     ) then
    raise exception '%', v_message;
  end if;
  perform 1 from public.parcours p where p.id = p_vers for update;
  delete from public.formations_parcours fp where fp.formation_id = p_formation and fp.parcours_id = p_depuis;
  insert into public.formations_parcours (formation_id, parcours_id, ordre)
  values (p_formation, p_vers, (select coalesce(max(fp.ordre), 0) + 1 from public.formations_parcours fp where fp.parcours_id = p_vers))
  on conflict do nothing;
end;
$$;

-- ─── Ajouter une formation existante au parcours ────────────────────────────────────────────────────
create or replace function public.ajouter_formation_parcours(p_parcours uuid, p_formation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_equipe_contenus_parcours();
  if not exists (select 1 from public.parcours p where p.id = p_parcours) or not exists (select 1 from public.formations f where f.id = p_formation) then
    raise exception 'Ce parcours ou cette formation n’existe plus.';
  end if;
  perform 1 from public.parcours p where p.id = p_parcours for update;
  insert into public.formations_parcours (formation_id, parcours_id, ordre)
  values (p_formation, p_parcours, (select coalesce(max(fp.ordre), 0) + 1 from public.formations_parcours fp where fp.parcours_id = p_parcours))
  on conflict do nothing;
end;
$$;

-- ─── Les droits ─────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public.exiger_equipe_contenus_parcours() from public, anon, authenticated;
revoke execute on function public.parcours_detail_back_office(uuid) from public, anon;
revoke execute on function public.ranger_formation_parcours(uuid, uuid, integer) from public, anon;
revoke execute on function public.changer_parcours_formation(uuid, uuid, uuid) from public, anon;
revoke execute on function public.ajouter_formation_parcours(uuid, uuid) from public, anon;
grant execute on function public.parcours_detail_back_office(uuid) to authenticated;
grant execute on function public.ranger_formation_parcours(uuid, uuid, integer) to authenticated;
grant execute on function public.changer_parcours_formation(uuid, uuid, uuid) to authenticated;
grant execute on function public.ajouter_formation_parcours(uuid, uuid) to authenticated;

commit;
