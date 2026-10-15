-- Étudium, migration 0033 : la validation des formations et les certificats (lot 3, étape C ; spec du lot 3, §4 à §7).
--
-- Une formation est validée quand toutes ses leçons publiées sont terminées, tous ses quiz publiés réussis (meilleur
-- score ≥ score minimal) et, si « Exercices obligatoires », tous ses exercices publiés validés. Le certificat est alors
-- délivré, une seule fois, avec ses informations figées (titulaire, formation, formateur, parcours, date) et un
-- identifiant tiré au hasard. Il reste vérifiable par tous, même si le compte est supprimé.
--
-- À coller dans l'éditeur SQL de Supabase, après la 0032. Rejouable.

begin;

-- ─── Le réglage de certification ────────────────────────────────────────────────────────────────────
alter table public.formations add column if not exists exercices_obligatoires boolean not null default true;

-- ─── Les certificats (lus et écrits par les fonctions seulement) ──────────────────────────────────────
create table if not exists public.certificats (
  id uuid primary key default gen_random_uuid(),
  -- « ET-2026-K7Q2-M9XD » : impossible à deviner, donc impossible de parcourir les certificats des autres.
  identifiant text not null,
  -- Le compte supprimé, le certificat reste (nom figé ci-dessous) ; la formation supprimée aussi.
  profil_id uuid references public.profils (id) on delete set null,
  formation_id uuid references public.formations (id) on delete set null,
  titulaire text not null,
  formation_titre text not null,
  formateur_nom text not null default '',
  parcours_nom text not null default '',
  delivre_le date not null,
  cree_le timestamptz not null default now(),
  -- La fenêtre « Félicitations » montrée une fois.
  vu_le timestamptz,
  constraint certificats_identifiant_unique unique (identifiant),
  constraint certificats_un_par_formation unique (profil_id, formation_id)
);
create index if not exists certificats_formation_idx on public.certificats (formation_id);
alter table public.certificats enable row level security;
revoke all on public.certificats from anon, authenticated;

-- ─── L'état de validation ───────────────────────────────────────────────────────────────────────────
-- Les conditions d'un compte pour une formation : leçons terminées, quiz réussis, exercices validés (publiés seulement).
create or replace function public.etat_validation(p_profil uuid, p_formation uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with elements as (
    select l.id, l.titre, l.type, l.ordre, m.ordre as module_ordre
    from public.lecons l
    join public.modules m on m.id = l.module_id
    where m.formation_id = p_formation and l.publiee
  ),
  lecons as (
    select
      count(*) filter (where e.type = 'lecon') as total,
      count(*) filter (where e.type = 'lecon' and exists (
        select 1 from public.progression_lecons p where p.profil_id = p_profil and p.lecon_id = e.id and p.terminee_le is not null
      )) as terminees
    from elements e
  ),
  quiz as (
    select e.id, e.titre, e.module_ordre, e.ordre,
      (select max(t.score) from public.tentatives_quiz t where t.profil_id = p_profil and t.lecon_id = e.id) as meilleur
    from elements e
    where e.type = 'quiz'
  ),
  exercices as (
    select e.id, e.titre, e.module_ordre, e.ordre,
      (select d.statut from public.derniers_rendus d where d.profil_id = p_profil and d.lecon_id = e.id) as statut
    from elements e
    where e.type = 'exercice'
  )
  select jsonb_build_object(
    'lecons', (select jsonb_build_object('terminees', l.terminees, 'total', l.total) from lecons l),
    'minimum', f.score_quiz,
    'exercices_obligatoires', f.exercices_obligatoires,
    'quiz', coalesce((
      select jsonb_agg(jsonb_build_object('id', q.id, 'titre', q.titre, 'meilleur', q.meilleur, 'reussi', coalesce(q.meilleur >= f.score_quiz, false))
        order by q.module_ordre, q.ordre)
      from quiz q
    ), '[]'::jsonb),
    'exercices', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'titre', x.titre, 'statut', x.statut, 'valide', x.statut is not distinct from 'valide')
        order by x.module_ordre, x.ordre)
      from exercices x
    ), '[]'::jsonb),
    'complet', (select l.total > 0 and l.terminees = l.total from lecons l)
      and not exists (select 1 from quiz q where coalesce(q.meilleur, -1) < f.score_quiz)
      and (not f.exercices_obligatoires or not exists (select 1 from exercices x where x.statut is distinct from 'valide'))
  )
  from public.formations f
  where f.id = p_formation;
$$;

-- « ET-2026-K7Q2-M9XD » : l'année, puis 8 caractères tirés au hasard (sans 0, O, 1, I, faciles à confondre).
create or replace function public.identifiant_certificat()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_octets bytea;
  v_code text := '';
  v_rang integer;
begin
  v_octets := uuid_send(gen_random_uuid());
  -- Les octets 6 et 8 portent la version et la variante de l'UUID : ils ne sont pas tirés au hasard.
  foreach v_rang in array array[0, 1, 2, 3, 4, 5, 10, 11] loop
    v_code := v_code || substr(v_alphabet, 1 + (get_byte(v_octets, v_rang) % 32), 1);
  end loop;
  return 'ET-' || extract(year from (now() at time zone 'Africa/Porto-Novo'))::integer || '-' || left(v_code, 4) || '-' || right(v_code, 4);
end;
$$;

-- Délivre le certificat si toutes les conditions sont remplies (formation publiée), une seule fois.
create or replace function public.delivrer_si_complet(p_profil uuid, p_formation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_f record;
  v_identifiant text;
begin
  if p_profil is null or p_formation is null then
    return;
  end if;
  if exists (select 1 from public.certificats c where c.profil_id = p_profil and c.formation_id = p_formation) then
    return;
  end if;
  select f.id, f.titre, f.slug, f.statut, f.formateur_id into v_f from public.formations f where f.id = p_formation;
  if not found or v_f.statut <> 'publiee' then
    return;
  end if;
  if not coalesce((public.etat_validation(p_profil, p_formation) ->> 'complet')::boolean, false) then
    return;
  end if;
  -- Deux événements au même instant (dernière leçon et quiz) : un seul certificat.
  perform pg_advisory_xact_lock(hashtextextended('certificat' || p_profil::text || p_formation::text, 0));
  if exists (select 1 from public.certificats c where c.profil_id = p_profil and c.formation_id = p_formation) then
    return;
  end if;
  loop
    v_identifiant := public.identifiant_certificat();
    exit when not exists (select 1 from public.certificats c where c.identifiant = v_identifiant);
  end loop;
  insert into public.certificats (identifiant, profil_id, formation_id, titulaire, formation_titre, formateur_nom, parcours_nom, delivre_le)
  values (
    v_identifiant,
    p_profil,
    p_formation,
    coalesce(public.nom_du_profil(p_profil), 'Étudiant Étudium'),
    v_f.titre,
    coalesce((select fo.nom from public.formateurs fo where fo.id = v_f.formateur_id), ''),
    coalesce((
      select p.nom from public.formations_parcours fp join public.parcours p on p.id = fp.parcours_id
      where fp.formation_id = p_formation order by fp.ordre, p.nom limit 1
    ), ''),
    (now() at time zone 'Africa/Porto-Novo')::date
  );
  perform public.notifier(array[p_profil], 'service', 'Votre certificat est prêt', v_f.titre, '/formations/' || v_f.slug || '/validation');
end;
$$;

-- ─── Les événements qui peuvent remplir la dernière condition ───────────────────────────────────────
create or replace function public.certificat_apres_progression()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.delivrer_si_complet(new.profil_id, public.formation_de_la_lecon(new.lecon_id));
  return null;
end;
$$;

drop trigger if exists progression_certificat_insertion on public.progression_lecons;
create trigger progression_certificat_insertion
  after insert on public.progression_lecons
  for each row when (new.terminee_le is not null)
  execute function public.certificat_apres_progression();

drop trigger if exists progression_certificat_fin on public.progression_lecons;
create trigger progression_certificat_fin
  after update of terminee_le on public.progression_lecons
  for each row when (old.terminee_le is null and new.terminee_le is not null)
  execute function public.certificat_apres_progression();

create or replace function public.certificat_apres_tentative()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.delivrer_si_complet(new.profil_id, public.formation_de_la_lecon(new.lecon_id));
  return null;
end;
$$;

drop trigger if exists tentatives_certificat on public.tentatives_quiz;
create trigger tentatives_certificat
  after insert on public.tentatives_quiz
  for each row execute function public.certificat_apres_tentative();

create or replace function public.certificat_apres_rendu()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.delivrer_si_complet(new.profil_id, public.formation_de_la_lecon(new.lecon_id));
  return null;
end;
$$;

drop trigger if exists rendus_certificat on public.rendus_exercices;
create trigger rendus_certificat
  after insert or update of statut on public.rendus_exercices
  for each row when (new.statut = 'valide')
  execute function public.certificat_apres_rendu();

-- ─── Côté étudiant ──────────────────────────────────────────────────────────────────────────────────
-- Un certificat en JSON (ce que montre le certificat, et rien d'autre).
create or replace function public.certificat_json(c public.certificats)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'identifiant', c.identifiant, 'titulaire', c.titulaire, 'formation', c.formation_titre, 'formateur', c.formateur_nom,
    'parcours', c.parcours_nom, 'delivre_le', c.delivre_le
  );
$$;

-- La page « Validation de votre formation » : l'état, et le certificat (délivré ici si une condition a changé depuis).
create or replace function public.validation_formation(p_formation uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_etat jsonb;
begin
  if v_uid is null then
    return null;
  end if;
  perform public.delivrer_si_complet(v_uid, p_formation);
  v_etat := public.etat_validation(v_uid, p_formation);
  if v_etat is null then
    return null;
  end if;
  return v_etat || jsonb_build_object('certificat', (
    select public.certificat_json(c) || jsonb_build_object('vu', c.vu_le is not null)
    from public.certificats c
    where c.profil_id = v_uid and c.formation_id = p_formation
  ));
end;
$$;

-- La page « Certificats » : les certificats obtenus, et les formations commencées encore « en préparation ».
create or replace function public.mes_certificats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with moi as (select (select auth.uid()) as id),
  commencees as (
    select distinct m.formation_id
    from public.progression_lecons p
    join public.lecons l on l.id = p.lecon_id
    join public.modules m on m.id = l.module_id
    where p.profil_id = (select id from moi)
  ),
  etats as (
    select f.id, f.titre, f.slug, public.etat_validation((select id from moi), f.id) as etat
    from commencees c
    join public.formations f on f.id = c.formation_id
    where f.statut = 'publiee'
      and not exists (select 1 from public.certificats x where x.profil_id = (select id from moi) and x.formation_id = f.id)
  )
  select jsonb_build_object(
    'obtenus', coalesce((
      select jsonb_agg(public.certificat_json(c) || jsonb_build_object('slug', f.slug) order by c.delivre_le desc, c.cree_le desc)
      from public.certificats c
      left join public.formations f on f.id = c.formation_id
      where c.profil_id = (select id from moi)
    ), '[]'::jsonb),
    'en_preparation', coalesce((
      select jsonb_agg(jsonb_build_object(
        'formation_id', e.id, 'titre', e.titre, 'slug', e.slug,
        'terminees', (e.etat -> 'lecons' ->> 'terminees')::integer,
        'total', (e.etat -> 'lecons' ->> 'total')::integer,
        'quiz_restants', (select count(*) from jsonb_array_elements(e.etat -> 'quiz') q where not (q ->> 'reussi')::boolean),
        'exercices_restants', case when (e.etat ->> 'exercices_obligatoires')::boolean
          then (select count(*) from jsonb_array_elements(e.etat -> 'exercices') x where not (x ->> 'valide')::boolean) else 0 end
      ) order by e.titre)
      from etats e
    ), '[]'::jsonb)
  );
$$;

-- Le certificat à télécharger (image, PDF) : pour son titulaire seulement.
create or replace function public.mon_certificat(p_identifiant text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.certificat_json(c)
  from public.certificats c
  where c.identifiant = upper(btrim(p_identifiant)) and c.profil_id = (select auth.uid());
$$;

-- La fenêtre « Félicitations » a été montrée.
create or replace function public.marquer_certificat_vu(p_identifiant text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.certificats
  set vu_le = now()
  where identifiant = upper(btrim(p_identifiant)) and profil_id = (select auth.uid()) and vu_le is null;
$$;

-- ─── La vérification publique (sans compte) ─────────────────────────────────────────────────────────
create or replace function public.verifier_certificat(p_identifiant text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.certificat_json(c) from public.certificats c where c.identifiant = upper(btrim(coalesce(p_identifiant, '')));
$$;

-- ─── Côté formateur et équipe ───────────────────────────────────────────────────────────────────────
-- Les certificats délivrés dans ses formations (toutes pour l'équipe).
create or replace function public.certificats_formateur()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.certificats c
  where c.formation_id is not null
    and not public.compte_suspendu()
    and (public.equipe_contenus() or public.formateur_de(c.formation_id));
$$;

-- La fiche d'un étudiant : ses scores, ses exercices et son certificat, dans chaque formation du formateur qu'il a commencée.
create or replace function public.lot3_etudiant(p_etudiant uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with formations as (
    select distinct m.formation_id as id
    from public.progression_lecons p
    join public.lecons l on l.id = p.lecon_id
    join public.modules m on m.id = l.module_id
    where p.profil_id = p_etudiant
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'formation_id', f.id,
    'quiz', e.etat -> 'quiz',
    'exercices', e.etat -> 'exercices',
    'certificat', (select c.identifiant from public.certificats c where c.profil_id = p_etudiant and c.formation_id = f.id)
  )), '[]'::jsonb)
  from formations f
  cross join lateral (select public.etat_validation(p_etudiant, f.id) as etat) e
  where not public.compte_suspendu() and (public.equipe_contenus() or public.formateur_de(f.id));
$$;

-- ─── Droits d'exécution ─────────────────────────────────────────────────────────────────────────────
revoke execute on function public.etat_validation(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.identifiant_certificat() from public, anon, authenticated;
revoke execute on function public.delivrer_si_complet(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.certificat_apres_progression() from public, anon, authenticated;
revoke execute on function public.certificat_apres_tentative() from public, anon, authenticated;
revoke execute on function public.certificat_apres_rendu() from public, anon, authenticated;
revoke execute on function public.certificat_json(public.certificats) from public, anon, authenticated;
revoke execute on function public.validation_formation(uuid) from public, anon;
grant execute on function public.validation_formation(uuid) to authenticated;
revoke execute on function public.mes_certificats() from public, anon;
grant execute on function public.mes_certificats() to authenticated;
revoke execute on function public.mon_certificat(text) from public, anon;
grant execute on function public.mon_certificat(text) to authenticated;
revoke execute on function public.marquer_certificat_vu(text) from public, anon;
grant execute on function public.marquer_certificat_vu(text) to authenticated;
revoke execute on function public.verifier_certificat(text) from public;
grant execute on function public.verifier_certificat(text) to anon, authenticated;
revoke execute on function public.certificats_formateur() from public, anon;
grant execute on function public.certificats_formateur() to authenticated;
revoke execute on function public.lot3_etudiant(uuid) from public, anon;
grant execute on function public.lot3_etudiant(uuid) to authenticated;

commit;
