-- Étudium · migration 0014 : espace formateur, « Mes formations » (spec de l'espace formateur, 13 octobre 2026).
-- À appliquer dans Supabase, après la 0013 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancé sur une base qui l'a déjà, il ne change rien et ne casse rien. Si une migration plus ancienne
-- est rejouée un jour (0004, 0009, 0013…), rejouer celle-ci ensuite.

begin;

-- ─── Relecture d'une formation par un admin ─────────────────────────────────────────────────────────
-- Envoyée par son formateur (envoyee_le), renvoyée par l'équipe avec une remarque (renvoyee_le, remarque_relecture),
-- et, une fois en ligne, la dernière modification faite par son formateur (modifiee_par_formateur_le).
alter table public.formations add column if not exists envoyee_le timestamptz;
alter table public.formations add column if not exists renvoyee_le timestamptz;
alter table public.formations add column if not exists remarque_relecture text;
alter table public.formations add column if not exists modifiee_par_formateur_le timestamptz;
alter table public.formations drop constraint if exists formations_remarque_longueur;
alter table public.formations add constraint formations_remarque_longueur check (char_length(remarque_relecture) <= 1000);

-- ─── Qui est le formateur d'une formation ───────────────────────────────────────────────────────────
-- La fiche formateur reliée au compte qui demande (page Utilisateurs, 0013), s'il a le rôle formateur.
-- a_role tient compte de la suspension : un formateur suspendu n'a plus de fiche.
create or replace function public.ma_fiche_formateur()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select f.id from public.formateurs f
  where f.compte_id = (select auth.uid()) and public.a_role('formateur');
$$;

create or replace function public.formateur_de(p_formation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.formations f
    where f.id = p_formation and f.formateur_id is not null and f.formateur_id = public.ma_fiche_formateur()
  );
$$;

create or replace function public.formation_du_module(p_module uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select formation_id from public.modules where id = p_module;
$$;

create or replace function public.formation_de_la_lecon(p_lecon uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.formation_id from public.lecons l join public.modules m on m.id = l.module_id where l.id = p_lecon;
$$;

-- Le premier dossier d'un chemin de fichier (« <formation>/<fichier> ») est-il une formation du formateur ?
create or replace function public.formateur_du_dossier(p_nom text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_dossier text := (storage.foldername(p_nom))[1];
begin
  if v_dossier is null or v_dossier !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.formateur_de(v_dossier::uuid);
end;
$$;

grant execute on function public.ma_fiche_formateur() to anon, authenticated;
grant execute on function public.formateur_de(uuid) to anon, authenticated;
grant execute on function public.formation_du_module(uuid) to anon, authenticated;
grant execute on function public.formation_de_la_lecon(uuid) to anon, authenticated;
grant execute on function public.formateur_du_dossier(text) to anon, authenticated;

-- ─── Lecture : le formateur voit ses formations, et lit leurs leçons ────────────────────────────────
-- Une seule règle de lecture (0009, complétée). La colonne de la ligne, et non formateur_de(id) : une fonction ne voit
-- pas encore la ligne qu'une création est en train d'écrire (« insert … returning » serait refusé).
drop policy if exists "formations publiées visibles" on public.formations;
create policy "formations publiées visibles" on public.formations
  for select to anon, authenticated
  using (
    statut = 'publiee'
    or (select public.equipe_contenus())
    or public.formation_commencee(id)
    or formateur_id = (select public.ma_fiche_formateur())
  );

-- Accès à une leçon (0004, 0013) : celles de ses formations aussi, même en brouillon. La suspension (0013) est gardée.
create or replace function public.acces_lecon(p_lecon uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not public.compte_suspendu() and (
    public.equipe_contenus()
    or public.formateur_de(public.formation_de_la_lecon(p_lecon))
    or exists (
      select 1
      from public.lecons l
      join public.modules m on m.id = l.module_id
      join public.formations f on f.id = m.formation_id
      where l.id = p_lecon
        and f.statut = 'publiee'
        and (l.apercu or (f.gratuite and (select auth.uid()) is not null))
    )
  );
$$;

-- ─── Écriture : le formateur écrit dans ses formations ──────────────────────────────────────────────
-- Une règle par action, comme celles de l'équipe (0004) ; la condition dépend de la table.
do $$
declare
  t text;
  condition text;
begin
  foreach t in array array['formations', 'formations_parcours', 'modules', 'lecons', 'lecons_contenus', 'ressources'] loop
    condition := case t
      when 'formations' then 'formateur_id = (select public.ma_fiche_formateur())'
      when 'formations_parcours' then 'public.formateur_de(formation_id)'
      when 'modules' then 'public.formateur_de(formation_id)'
      when 'lecons' then 'public.formateur_de(public.formation_du_module(module_id))'
      else 'public.formateur_de(public.formation_de_la_lecon(lecon_id))'
    end;
    execute format('drop policy if exists %I on public.%I', 'le formateur ajoute', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)', 'le formateur ajoute', t, condition);
    execute format('drop policy if exists %I on public.%I', 'le formateur modifie', t);
    execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', 'le formateur modifie', t, condition, condition);
    execute format('drop policy if exists %I on public.%I', 'le formateur supprime', t);
    execute format('create policy %I on public.%I for delete to authenticated using (%s)', 'le formateur supprime', t, condition);
  end loop;
end;
$$;

-- ─── Garde-fous : ce qui revient à l'équipe ─────────────────────────────────────────────────────────
-- Seulement pour les écritures directes d'un formateur par l'API (rôle « authenticated », hors équipe). Les fonctions
-- « security definer » (relecture, note des avis) et l'éditeur SQL passent : elles ont leurs propres vérifications.
create or replace function public.formations_formateur()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_fiche uuid;
begin
  -- Publiée (par l'équipe) : l'envoi en relecture et la remarque n'ont plus lieu d'être.
  if tg_op = 'UPDATE' and new.statut = 'publiee' and old.statut is distinct from 'publiee' then
    new.envoyee_le := null;
    new.renvoyee_le := null;
    new.remarque_relecture := null;
  end if;

  if current_user <> 'authenticated' or public.equipe_contenus() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_fiche := public.ma_fiche_formateur();
    if v_fiche is null then
      raise exception 'Votre compte n’est pas encore relié à une fiche formateur. Contactez l’équipe Étudium.' using errcode = '42501';
    end if;
    -- Un brouillon, à sa fiche, avec les réglages par défaut : le reste est décidé par l'équipe.
    new.formateur_id := v_fiche;
    new.statut := 'brouillon';
    new.gratuite := false;
    new.achat_separe := false;
    new.prix_fcfa := null;
    new.badge := null;
    new.seuil_video := 90;
    new.envoyee_le := null;
    new.renvoyee_le := null;
    new.remarque_relecture := null;
    new.modifiee_par_formateur_le := null;
    new.note_moyenne := null;
    new.nb_avis := 0;
    return new;
  end if;

  if new.statut is distinct from old.statut
     or new.formateur_id is distinct from old.formateur_id
     or new.gratuite is distinct from old.gratuite
     or new.achat_separe is distinct from old.achat_separe
     or new.prix_fcfa is distinct from old.prix_fcfa
     or new.badge is distinct from old.badge
     or new.seuil_video is distinct from old.seuil_video
     or new.envoyee_le is distinct from old.envoyee_le
     or new.renvoyee_le is distinct from old.renvoyee_le
     or new.remarque_relecture is distinct from old.remarque_relecture
     or new.modifiee_par_formateur_le is distinct from old.modifiee_par_formateur_le
     or new.note_moyenne is distinct from old.note_moyenne
     or new.nb_avis is distinct from old.nb_avis then
    raise exception 'Ce réglage revient à l’équipe Étudium.';
  end if;

  -- En ligne : l'équipe voit « Modifiée par le formateur le … ».
  if old.publiee_le is not null then
    new.modifiee_par_formateur_le := now();
  end if;
  return new;
end;
$$;

drop trigger if exists formations_formateur on public.formations;
create trigger formations_formateur
  before insert or update on public.formations
  for each row execute function public.formations_formateur();

-- Une modification du programme d'une formation en ligne par son formateur est datée, comme celle de ses informations.
-- La fonction vérifie elle-même que la formation est bien celle du formateur qui demande.
create or replace function public.marquer_modifiee_par_formateur(p_formation uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.formations set modifiee_par_formateur_le = now()
  where id = p_formation and publiee_le is not null and public.formateur_de(p_formation);
$$;
revoke execute on function public.marquer_modifiee_par_formateur(uuid) from public, anon;
grant execute on function public.marquer_modifiee_par_formateur(uuid) to authenticated;

create or replace function public.apres_modification_formateur()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_ligne jsonb;
  v_formation uuid;
begin
  if current_user <> 'authenticated' or public.equipe_contenus() then
    return null;
  end if;
  v_ligne := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  v_formation := coalesce(
    (v_ligne ->> 'formation_id')::uuid,
    public.formation_du_module((v_ligne ->> 'module_id')::uuid),
    public.formation_de_la_lecon((v_ligne ->> 'lecon_id')::uuid)
  );
  if v_formation is not null then
    perform public.marquer_modifiee_par_formateur(v_formation);
  end if;
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['formations_parcours', 'modules', 'lecons', 'lecons_contenus', 'ressources'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_modification_formateur', t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.apres_modification_formateur()',
      t || '_modification_formateur', t
    );
  end loop;
end;
$$;

-- ─── Fichiers : le formateur gère ceux de ses formations ────────────────────────────────────────────
-- Couvertures (0012) et ressources (0004) : lister, déposer, remplacer et supprimer dans le dossier de ses formations.
do $$
declare
  espace text;
begin
  foreach espace in array array['couvertures', 'ressources'] loop
    execute format('drop policy if exists %I on storage.objects', espace || ' : le formateur liste');
    execute format(
      'create policy %I on storage.objects for select to authenticated using (bucket_id = %L and public.formateur_du_dossier(name))',
      espace || ' : le formateur liste', espace
    );
    execute format('drop policy if exists %I on storage.objects', espace || ' : le formateur dépose');
    execute format(
      'create policy %I on storage.objects for insert to authenticated with check (bucket_id = %L and public.formateur_du_dossier(name))',
      espace || ' : le formateur dépose', espace
    );
    execute format('drop policy if exists %I on storage.objects', espace || ' : le formateur remplace');
    execute format(
      'create policy %I on storage.objects for update to authenticated using (bucket_id = %L and public.formateur_du_dossier(name)) with check (bucket_id = %L and public.formateur_du_dossier(name))',
      espace || ' : le formateur remplace', espace, espace
    );
    execute format('drop policy if exists %I on storage.objects', espace || ' : le formateur supprime');
    execute format(
      'create policy %I on storage.objects for delete to authenticated using (bucket_id = %L and public.formateur_du_dossier(name))',
      espace || ' : le formateur supprime', espace
    );
  end loop;
end;
$$;

-- ─── Relecture ──────────────────────────────────────────────────────────────────────────────────────
-- Le formateur envoie son brouillon (au moins une leçon) ; il peut encore le modifier pendant la relecture.
create or replace function public.envoyer_en_relecture(p_formation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.formateur_de(p_formation) then
    raise exception 'Cette formation n’est pas la vôtre.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.formations where id = p_formation and statut = 'brouillon') then
    raise exception 'Seul un brouillon s’envoie en relecture.';
  end if;
  if not exists (
    select 1 from public.lecons l join public.modules m on m.id = l.module_id where m.formation_id = p_formation
  ) then
    raise exception 'Ajoutez au moins une leçon avant d’envoyer la formation en relecture.';
  end if;
  update public.formations
  set envoyee_le = now(), renvoyee_le = null, remarque_relecture = null
  where id = p_formation;
end;
$$;

-- L'équipe renvoie une formation en attente à son formateur, avec une remarque (obligatoire).
create or replace function public.renvoyer_au_formateur(p_formation uuid, p_remarque text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_remarque text := regexp_replace(coalesce(p_remarque, ''), '^\s+|\s+$', '', 'g');
begin
  if not public.equipe_contenus() then
    raise exception 'Accès réservé à l’équipe.' using errcode = '42501';
  end if;
  if char_length(v_remarque) = 0 or char_length(v_remarque) > 1000 then
    raise exception 'Écrivez une remarque pour le formateur (1 000 caractères au plus).';
  end if;
  if not exists (select 1 from public.formations where id = p_formation and statut = 'brouillon' and envoyee_le is not null) then
    raise exception 'Cette formation n’attend pas de validation.';
  end if;
  update public.formations
  set envoyee_le = null, renvoyee_le = now(), remarque_relecture = v_remarque
  where id = p_formation;
end;
$$;

revoke execute on function public.envoyer_en_relecture(uuid) from public, anon;
revoke execute on function public.renvoyer_au_formateur(uuid, text) from public, anon;
grant execute on function public.envoyer_en_relecture(uuid) to authenticated;
grant execute on function public.renvoyer_au_formateur(uuid, text) to authenticated;

commit;
