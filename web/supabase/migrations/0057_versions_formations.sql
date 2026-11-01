-- Migration 0057 : l'historique des versions d'une formation (fin du lot 4, spec §3 ; demande du 1er novembre 2026).
-- Une version (numéro, date, auteur, résumé, instantané du contenu) naît à la mise en ligne, à chaque « Publier les
-- modifications », et quand une leçon est publiée ou retirée d'une formation en ligne. Restaurer remet le contenu d'une
-- version dans les brouillons (ou directement pour ce que les étudiants ne voient pas) : rien ne change pour eux avant
-- « Publier les modifications ». Une leçon supprimée depuis revient, non publiée (un quiz, sans ses questions). Les
-- questions des quiz, les fichiers, la couverture et les réglages de l'équipe ne sont pas versionnés. Rejouable.

begin;

-- ─── L'origine d'une leçon recréée par une restauration ─────────────────────────────────────────────
alter table public.lecons add column if not exists restauree_de uuid;

-- ─── Les versions ───────────────────────────────────────────────────────────────────────────────────
create table if not exists public.versions_formations (
  id uuid primary key default gen_random_uuid(),
  formation_id uuid not null references public.formations (id) on delete cascade,
  numero integer not null,
  cree_le timestamptz not null default now(),
  auteur_id uuid references public.profils (id) on delete set null,
  resume text not null,
  contenu jsonb not null,
  constraint versions_formations_numero unique (formation_id, numero)
);
alter table public.versions_formations enable row level security;
revoke all on public.versions_formations from anon, authenticated;
grant select on public.versions_formations to authenticated;
drop policy if exists "versions_formations : lecture par les éditeurs" on public.versions_formations;
create policy "versions_formations : lecture par les éditeurs" on public.versions_formations
  for select to authenticated
  using ((select public.equipe_contenus()) or public.formateur_de(formation_id));

-- L'instantané : les informations générales, puis les modules et leurs leçons (contenu, ordre, publiée ou non).
create or replace function public.instantane_formation(p_formation uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'infos', public.donnees_formation(p_formation),
    'modules', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'titre', m.titre,
          'ordre', m.ordre,
          'lecons', coalesce((
            select jsonb_agg(
              public.donnees_lecon(l.id) || jsonb_build_object('id', l.id, 'type', l.type, 'ordre', l.ordre, 'publiee', l.publiee)
              order by l.ordre, l.cree_le
            )
            from public.lecons l
            where l.module_id = m.id
          ), '[]'::jsonb)
        )
        order by m.ordre, m.cree_le
      )
      from public.modules m
      where m.formation_id = p_formation
    ), '[]'::jsonb)
  );
$$;

-- Une nouvelle version, numérotée à la suite ; l'auteur est le compte qui agit.
create or replace function public.noter_version(p_formation uuid, p_resume text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_numero integer;
begin
  perform 1 from public.formations f where f.id = p_formation for update;
  select coalesce(max(v.numero), 0) + 1 into v_numero from public.versions_formations v where v.formation_id = p_formation;
  insert into public.versions_formations (formation_id, numero, auteur_id, resume, contenu)
  values (p_formation, v_numero, (select auth.uid()), p_resume, public.instantane_formation(p_formation));
  return v_numero;
end;
$$;

-- ─── Quand une version naît ─────────────────────────────────────────────────────────────────────────
create or replace function public.version_mise_en_ligne()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.statut = 'publiee' and old.statut is distinct from 'publiee' then
    perform public.noter_version(new.id, 'Mise en ligne');
  end if;
  return null;
end;
$$;
drop trigger if exists formations_version_mise_en_ligne on public.formations;
create trigger formations_version_mise_en_ligne
  after update of statut on public.formations
  for each row execute function public.version_mise_en_ligne();

create or replace function public.version_publication_lecon()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_formation uuid;
begin
  if new.publiee is distinct from old.publiee then
    select m.formation_id into v_formation from public.modules m where m.id = new.module_id;
    if v_formation is not null and public.formation_visible(v_formation) then
      perform public.noter_version(
        v_formation,
        format('Leçon « %s » %s', new.titre, case when new.publiee then 'mise en ligne' else 'retirée' end)
      );
    end if;
  end if;
  return null;
end;
$$;
drop trigger if exists lecons_version_publication on public.lecons;
create trigger lecons_version_publication
  after update of publiee on public.lecons
  for each row execute function public.version_publication_lecon();

-- ─── Publier les modifications : une version (même corps qu'en 0056, plus la version et son résumé) ──
create or replace function public.publier_modifications(p_formation uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
  v_n integer := 0;
  v_infos boolean := false;
  v_lecons integer := 0;
  v_titre text;
  v_resume text;
  v_version integer;
  v_bf public.brouillons_formations;
  v_bl public.brouillons_lecons;
begin
  if not public.editeur_de_formation(p_formation) then
    raise exception 'Vous ne pouvez pas modifier cette formation.' using errcode = '42501';
  end if;
  if not public.equipe_contenus() and not public.formation_visible(p_formation) then
    raise exception 'Cette formation n’est pas encore en ligne : envoyez-la en relecture.';
  end if;
  perform 1 from public.formations f where f.id = p_formation for update;

  select * into v_bf from public.brouillons_formations b where b.formation_id = p_formation for update;
  if found then
    perform public.appliquer_donnees_formation(p_formation, v_bf.donnees);
    update public.formations set revision = greatest(revision, v_bf.revision) + 1, revise_par = v_moi where id = p_formation;
    delete from public.brouillons_formations where formation_id = p_formation;
    v_n := v_n + 1;
    v_infos := true;
  end if;

  for v_bl in
    select b.* from public.brouillons_lecons b
    join public.lecons l on l.id = b.lecon_id
    join public.modules m on m.id = l.module_id
    where m.formation_id = p_formation
    for update of b
  loop
    perform public.appliquer_donnees_lecon(v_bl.lecon_id, v_bl.donnees);
    update public.lecons set revision = greatest(revision, v_bl.revision) + 1, revise_par = v_moi where id = v_bl.lecon_id;
    delete from public.brouillons_lecons where lecon_id = v_bl.lecon_id;
    v_n := v_n + 1;
    v_lecons := v_lecons + 1;
    v_titre := v_bl.donnees ->> 'titre';
  end loop;

  if v_n = 0 then
    return jsonb_build_object('publiees', 0, 'version', null);
  end if;
  if not public.equipe_contenus() then
    perform public.marquer_modifiee_par_formateur(p_formation);
  end if;
  v_resume := case
    when v_infos and v_lecons = 0 then 'Informations générales modifiées'
    when v_infos then format('Informations générales et %s %s modifiées', v_lecons, case when v_lecons > 1 then 'leçons' else 'leçon' end)
    when v_lecons = 1 then format('Leçon « %s » modifiée', v_titre)
    else format('%s leçons modifiées', v_lecons)
  end;
  v_version := public.noter_version(p_formation, v_resume);
  return jsonb_build_object('publiees', v_n, 'version', v_version);
end;
$$;

-- ─── L'historique ───────────────────────────────────────────────────────────────────────────────────
create or replace function public.versions_formation(p_formation uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_derniere integer;
begin
  if not public.editeur_de_formation(p_formation) then
    raise exception 'Vous ne pouvez pas modifier cette formation.' using errcode = '42501';
  end if;
  select max(v.numero) into v_derniere from public.versions_formations v where v.formation_id = p_formation;
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', v.id, 'numero', v.numero, 'cree_le', v.cree_le, 'auteur', public.nom_du_profil(v.auteur_id),
        'resume', v.resume, 'en_ligne', v.numero = v_derniere
      )
      order by v.numero desc
    )
    from public.versions_formations v
    where v.formation_id = p_formation
  ), '[]'::jsonb);
end;
$$;

-- ─── Restaurer ──────────────────────────────────────────────────────────────────────────────────────
-- Écrire des données vérifiées comme le ferait l'éditeur : dans le brouillon si la leçon (ou la formation) est visible
-- ou en a déjà un, directement sinon. La révision augmente : un éditeur resté ouvert sera en conflit, sans rien écraser.
create or replace function public.ecrire_lecon(p_lecon uuid, d jsonb, p_auteur uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.brouillons_lecons b where b.lecon_id = p_lecon) then
    update public.brouillons_lecons set donnees = d, revision = revision + 1, modifie_par = p_auteur, modifie_le = now() where lecon_id = p_lecon;
  elsif public.lecon_visible(p_lecon) then
    insert into public.brouillons_lecons (lecon_id, donnees, revision, modifie_par)
    select p_lecon, d, l.revision + 1, p_auteur from public.lecons l where l.id = p_lecon;
  else
    perform public.appliquer_donnees_lecon(p_lecon, d);
    update public.lecons set revision = revision + 1, revise_par = p_auteur where id = p_lecon;
  end if;
end;
$$;

create or replace function public.ecrire_formation(p_formation uuid, d jsonb, p_auteur uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.brouillons_formations b where b.formation_id = p_formation) then
    update public.brouillons_formations set donnees = d, revision = revision + 1, modifie_par = p_auteur, modifie_le = now() where formation_id = p_formation;
  elsif public.formation_visible(p_formation) then
    insert into public.brouillons_formations (formation_id, donnees, revision, modifie_par)
    select p_formation, d, f.revision + 1, p_auteur from public.formations f where f.id = p_formation;
  else
    perform public.appliquer_donnees_formation(p_formation, d);
    update public.formations set revision = revision + 1, revise_par = p_auteur where id = p_formation;
  end if;
end;
$$;

create or replace function public.restaurer_version(p_version uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
  v public.versions_formations;
  v_infos boolean := false;
  v_modifiees integer := 0;
  v_recreees integer := 0;
  v_module jsonb;
  v_lecon jsonb;
  v_id_module uuid;
  v_id_lecon uuid;
  v_d jsonb;
  v_actuel jsonb;
begin
  select * into v from public.versions_formations x where x.id = p_version;
  if not found then
    raise exception 'Version introuvable.';
  end if;
  if not public.editeur_de_formation(v.formation_id) then
    raise exception 'Vous ne pouvez pas modifier cette formation.' using errcode = '42501';
  end if;
  perform 1 from public.formations f where f.id = v.formation_id for update;

  -- Les informations générales : seulement si elles diffèrent de ce que l'éditeur affiche (brouillon ou en ligne).
  v_d := public.donnees_formation_valides(v.contenu -> 'infos');
  v_actuel := coalesce(
    (select b.donnees from public.brouillons_formations b where b.formation_id = v.formation_id),
    public.donnees_formation(v.formation_id)
  );
  if public.donnees_formation_valides(v_actuel) is distinct from v_d then
    perform public.ecrire_formation(v.formation_id, v_d, v_moi);
    v_infos := true;
  end if;

  for v_module in select * from jsonb_array_elements(coalesce(v.contenu -> 'modules', '[]'::jsonb)) loop
    v_id_module := null;
    for v_lecon in select * from jsonb_array_elements(coalesce(v_module -> 'lecons', '[]'::jsonb)) loop
      v_d := public.donnees_lecon_valides(v_lecon);
      -- La leçon de la version, ou celle qu'une restauration précédente a recréée à sa place.
      select l.id into v_id_lecon
      from public.lecons l join public.modules m on m.id = l.module_id
      where (l.id = (v_lecon ->> 'id')::uuid or l.restauree_de = (v_lecon ->> 'id')::uuid) and m.formation_id = v.formation_id
      order by (l.id = (v_lecon ->> 'id')::uuid) desc
      limit 1;
      if found then
        v_actuel := coalesce((select b.donnees from public.brouillons_lecons b where b.lecon_id = v_id_lecon), public.donnees_lecon(v_id_lecon));
        if public.donnees_lecon_valides(v_actuel) is distinct from v_d then
          perform public.ecrire_lecon(v_id_lecon, v_d, v_moi);
          v_modifiees := v_modifiees + 1;
        end if;
        continue;
      end if;
      -- Son module : le même, ou un module du même titre, ou recréé à la fin.
      if v_id_module is null then
        select m.id into v_id_module from public.modules m
        where m.formation_id = v.formation_id and (m.id = (v_module ->> 'id')::uuid or m.titre = v_module ->> 'titre')
        order by (m.id = (v_module ->> 'id')::uuid) desc
        limit 1;
        if v_id_module is null then
          insert into public.modules (formation_id, titre, ordre)
          select v.formation_id, coalesce(nullif(v_module ->> 'titre', ''), 'Module'), coalesce(max(m.ordre), 0) + 1
          from public.modules m where m.formation_id = v.formation_id
          returning id into v_id_module;
        end if;
      end if;
      insert into public.lecons (module_id, titre, type, ordre, publiee, restauree_de)
      select v_id_module, v_d ->> 'titre', coalesce(v_lecon ->> 'type', 'lecon'), coalesce(max(l.ordre), 0) + 1, false, (v_lecon ->> 'id')::uuid
      from public.lecons l where l.module_id = v_id_module
      returning id into v_id_lecon;
      perform public.appliquer_donnees_lecon(v_id_lecon, v_d);
      v_recreees := v_recreees + 1;
    end loop;
  end loop;

  return jsonb_build_object('numero', v.numero, 'infos', v_infos, 'lecons_modifiees', v_modifiees, 'lecons_recreees', v_recreees);
end;
$$;

-- ─── Droits ─────────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public.instantane_formation(uuid) from public, anon, authenticated;
revoke execute on function public.noter_version(uuid, text) from public, anon, authenticated;
revoke execute on function public.version_mise_en_ligne() from public, anon, authenticated;
revoke execute on function public.version_publication_lecon() from public, anon, authenticated;
revoke execute on function public.ecrire_lecon(uuid, jsonb, uuid) from public, anon, authenticated;
revoke execute on function public.ecrire_formation(uuid, jsonb, uuid) from public, anon, authenticated;
revoke execute on function public.publier_modifications(uuid) from public, anon;
revoke execute on function public.versions_formation(uuid) from public, anon;
revoke execute on function public.restaurer_version(uuid) from public, anon;
grant execute on function public.publier_modifications(uuid) to authenticated;
grant execute on function public.versions_formation(uuid) to authenticated;
grant execute on function public.restaurer_version(uuid) to authenticated;

commit;
