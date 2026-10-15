-- Étudium, migration 0032 : les exercices (lot 3, étape B ; spec du lot 3, §3).
--
-- Un exercice est une leçon de type « exercice » (0031) : sa consigne est le texte de la leçon, ses fichiers fournis sont
-- ses ressources. Il est « simple » (l'étudiant le marque comme terminé) ou « avec rendu » (l'étudiant dépose un
-- fichier, que le formateur de la formation ou l'équipe corrige). Chaque dépôt est une version, conservée ; un fichier
-- ne se remplace pas tant qu'il n'est pas corrigé. Tout passe par des fonctions : les tables restent fermées.
--
-- À coller dans l'éditeur SQL de Supabase, après la 0031. Rejouable.

begin;

-- ─── Le genre d'un exercice ───────────────────────────────────────────────────────────────────────────
alter table public.lecons add column if not exists genre_exercice text;
alter table public.lecons drop constraint if exists lecons_genre_exercice;
alter table public.lecons add constraint lecons_genre_exercice check (genre_exercice is null or genre_exercice in ('simple', 'rendu'));
update public.lecons set genre_exercice = 'rendu' where type = 'exercice' and genre_exercice is null;
update public.lecons set genre_exercice = null where type <> 'exercice' and genre_exercice is not null;

-- Un exercice est « avec rendu » sauf choix contraire ; les autres éléments du programme n'ont pas de genre.
create or replace function public.genre_exercice_par_defaut()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.type = 'exercice' then
    new.genre_exercice := coalesce(new.genre_exercice, 'rendu');
  else
    new.genre_exercice := null;
  end if;
  return new;
end;
$$;

drop trigger if exists lecons_genre_exercice on public.lecons;
create trigger lecons_genre_exercice
  before insert or update of type, genre_exercice on public.lecons
  for each row execute function public.genre_exercice_par_defaut();

-- ─── Les rendus (lus et écrits par les fonctions seulement) ───────────────────────────────────────────
create table if not exists public.rendus_exercices (
  id uuid primary key default gen_random_uuid(),
  lecon_id uuid not null references public.lecons (id) on delete cascade,
  profil_id uuid not null references public.profils (id) on delete cascade,
  version integer not null,
  -- Le chemin dans l'espace « rendus » ; null pour un exercice simple.
  fichier text,
  nom_fichier text not null default '',
  format text not null default '',
  taille_octets bigint not null default 0,
  message text not null default '',
  statut text not null default 'en_attente',
  -- La remarque (à corriger) ou le commentaire (validé) du correcteur.
  remarque text not null default '',
  corrige_par uuid references public.profils (id) on delete set null,
  corrige_le timestamptz,
  cree_le timestamptz not null default now(),
  constraint rendus_exercices_statut check (statut in ('en_attente', 'a_corriger', 'valide')),
  constraint rendus_exercices_message check (char_length(message) <= 1000),
  constraint rendus_exercices_remarque check (char_length(remarque) <= 2000),
  constraint rendus_exercices_version unique (profil_id, lecon_id, version)
);
create index if not exists rendus_exercices_statut_idx on public.rendus_exercices (statut, cree_le);
create index if not exists rendus_exercices_lecon_idx on public.rendus_exercices (lecon_id, profil_id, version desc);
create index if not exists rendus_exercices_fichier_idx on public.rendus_exercices (fichier);
alter table public.rendus_exercices enable row level security;
revoke all on public.rendus_exercices from anon, authenticated;

-- ─── Outils ─────────────────────────────────────────────────────────────────────────────────────────
-- PDF, Word, Excel, PowerPoint, image (JPG, PNG, WebP) ou ZIP (choix 7 de la spec).
create or replace function public.formats_rendu()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint',
    'application/zip'
  ]::text[];
$$;

-- « Aïcha Kpadé ».
create or replace function public.nom_du_profil(p_profil uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(btrim(p.prenom || ' ' || p.nom), '') from public.profils p where p.id = p_profil;
$$;

-- La dernière version de chaque étudiant à chaque exercice.
create or replace view public.derniers_rendus with (security_invoker = true) as
  select distinct on (r.lecon_id, r.profil_id) r.*
  from public.rendus_exercices r
  order by r.lecon_id, r.profil_id, r.version desc;
revoke all on public.derniers_rendus from anon, authenticated;

-- Une version en JSON, pour l'étudiant comme pour le correcteur.
create or replace function public.version_rendu(r public.rendus_exercices)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', r.id, 'version', r.version, 'nom_fichier', r.nom_fichier, 'format', r.format, 'taille_octets', r.taille_octets,
    'message', r.message, 'statut', r.statut, 'remarque', r.remarque, 'correcteur', public.nom_du_profil(r.corrige_par),
    'corrige_le', r.corrige_le, 'cree_le', r.cree_le, 'a_un_fichier', r.fichier is not null
  );
$$;

-- Le rang d'un module dans sa formation (« Module 3 »).
create or replace function public.rang_du_module(p_module uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*)::integer + 1 from public.modules m2 where m2.formation_id = m.formation_id and (m2.ordre, m2.id) < (m.ordre, m.id))
  from public.modules m
  where m.id = p_module;
$$;

-- ─── L'espace des fichiers rendus ───────────────────────────────────────────────────────────────────
-- Le fichier d'un rendu que l'on corrige (formateur de la formation, équipe).
create or replace function public.rendu_lisible(p_nom text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.rendus_exercices r where r.fichier = p_nom and public.editeur_de_lecon(r.lecon_id));
$$;

-- Un fichier attaché à un rendu ne s'efface plus.
create or replace function public.rendu_attache(p_nom text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.rendus_exercices r where r.fichier = p_nom);
$$;

-- Privé, 20 Mo, les formats acceptés. Chacun dépose dans son dossier (« <compte>/… ») ; on lit le sien, ou celui d'un
-- rendu que l'on corrige ; on supprime le sien tant qu'aucun rendu ne l'attache.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rendus', 'rendus', false, 20971520, public.formats_rendu())
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "rendus : déposer dans son dossier" on storage.objects;
create policy "rendus : déposer dans son dossier" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'rendus'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not (select public.compte_suspendu())
  );

drop policy if exists "rendus : lire" on storage.objects;
create policy "rendus : lire" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'rendus'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.rendu_lisible(objects.name)))
  );

drop policy if exists "rendus : supprimer" on storage.objects;
create policy "rendus : supprimer" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'rendus'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not (select public.rendu_attache(objects.name))
  );

-- ─── Côté étudiant ──────────────────────────────────────────────────────────────────────────────────
-- L'exercice et ses versions (de la plus récente à la plus ancienne) ; null sans accès ou si ce n'est pas un exercice.
create or replace function public.exercice_etudiant(p_lecon uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_genre text;
  v_statut text;
begin
  if v_uid is null or not public.acces_lecon(p_lecon) then
    return null;
  end if;
  select l.genre_exercice into v_genre from public.lecons l where l.id = p_lecon and l.type = 'exercice';
  if not found then
    return null;
  end if;
  select d.statut into v_statut from public.derniers_rendus d where d.lecon_id = p_lecon and d.profil_id = v_uid;
  return jsonb_build_object(
    'genre', v_genre,
    'statut', v_statut,
    'peut_deposer', v_genre = 'rendu' and (v_statut is null or v_statut = 'a_corriger'),
    'versions', coalesce((
      select jsonb_agg(public.version_rendu(r) order by r.version desc)
      from public.rendus_exercices r
      where r.lecon_id = p_lecon and r.profil_id = v_uid
    ), '[]'::jsonb)
  );
end;
$$;

-- Dépose un travail : le fichier, déjà dans le dossier du compte, devient la version suivante, en attente de correction.
create or replace function public.rendre_exercice(p_lecon uuid, p_fichier text, p_nom text, p_message text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_genre text;
  v_statut text;
  v_format text;
  v_taille bigint;
  v_version integer;
  v_id uuid;
  v_formateur uuid;
  v_titre text;
  v_message text := left(btrim(coalesce(p_message, '')), 1000);
  v_nom text := left(coalesce(nullif(btrim(coalesce(p_nom, '')), ''), 'travail'), 200);
begin
  if v_uid is null or not public.acces_lecon(p_lecon) then
    raise exception 'Cet exercice ne vous est pas ouvert.' using errcode = '42501';
  end if;
  select l.genre_exercice into v_genre from public.lecons l where l.id = p_lecon and l.type = 'exercice';
  if not found then
    raise exception 'Cet exercice ne vous est pas ouvert.' using errcode = '42501';
  end if;
  if v_genre <> 'rendu' then
    raise exception 'Cet exercice se termine sans dépôt.';
  end if;
  -- Un dépôt à la fois, par étudiant et par exercice (deux onglets).
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || p_lecon::text, 0));
  select d.statut into v_statut from public.derniers_rendus d where d.lecon_id = p_lecon and d.profil_id = v_uid;
  if v_statut = 'en_attente' then
    raise exception 'Votre travail attend déjà sa correction.';
  end if;
  if v_statut = 'valide' then
    raise exception 'Cet exercice est déjà validé.';
  end if;
  if (select count(*) from public.rendus_exercices r where r.profil_id = v_uid and r.cree_le > now() - interval '10 minutes') >= 20 then
    raise exception 'Trop de dépôts en peu de temps : réessayez dans quelques minutes.';
  end if;
  select o.metadata ->> 'mimetype', (o.metadata ->> 'size')::bigint into v_format, v_taille
  from storage.objects o
  where o.bucket_id = 'rendus' and o.name = p_fichier and o.owner = v_uid and (storage.foldername(o.name))[1] = v_uid::text;
  if not found or public.rendu_attache(p_fichier) then
    raise exception 'Ce fichier n’a pas été reçu. Déposez-le à nouveau.';
  end if;
  if v_format is null or not (v_format = any (public.formats_rendu())) then
    raise exception 'Ce format n’est pas accepté.';
  end if;
  if coalesce(v_taille, 0) > 20971520 then
    raise exception 'Le fichier dépasse 20 Mo.';
  end if;

  select coalesce(max(r.version), 0) + 1 into v_version from public.rendus_exercices r where r.lecon_id = p_lecon and r.profil_id = v_uid;
  insert into public.rendus_exercices (lecon_id, profil_id, version, fichier, nom_fichier, format, taille_octets, message)
  values (p_lecon, v_uid, v_version, p_fichier, v_nom, v_format, coalesce(v_taille, 0), v_message)
  returning id into v_id;

  -- Le formateur de la formation est prévenu (l'équipe voit la liste des corrections).
  select fo.compte_id, l.titre into v_formateur, v_titre
  from public.lecons l
  join public.modules m on m.id = l.module_id
  join public.formations f on f.id = m.formation_id
  left join public.formateurs fo on fo.id = f.formateur_id
  where l.id = p_lecon;
  if v_formateur is not null and v_formateur <> v_uid then
    perform public.notifier(
      array[v_formateur], 'exercices', 'Nouveau travail à corriger',
      coalesce(public.nom_du_profil(v_uid), 'Un étudiant') || ' · ' || v_titre, '/formateur/corrections/' || v_id
    );
  end if;
  return jsonb_build_object('id', v_id, 'version', v_version, 'statut', 'en_attente');
end;
$$;

-- « Marquer comme terminé » : un exercice simple est validé aussitôt (une fois).
create or replace function public.terminer_exercice(p_lecon uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_genre text;
begin
  if v_uid is null or not public.acces_lecon(p_lecon) then
    raise exception 'Cet exercice ne vous est pas ouvert.' using errcode = '42501';
  end if;
  select l.genre_exercice into v_genre from public.lecons l where l.id = p_lecon and l.type = 'exercice';
  if not found then
    raise exception 'Cet exercice ne vous est pas ouvert.' using errcode = '42501';
  end if;
  if v_genre <> 'simple' then
    raise exception 'Cet exercice demande un dépôt.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || p_lecon::text, 0));
  if not exists (select 1 from public.rendus_exercices r where r.lecon_id = p_lecon and r.profil_id = v_uid and r.statut = 'valide') then
    insert into public.rendus_exercices (lecon_id, profil_id, version, statut)
    values (p_lecon, v_uid, coalesce((select max(r.version) from public.rendus_exercices r where r.lecon_id = p_lecon and r.profil_id = v_uid), 0) + 1, 'valide');
  end if;
  return jsonb_build_object('statut', 'valide');
end;
$$;

-- La page « Exercices » : les exercices où le compte a rendu au moins une fois, le plus récent d'abord.
create or replace function public.mes_exercices()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(s.x order by s.quand desc), '[]'::jsonb)
  from (
    select
      jsonb_build_object(
        'lecon_id', l.id, 'titre', l.titre, 'genre', l.genre_exercice, 'formation', f.titre, 'slug', f.slug,
        'module', m.titre, 'module_rang', public.rang_du_module(m.id), 'statut', d.statut, 'version', d.version,
        'remarque', d.remarque, 'correcteur', public.nom_du_profil(d.corrige_par), 'corrige_le', d.corrige_le, 'cree_le', d.cree_le
      ) as x,
      coalesce(d.corrige_le, d.cree_le) as quand
    from public.derniers_rendus d
    join public.lecons l on l.id = d.lecon_id
    join public.modules m on m.id = l.module_id
    join public.formations f on f.id = m.formation_id
    where d.profil_id = (select auth.uid())
  ) s;
$$;

-- Le dernier statut du compte à chaque exercice d'une formation : { "<leçon>": "valide", … }.
create or replace function public.mes_statuts_exercices(p_formation uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(d.lecon_id::text, d.statut), '{}'::jsonb)
  from public.derniers_rendus d
  join public.lecons l on l.id = d.lecon_id
  join public.modules m on m.id = l.module_id
  where d.profil_id = (select auth.uid()) and m.formation_id = p_formation;
$$;

-- ─── Côté correcteur (formateur de la formation, équipe) ───────────────────────────────────────────
-- Les travaux en attente (la dernière version de chacun), les plus anciens d'abord.
create or replace function public.corrections_a_faire()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(s.x order by s.quand), '[]'::jsonb)
  from (
    select
      jsonb_build_object(
        'rendu_id', d.id, 'etudiant', coalesce(public.nom_du_profil(d.profil_id), 'Étudiant'), 'exercice', l.titre,
        'formation', f.titre, 'formation_id', f.id, 'module', m.titre, 'module_rang', public.rang_du_module(m.id),
        'version', d.version, 'nom_fichier', d.nom_fichier, 'depose_le', d.cree_le
      ) as x,
      d.cree_le as quand
    from public.derniers_rendus d
    join public.lecons l on l.id = d.lecon_id
    join public.modules m on m.id = l.module_id
    join public.formations f on f.id = m.formation_id
    where d.statut = 'en_attente'
      and not public.compte_suspendu()
      and (public.equipe_contenus() or public.formateur_de(f.id))
  ) s;
$$;

-- Un travail à corriger : l'étudiant, l'exercice et sa consigne, la version, l'historique, le travail suivant.
create or replace function public.rendu_a_corriger(p_rendu uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_r public.rendus_exercices;
begin
  select * into v_r from public.rendus_exercices r where r.id = p_rendu;
  if not found or not public.editeur_de_lecon(v_r.lecon_id) then
    return null;
  end if;
  return (
    select jsonb_build_object(
      'etudiant', coalesce(public.nom_du_profil(v_r.profil_id), 'Étudiant'),
      'exercice', jsonb_build_object('id', l.id, 'titre', l.titre, 'genre', l.genre_exercice, 'consigne', coalesce(c.texte, '')),
      'formation', jsonb_build_object('id', f.id, 'titre', f.titre, 'slug', f.slug),
      'module', jsonb_build_object('titre', m.titre, 'rang', public.rang_du_module(m.id)),
      'version', public.version_rendu(v_r),
      'derniere', not exists (
        select 1 from public.rendus_exercices r where r.lecon_id = v_r.lecon_id and r.profil_id = v_r.profil_id and r.version > v_r.version
      ),
      'historique', (
        select jsonb_agg(public.version_rendu(r) order by r.version desc)
        from public.rendus_exercices r
        where r.lecon_id = v_r.lecon_id and r.profil_id = v_r.profil_id
      ),
      'suivant', (
        select d.id
        from public.derniers_rendus d
        join public.lecons l2 on l2.id = d.lecon_id
        join public.modules m2 on m2.id = l2.module_id
        where d.statut = 'en_attente' and d.id <> v_r.id and (public.equipe_contenus() or public.formateur_de(m2.formation_id))
        order by d.cree_le
        limit 1
      )
    )
    from public.lecons l
    join public.modules m on m.id = l.module_id
    join public.formations f on f.id = m.formation_id
    left join public.lecons_contenus c on c.lecon_id = l.id
    where l.id = v_r.lecon_id
  );
end;
$$;

-- Le fichier d'un rendu (chemin et nom), pour son auteur ou un correcteur : le lien de téléchargement se fait ensuite.
create or replace function public.fichier_rendu(p_rendu uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('chemin', r.fichier, 'nom', r.nom_fichier)
  from public.rendus_exercices r
  where r.id = p_rendu and r.fichier is not null and (r.profil_id = (select auth.uid()) or public.editeur_de_lecon(r.lecon_id));
$$;

-- « Valider l'exercice » (commentaire facultatif) ou « Demander une correction » (remarque exigée) ; l'étudiant est prévenu.
create or replace function public.corriger_rendu(p_rendu uuid, p_decision text, p_remarque text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.rendus_exercices;
  v_remarque text := left(btrim(coalesce(p_remarque, '')), 2000);
  v_titre text;
  v_lien text;
begin
  select * into v_r from public.rendus_exercices r where r.id = p_rendu for update;
  if not found or not public.editeur_de_lecon(v_r.lecon_id) then
    raise exception 'Cette formation n’est pas l’une de vos formations.' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('valide', 'a_corriger') then
    raise exception 'Décision inconnue.';
  end if;
  if v_r.statut <> 'en_attente' or exists (
    select 1 from public.rendus_exercices r where r.lecon_id = v_r.lecon_id and r.profil_id = v_r.profil_id and r.version > v_r.version
  ) then
    raise exception 'Ce travail a déjà été corrigé.';
  end if;
  if p_decision = 'a_corriger' and v_remarque = '' then
    raise exception 'Expliquez ce qu’il faut corriger.';
  end if;
  update public.rendus_exercices
  set statut = p_decision, remarque = v_remarque, corrige_par = (select auth.uid()), corrige_le = now()
  where id = p_rendu;

  select l.titre, '/formations/' || f.slug || '/lecons/' || l.id into v_titre, v_lien
  from public.lecons l
  join public.modules m on m.id = l.module_id
  join public.formations f on f.id = m.formation_id
  where l.id = v_r.lecon_id;
  perform public.notifier(
    array[v_r.profil_id], 'exercices',
    case when p_decision = 'valide' then 'Exercice validé' else 'Une correction est demandée' end,
    v_titre, v_lien
  );
  return jsonb_build_object('statut', p_decision);
end;
$$;

-- ─── Droits d'exécution ─────────────────────────────────────────────────────────────────────────────
revoke execute on function public.genre_exercice_par_defaut() from public, anon, authenticated;
revoke execute on function public.formats_rendu() from public, anon;
grant execute on function public.formats_rendu() to authenticated;
revoke execute on function public.nom_du_profil(uuid) from public, anon, authenticated;
revoke execute on function public.version_rendu(public.rendus_exercices) from public, anon, authenticated;
revoke execute on function public.rang_du_module(uuid) from public, anon, authenticated;
revoke execute on function public.rendu_lisible(text) from public, anon;
grant execute on function public.rendu_lisible(text) to authenticated;
revoke execute on function public.rendu_attache(text) from public, anon;
grant execute on function public.rendu_attache(text) to authenticated;
revoke execute on function public.exercice_etudiant(uuid) from public, anon;
grant execute on function public.exercice_etudiant(uuid) to authenticated;
revoke execute on function public.rendre_exercice(uuid, text, text, text) from public, anon;
grant execute on function public.rendre_exercice(uuid, text, text, text) to authenticated;
revoke execute on function public.terminer_exercice(uuid) from public, anon;
grant execute on function public.terminer_exercice(uuid) to authenticated;
revoke execute on function public.mes_exercices() from public, anon;
grant execute on function public.mes_exercices() to authenticated;
revoke execute on function public.mes_statuts_exercices(uuid) from public, anon;
grant execute on function public.mes_statuts_exercices(uuid) to authenticated;
revoke execute on function public.corrections_a_faire() from public, anon;
grant execute on function public.corrections_a_faire() to authenticated;
revoke execute on function public.rendu_a_corriger(uuid) from public, anon;
grant execute on function public.rendu_a_corriger(uuid) to authenticated;
revoke execute on function public.fichier_rendu(uuid) from public, anon;
grant execute on function public.fichier_rendu(uuid) to authenticated;
revoke execute on function public.corriger_rendu(uuid, text, text) from public, anon;
grant execute on function public.corriger_rendu(uuid, text, text) to authenticated;

commit;
