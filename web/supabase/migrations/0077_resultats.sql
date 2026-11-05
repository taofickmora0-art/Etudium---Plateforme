-- Migration 0077 : « Mes résultats » (spec du 5 novembre 2026, docs/superpowers/specs/2026-11-05-mes-resultats-design.md).
-- L'étudiant range ses notes d'université : ses parcours scolaires (avec les règles de calcul de son école), leurs
-- semestres, leurs UE (avec leurs crédits), les ECUE de chaque UE (avec leurs crédits ou coefficients, et au besoin un
-- barème propre) et ses notes. Les moyennes se calculent dans l'appli ; la base ne garde que ce qu'il a saisi.
--   - Tout est réservé à son propriétaire : personne d'autre, pas même l'équipe Étudium, ne lit ni n'écrit.
--   - Les règles : un barème (des types de notes et leur poids, 100 % au total, un seul type « examen »), le seuil de
--     validation d'une UE et du semestre, la compensation entre UE, ce que fait le rattrapage. Vérifiées ici.
--   - Des limites par compte : 10 parcours ; 20 semestres par parcours ; 30 UE par semestre ; 20 ECUE par UE ; 60 notes
--     par ECUE.
--   - Le code PIN (4 chiffres, facultatif) : quand il existe, la base n'ouvre rien sans un jeton de déverrouillage,
--     envoyé par le serveur de l'appli dans l'en-tête x-etudium-resultats ; il vaut 15 minutes et se prolonge à chaque
--     visite. 5 codes faux bloquent l'espace 15 minutes. Le code oublié se retire après une connexion récente (moins
--     de 10 minutes, lue dans « amr » du jeton de session), sans rien perdre.
-- Rejouable.

begin;

-- ─── Les règles de calcul ───────────────────────────────────────────────────────────────────────────
-- Un barème : de 1 à 6 types { cle, nom, poids, examen? }, des clés distinctes, 100 % au total, un seul « examen ».
create or replace function public.bareme_resultats_valide(p jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  c jsonb;
  total numeric := 0;
  examens integer := 0;
  cles text[] := '{}';
begin
  if p is null or jsonb_typeof(p) is distinct from 'array' then
    return false;
  end if;
  if jsonb_array_length(p) not between 1 and 6 then
    return false;
  end if;
  for c in select e from jsonb_array_elements(p) e loop
    if jsonb_typeof(c) is distinct from 'object' then
      return false;
    end if;
    if coalesce(c ->> 'cle', '') !~ '^[a-z0-9-]{1,30}$' then
      return false;
    end if;
    if (c ->> 'cle') = any (cles) then
      return false;
    end if;
    cles := cles || (c ->> 'cle');
    if char_length(btrim(coalesce(c ->> 'nom', ''))) not between 1 and 40 then
      return false;
    end if;
    if jsonb_typeof(c -> 'poids') is distinct from 'number' then
      return false;
    end if;
    if (c ->> 'poids')::numeric <= 0 or (c ->> 'poids')::numeric > 100 then
      return false;
    end if;
    total := total + (c ->> 'poids')::numeric;
    if c ? 'examen' then
      if jsonb_typeof(c -> 'examen') is distinct from 'boolean' then
        return false;
      end if;
      if (c ->> 'examen')::boolean then
        examens := examens + 1;
      end if;
    end if;
  end loop;
  return total = 100 and examens <= 1;
end;
$$;

-- Les règles d'un parcours : { seuil_ue, seuil_semestre (0 à 20), compensation, rattrapage (remplace | meilleure),
-- categories (le barème) }.
create or replace function public.regles_resultats_valides(p jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p is null or jsonb_typeof(p) is distinct from 'object' then
    return false;
  end if;
  if jsonb_typeof(p -> 'seuil_ue') is distinct from 'number' or jsonb_typeof(p -> 'seuil_semestre') is distinct from 'number' then
    return false;
  end if;
  if (p ->> 'seuil_ue')::numeric not between 0 and 20 or (p ->> 'seuil_semestre')::numeric not between 0 and 20 then
    return false;
  end if;
  if jsonb_typeof(p -> 'compensation') is distinct from 'boolean' then
    return false;
  end if;
  if jsonb_typeof(p -> 'rattrapage') is distinct from 'string' or (p ->> 'rattrapage') not in ('remplace', 'meilleure') then
    return false;
  end if;
  return public.bareme_resultats_valide(p -> 'categories');
end;
$$;

-- ─── Les tables ─────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.parcours_scolaires (
  id uuid primary key default gen_random_uuid(),
  profil_id uuid not null default auth.uid() references public.profils (id) on delete cascade,
  nom text not null,
  etablissement text not null default '',
  regles jsonb not null default '{"seuil_ue": 10, "seuil_semestre": 10, "compensation": false, "rattrapage": "remplace", "categories": [{"cle": "cc", "nom": "Contrôle continu", "poids": 40}, {"cle": "examen", "nom": "Examen", "poids": 60, "examen": true}]}'::jsonb,
  ordre integer not null default 0,
  cree_le timestamptz not null default now(),
  constraint parcours_scolaires_nom check (char_length(btrim(nom)) between 1 and 120),
  constraint parcours_scolaires_etablissement check (char_length(etablissement) <= 120),
  constraint parcours_scolaires_regles check (public.regles_resultats_valides(regles))
);
create index if not exists parcours_scolaires_profil_idx on public.parcours_scolaires (profil_id, ordre);

create table if not exists public.semestres_scolaires (
  id uuid primary key default gen_random_uuid(),
  parcours_id uuid not null references public.parcours_scolaires (id) on delete cascade,
  profil_id uuid not null default auth.uid() references public.profils (id) on delete cascade,
  nom text not null,
  annee text not null default '',
  ordre integer not null default 0,
  cree_le timestamptz not null default now(),
  constraint semestres_scolaires_nom check (char_length(btrim(nom)) between 1 and 60),
  constraint semestres_scolaires_annee check (char_length(annee) <= 20)
);
create index if not exists semestres_scolaires_parcours_idx on public.semestres_scolaires (parcours_id, ordre);

create table if not exists public.ue_scolaires (
  id uuid primary key default gen_random_uuid(),
  semestre_id uuid not null references public.semestres_scolaires (id) on delete cascade,
  profil_id uuid not null default auth.uid() references public.profils (id) on delete cascade,
  code text not null default '',
  intitule text not null,
  credits numeric(4, 1) not null,
  ordre integer not null default 0,
  cree_le timestamptz not null default now(),
  constraint ue_scolaires_code check (char_length(code) <= 20),
  constraint ue_scolaires_intitule check (char_length(btrim(intitule)) between 1 and 120),
  constraint ue_scolaires_credits check (credits > 0 and credits <= 60)
);
create index if not exists ue_scolaires_semestre_idx on public.ue_scolaires (semestre_id, ordre);

create table if not exists public.ecue_scolaires (
  id uuid primary key default gen_random_uuid(),
  ue_id uuid not null references public.ue_scolaires (id) on delete cascade,
  profil_id uuid not null default auth.uid() references public.profils (id) on delete cascade,
  intitule text not null,
  -- Ses crédits, ou son coefficient : son poids dans la moyenne de l'UE.
  poids numeric(5, 2) not null default 1,
  -- Son barème propre ; null : celui du parcours.
  bareme jsonb,
  ordre integer not null default 0,
  cree_le timestamptz not null default now(),
  constraint ecue_scolaires_intitule check (char_length(btrim(intitule)) between 1 and 120),
  constraint ecue_scolaires_poids check (poids > 0 and poids <= 100),
  constraint ecue_scolaires_bareme check (bareme is null or public.bareme_resultats_valide(bareme))
);
create index if not exists ecue_scolaires_ue_idx on public.ecue_scolaires (ue_id, ordre);

create table if not exists public.notes_scolaires (
  id uuid primary key default gen_random_uuid(),
  ecue_id uuid not null references public.ecue_scolaires (id) on delete cascade,
  profil_id uuid not null default auth.uid() references public.profils (id) on delete cascade,
  -- La clé d'un type du barème (« cc », « examen »…) ; un rattrapage porte la clé du type « examen ».
  categorie text not null,
  libelle text not null default '',
  note numeric(6, 2) not null,
  sur numeric(6, 2) not null default 20,
  rattrapage boolean not null default false,
  date date,
  cree_le timestamptz not null default now(),
  constraint notes_scolaires_categorie check (categorie ~ '^[a-z0-9-]{1,30}$'),
  constraint notes_scolaires_libelle check (char_length(libelle) <= 60),
  constraint notes_scolaires_note check (note >= 0 and sur > 0 and sur <= 100 and note <= sur)
);
create index if not exists notes_scolaires_ecue_idx on public.notes_scolaires (ecue_id, cree_le);

-- ─── Les limites, et l'ordre d'arrivée ──────────────────────────────────────────────────────────────
create or replace function public.limiter_resultats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if tg_table_name = 'parcours_scolaires' then
    select count(*) into n from public.parcours_scolaires where profil_id = new.profil_id;
    if n >= 10 then
      raise exception 'Tu as atteint la limite de 10 parcours.';
    end if;
    new.ordre := n;
  elsif tg_table_name = 'semestres_scolaires' then
    select count(*) into n from public.semestres_scolaires where parcours_id = new.parcours_id;
    if n >= 20 then
      raise exception 'Un parcours compte 20 semestres au plus.';
    end if;
    new.ordre := n;
  elsif tg_table_name = 'ue_scolaires' then
    select count(*) into n from public.ue_scolaires where semestre_id = new.semestre_id;
    if n >= 30 then
      raise exception 'Un semestre compte 30 UE au plus.';
    end if;
    new.ordre := n;
  elsif tg_table_name = 'ecue_scolaires' then
    select count(*) into n from public.ecue_scolaires where ue_id = new.ue_id;
    if n >= 20 then
      raise exception 'Une UE compte 20 ECUE au plus.';
    end if;
    new.ordre := n;
  elsif tg_table_name = 'notes_scolaires' then
    select count(*) into n from public.notes_scolaires where ecue_id = new.ecue_id;
    if n >= 60 then
      raise exception 'Une ECUE compte 60 notes au plus.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists limiter_parcours_scolaires on public.parcours_scolaires;
create trigger limiter_parcours_scolaires before insert on public.parcours_scolaires for each row execute function public.limiter_resultats();
drop trigger if exists limiter_semestres_scolaires on public.semestres_scolaires;
create trigger limiter_semestres_scolaires before insert on public.semestres_scolaires for each row execute function public.limiter_resultats();
drop trigger if exists limiter_ue_scolaires on public.ue_scolaires;
create trigger limiter_ue_scolaires before insert on public.ue_scolaires for each row execute function public.limiter_resultats();
drop trigger if exists limiter_ecue_scolaires on public.ecue_scolaires;
create trigger limiter_ecue_scolaires before insert on public.ecue_scolaires for each row execute function public.limiter_resultats();
drop trigger if exists limiter_notes_scolaires on public.notes_scolaires;
create trigger limiter_notes_scolaires before insert on public.notes_scolaires for each row execute function public.limiter_resultats();

-- ─── Le code PIN et les déverrouillages ─────────────────────────────────────────────────────────────
-- Une ligne par compte : le code (sel et empreinte ; null sans code), les erreurs, le blocage, la proposition vue.
create table if not exists public.verrou_resultats (
  profil_id uuid primary key references public.profils (id) on delete cascade,
  sel text,
  empreinte text,
  echecs integer not null default 0,
  bloque_jusqua timestamptz,
  propose_le timestamptz
);
-- Un déverrouillage : l'empreinte de son jeton, valable jusqu'à `expire_le`.
create table if not exists public.ouvertures_resultats (
  empreinte text primary key,
  profil_id uuid not null references public.profils (id) on delete cascade,
  expire_le timestamptz not null
);
create index if not exists ouvertures_resultats_profil_idx on public.ouvertures_resultats (profil_id);

-- L'empreinte d'un code : SHA-256 salé, répété 1 000 fois (sans extension).
create or replace function public.empreinte_pin_resultats(p_sel text, p_pin text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  h bytea := sha256(convert_to(p_sel || ':' || p_pin, 'UTF8'));
begin
  for i in 1..1000 loop
    h := sha256(h || convert_to(p_sel, 'UTF8'));
  end loop;
  return encode(h, 'hex');
end;
$$;

create or replace function public.empreinte_jeton_resultats(p_jeton text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(coalesce(p_jeton, ''), 'UTF8')), 'hex');
$$;

-- Le jeton envoyé par le serveur de l'appli (en-tête x-etudium-resultats), ou ''.
create or replace function public.jeton_resultats_requete()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-etudium-resultats', '');
$$;

-- Les résultats du compte sont-ils ouverts ? Sans code : oui. Avec un code : seulement avec un jeton valable.
create or replace function public.resultats_ouverts()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.verrou_resultats v where v.profil_id = (select auth.uid()) and v.empreinte is not null)
      or exists (
        select 1 from public.ouvertures_resultats o
        where o.profil_id = (select auth.uid())
          and o.expire_le > now()
          and o.empreinte = public.empreinte_jeton_resultats(public.jeton_resultats_requete())
      );
$$;

-- Un nouveau jeton de 15 minutes (les jetons expirés du compte partent).
create or replace function public.nouveau_jeton_resultats(p_profil uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  j text := encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text || clock_timestamp()::text, 'UTF8')), 'hex');
begin
  delete from public.ouvertures_resultats where profil_id = p_profil and expire_le <= now();
  insert into public.ouvertures_resultats (empreinte, profil_id, expire_le) values (public.empreinte_jeton_resultats(j), p_profil, now() + interval '15 minutes');
  return j;
end;
$$;

-- Vérifie le code du compte et tient le compte des erreurs : { ok } ou { ok: false, message }. Le résultat est rendu
-- (jamais levé) pour que l'erreur comptée reste enregistrée. Sans code : ok.
create or replace function public.verifier_pin_resultats(p_pin text, p_quoi text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.verrou_resultats%rowtype;
  minutes integer;
  restants integer;
begin
  select * into v from public.verrou_resultats where profil_id = (select auth.uid()) for update;
  if not found or v.empreinte is null then
    return jsonb_build_object('ok', true);
  end if;
  if v.bloque_jusqua is not null and v.bloque_jusqua > now() then
    minutes := greatest(1, ceil(extract(epoch from v.bloque_jusqua - now()) / 60)::integer);
    return jsonb_build_object('ok', false, 'message', 'Trop d’essais : réessaie dans ' || minutes || case when minutes > 1 then ' minutes.' else ' minute.' end);
  end if;
  if coalesce(p_pin, '') ~ '^[0-9]{4}$' and public.empreinte_pin_resultats(v.sel, p_pin) = v.empreinte then
    update public.verrou_resultats set echecs = 0, bloque_jusqua = null where profil_id = v.profil_id;
    return jsonb_build_object('ok', true);
  end if;
  if v.echecs + 1 >= 5 then
    update public.verrou_resultats set echecs = 0, bloque_jusqua = now() + interval '15 minutes' where profil_id = v.profil_id;
    return jsonb_build_object('ok', false, 'message', 'Trop d’essais : réessaie dans 15 minutes.');
  end if;
  update public.verrou_resultats set echecs = v.echecs + 1 where profil_id = v.profil_id;
  restants := 5 - (v.echecs + 1);
  return jsonb_build_object('ok', false, 'message', p_quoi || ' incorrect. Encore ' || restants || case when restants > 1 then ' essais.' else ' essai.' end);
end;
$$;

-- L'état de l'espace : { pin, ouvert, bloque_jusqua, propose }. Ouvert, le jeton se prolonge de 15 minutes.
create or replace function public.etat_resultats()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v public.verrou_resultats%rowtype;
  prolonges integer;
begin
  if v_uid is null then
    raise exception 'Connecte-toi pour voir tes résultats.' using errcode = '42501';
  end if;
  select * into v from public.verrou_resultats where profil_id = v_uid;
  update public.ouvertures_resultats
  set expire_le = now() + interval '15 minutes'
  where profil_id = v_uid and expire_le > now() and empreinte = public.empreinte_jeton_resultats(public.jeton_resultats_requete());
  get diagnostics prolonges = row_count;
  return jsonb_build_object(
    'pin', v.empreinte is not null,
    'ouvert', v.empreinte is null or prolonges > 0,
    'bloque_jusqua', case when v.bloque_jusqua > now() then v.bloque_jusqua end,
    'propose', v.propose_le is not null
  );
end;
$$;

-- « Plus tard » : la proposition du code ne revient plus (il se crée depuis « Sécurité »).
create or replace function public.proposer_pin_vu()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  insert into public.verrou_resultats (profil_id, propose_le) values ((select auth.uid()), now())
  on conflict (profil_id) do update set propose_le = coalesce(public.verrou_resultats.propose_le, now());
end;
$$;

-- Créer le code, ou le changer (avec le code actuel) : { ok, jeton } (l'espace reste ouvert), ou { ok: false, message }.
create or replace function public.definir_pin_resultats(p_pin text, p_actuel text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_sel text := gen_random_uuid()::text;
  v_existant boolean;
  r jsonb;
begin
  perform public.exiger_compte_actif();
  if coalesce(p_pin, '') !~ '^[0-9]{4}$' then
    raise exception 'Le code doit faire 4 chiffres.';
  end if;
  select empreinte is not null into v_existant from public.verrou_resultats where profil_id = v_uid;
  if coalesce(v_existant, false) then
    r := public.verifier_pin_resultats(p_actuel, 'Code actuel');
    if not (r ->> 'ok')::boolean then
      return r;
    end if;
  end if;
  insert into public.verrou_resultats (profil_id, sel, empreinte, echecs, bloque_jusqua, propose_le)
  values (v_uid, v_sel, public.empreinte_pin_resultats(v_sel, p_pin), 0, null, now())
  on conflict (profil_id) do update
    set sel = excluded.sel, empreinte = excluded.empreinte, echecs = 0, bloque_jusqua = null,
        propose_le = coalesce(public.verrou_resultats.propose_le, now());
  delete from public.ouvertures_resultats where profil_id = v_uid;
  return jsonb_build_object('ok', true, 'jeton', public.nouveau_jeton_resultats(v_uid));
end;
$$;

-- Ouvrir l'espace avec le code : { ok, jeton } (null sans code) ou { ok: false, message }.
create or replace function public.ouvrir_resultats(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  r jsonb;
begin
  perform public.exiger_compte_actif();
  r := public.verifier_pin_resultats(p_pin, 'Code');
  if not (r ->> 'ok')::boolean then
    return r;
  end if;
  if not exists (select 1 from public.verrou_resultats where profil_id = v_uid and empreinte is not null) then
    return jsonb_build_object('ok', true, 'jeton', null);
  end if;
  return jsonb_build_object('ok', true, 'jeton', public.nouveau_jeton_resultats(v_uid));
end;
$$;

-- Reverrouiller : le jeton de la requête ne vaut plus rien.
create or replace function public.fermer_resultats()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.ouvertures_resultats
  where profil_id = (select auth.uid()) and empreinte = public.empreinte_jeton_resultats(public.jeton_resultats_requete());
$$;

-- Retirer le code (avec le code) : { ok } ou { ok: false, message }.
create or replace function public.retirer_pin_resultats(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  r jsonb;
begin
  perform public.exiger_compte_actif();
  r := public.verifier_pin_resultats(p_pin, 'Code');
  if not (r ->> 'ok')::boolean then
    return r;
  end if;
  update public.verrou_resultats set sel = null, empreinte = null, echecs = 0, bloque_jusqua = null where profil_id = v_uid;
  delete from public.ouvertures_resultats where profil_id = v_uid;
  return jsonb_build_object('ok', true);
end;
$$;

-- Code oublié : il se retire seulement juste après une connexion (moins de 10 minutes, « amr » du jeton de session) ;
-- les résultats restent, l'étudiant crée un nouveau code.
create or replace function public.oublier_pin_resultats()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  dernier bigint;
begin
  perform public.exiger_compte_actif();
  select max((a ->> 'timestamp')::bigint) into dernier
  from json_array_elements(coalesce(nullif(current_setting('request.jwt.claims', true), '')::json -> 'amr', '[]'::json)) a;
  if dernier is null or dernier < extract(epoch from now()) - 600 then
    raise exception 'Reconnecte-toi pour créer un nouveau code.' using errcode = '42501';
  end if;
  update public.verrou_resultats set sel = null, empreinte = null, echecs = 0, bloque_jusqua = null where profil_id = v_uid;
  delete from public.ouvertures_resultats where profil_id = v_uid;
  return true;
end;
$$;

-- ─── Les règles d'accès ─────────────────────────────────────────────────────────────────────────────
alter table public.parcours_scolaires enable row level security;
alter table public.semestres_scolaires enable row level security;
alter table public.ue_scolaires enable row level security;
alter table public.ecue_scolaires enable row level security;
alter table public.notes_scolaires enable row level security;
alter table public.verrou_resultats enable row level security;
alter table public.ouvertures_resultats enable row level security;

revoke all on public.parcours_scolaires, public.semestres_scolaires, public.ue_scolaires, public.ecue_scolaires, public.notes_scolaires from anon;
revoke truncate on public.parcours_scolaires, public.semestres_scolaires, public.ue_scolaires, public.ecue_scolaires, public.notes_scolaires from authenticated;
grant select, insert, update, delete on public.parcours_scolaires, public.semestres_scolaires, public.ue_scolaires, public.ecue_scolaires, public.notes_scolaires to authenticated;
-- Le code et les déverrouillages : par les fonctions seulement.
revoke all on public.verrou_resultats, public.ouvertures_resultats from public, anon, authenticated;

drop policy if exists "parcours scolaires : le propriétaire" on public.parcours_scolaires;
create policy "parcours scolaires : le propriétaire" on public.parcours_scolaires
  for all to authenticated
  using (profil_id = (select auth.uid()) and (select public.resultats_ouverts()))
  with check (profil_id = (select auth.uid()) and (select public.resultats_ouverts()));

drop policy if exists "semestres scolaires : le propriétaire" on public.semestres_scolaires;
create policy "semestres scolaires : le propriétaire" on public.semestres_scolaires
  for all to authenticated
  using (profil_id = (select auth.uid()) and (select public.resultats_ouverts()))
  with check (
    profil_id = (select auth.uid()) and (select public.resultats_ouverts())
    and exists (select 1 from public.parcours_scolaires p where p.id = parcours_id and p.profil_id = (select auth.uid()))
  );

drop policy if exists "UE scolaires : le propriétaire" on public.ue_scolaires;
create policy "UE scolaires : le propriétaire" on public.ue_scolaires
  for all to authenticated
  using (profil_id = (select auth.uid()) and (select public.resultats_ouverts()))
  with check (
    profil_id = (select auth.uid()) and (select public.resultats_ouverts())
    and exists (select 1 from public.semestres_scolaires s where s.id = semestre_id and s.profil_id = (select auth.uid()))
  );

drop policy if exists "ECUE scolaires : le propriétaire" on public.ecue_scolaires;
create policy "ECUE scolaires : le propriétaire" on public.ecue_scolaires
  for all to authenticated
  using (profil_id = (select auth.uid()) and (select public.resultats_ouverts()))
  with check (
    profil_id = (select auth.uid()) and (select public.resultats_ouverts())
    and exists (select 1 from public.ue_scolaires u where u.id = ue_id and u.profil_id = (select auth.uid()))
  );

drop policy if exists "notes scolaires : le propriétaire" on public.notes_scolaires;
create policy "notes scolaires : le propriétaire" on public.notes_scolaires
  for all to authenticated
  using (profil_id = (select auth.uid()) and (select public.resultats_ouverts()))
  with check (
    profil_id = (select auth.uid()) and (select public.resultats_ouverts())
    and exists (select 1 from public.ecue_scolaires e where e.id = ecue_id and e.profil_id = (select auth.uid()))
  );

-- ─── Droits des fonctions ───────────────────────────────────────────────────────────────────────────
revoke execute on function public.limiter_resultats() from public, anon, authenticated;
revoke execute on function public.empreinte_pin_resultats(text, text) from public, anon, authenticated;
revoke execute on function public.nouveau_jeton_resultats(uuid) from public, anon, authenticated;
revoke execute on function public.verifier_pin_resultats(text, text) from public, anon, authenticated;
revoke execute on function public.etat_resultats() from public, anon;
revoke execute on function public.proposer_pin_vu() from public, anon;
revoke execute on function public.definir_pin_resultats(text, text) from public, anon;
revoke execute on function public.ouvrir_resultats(text) from public, anon;
revoke execute on function public.fermer_resultats() from public, anon;
revoke execute on function public.retirer_pin_resultats(text) from public, anon;
revoke execute on function public.oublier_pin_resultats() from public, anon;
grant execute on function public.etat_resultats() to authenticated;
grant execute on function public.proposer_pin_vu() to authenticated;
grant execute on function public.definir_pin_resultats(text, text) to authenticated;
grant execute on function public.ouvrir_resultats(text) to authenticated;
grant execute on function public.fermer_resultats() to authenticated;
grant execute on function public.retirer_pin_resultats(text) to authenticated;
grant execute on function public.oublier_pin_resultats() to authenticated;
-- Les règles d'accès les appellent (validations, jeton de la requête, ouverture).
grant execute on function public.bareme_resultats_valide(jsonb) to authenticated;
grant execute on function public.regles_resultats_valides(jsonb) to authenticated;
grant execute on function public.empreinte_jeton_resultats(text) to authenticated;
grant execute on function public.jeton_resultats_requete() to authenticated;
grant execute on function public.resultats_ouverts() to authenticated;

commit;
