-- Migration 0049 : les abonnements et leur paiement (lot 2, spec du 1er novembre 2026). Trois formules (Basique 3 mois,
-- Standard 6 mois, Premium 1 an) dont l'équipe fixe le prix ; des codes promo ; les paiements Mobile Money passés par
-- Payiz ; les abonnements qu'ils ouvrent, dont les durées s'ajoutent. L'étudiant prépare un paiement ; seul le serveur,
-- muni de son jeton (tiré de la clé Payiz par l'appli ; la base n'en garde que l'empreinte SHA-256, posée quand l'équipe
-- active les paiements), note un essai, le confirme ou l'échec. Personne n'écrit directement dans ces tables. Rejouable.

begin;

-- ─── Les formules ───────────────────────────────────────────────────────────────────────────────────
create table if not exists public.formules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('basique', 'standard', 'premium')),
  nom text not null,
  duree_mois integer not null check (duree_mois in (3, 6, 12)),
  -- Vide tant que l'équipe ne l'a pas fixé (« Prix annoncés au lancement ») ; 1 000 FCFA au moins (minimum de Payiz).
  prix_fcfa integer check (prix_fcfa is null or prix_fcfa >= 1000),
  recommandee boolean not null default false,
  active boolean not null default true,
  ordre integer not null default 0
);
alter table public.formules enable row level security;

insert into public.formules (code, nom, duree_mois, recommandee, ordre) values
  ('basique', 'Basique', 3, false, 1),
  ('standard', 'Standard', 6, true, 2),
  ('premium', 'Premium', 12, false, 3)
on conflict (code) do nothing;

drop policy if exists "formules lisibles par tous" on public.formules;
create policy "formules lisibles par tous" on public.formules for select to anon, authenticated using (true);

-- ─── Les codes promo ────────────────────────────────────────────────────────────────────────────────
create table if not exists public.codes_promo (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_-]{3,30}$'),
  type text not null check (type in ('pourcentage', 'montant')),
  valeur integer not null,
  debut timestamptz,
  fin timestamptz,
  -- Nombre total d'utilisations (paiements réussis) ; vide : sans limite.
  limite integer check (limite is null or limite > 0),
  actif boolean not null default true,
  cree_par uuid references public.profils (id) on delete set null,
  cree_le timestamptz not null default now(),
  constraint codes_promo_valeur check (valeur > 0 and (type <> 'pourcentage' or valeur <= 100))
);
alter table public.codes_promo enable row level security;

drop policy if exists "codes promo lus par l'équipe" on public.codes_promo;
create policy "codes promo lus par l'équipe" on public.codes_promo for select to authenticated using ((select public.equipe_contenus()));

-- ─── Les paiements ──────────────────────────────────────────────────────────────────────────────────
create table if not exists public.paiements (
  -- L'identifiant sert de référence (et de clé d'idempotence) chez Payiz.
  id uuid primary key default gen_random_uuid(),
  profil_id uuid references public.profils (id) on delete set null,
  formule_id uuid not null references public.formules (id),
  code_promo_id uuid references public.codes_promo (id) on delete set null,
  prix_initial integer not null,
  remise integer not null default 0,
  montant integer not null check (montant = 0 or montant >= 1000),
  statut text not null default 'en_attente' check (statut in ('en_attente', 'reussi', 'echoue', 'expire', 'annule')),
  payiz_id text unique,
  operateur text check (operateur in ('mtn', 'moov')),
  -- « +229 01 •• •• •• 00 » : le numéro complet n'est jamais enregistré.
  telephone_masque text,
  motif_echec text,
  essai_le timestamptz,
  cree_le timestamptz not null default now(),
  confirme_le timestamptz,
  -- « ET-R-2026-000123 », attribué à la réussite.
  numero_recu text unique
);
create index if not exists paiements_profil_idx on public.paiements (profil_id, cree_le desc);
create index if not exists paiements_code_idx on public.paiements (code_promo_id);
alter table public.paiements enable row level security;

drop policy if exists "chacun lit ses paiements, l'équipe tous" on public.paiements;
create policy "chacun lit ses paiements, l'équipe tous" on public.paiements for select to authenticated
  using (profil_id = (select auth.uid()) or (select public.equipe_contenus()));

create sequence if not exists public.numeros_recus;

-- ─── Les abonnements ────────────────────────────────────────────────────────────────────────────────
create table if not exists public.abonnements (
  id uuid primary key default gen_random_uuid(),
  profil_id uuid not null references public.profils (id) on delete cascade,
  formule_id uuid not null references public.formules (id),
  paiement_id uuid not null unique references public.paiements (id),
  debut timestamptz not null,
  fin timestamptz not null,
  -- Annulé par l'équipe (remboursement exceptionnel fait depuis Payiz) : il ne compte plus.
  annule_le timestamptz,
  motif_annulation text,
  -- Rappels d'expiration déjà envoyés (0052).
  rappel_7j_le timestamptz,
  rappel_veille_le timestamptz,
  rappel_fin_le timestamptz,
  cree_le timestamptz not null default now(),
  constraint abonnements_periode check (fin > debut)
);
create index if not exists abonnements_profil_idx on public.abonnements (profil_id, fin);
alter table public.abonnements enable row level security;

drop policy if exists "chacun lit ses abonnements, l'équipe tous" on public.abonnements;
create policy "chacun lit ses abonnements, l'équipe tous" on public.abonnements for select to authenticated
  using (profil_id = (select auth.uid()) or (select public.equipe_contenus()));

-- ─── Les notifications de Payiz déjà traitées, et le réglage des paiements ──────────────────────────
create table if not exists public.evenements_payiz (
  id text primary key,
  recu_le timestamptz not null default now()
);
alter table public.evenements_payiz enable row level security;

create table if not exists public.reglages_paiement (
  id boolean primary key default true check (id),
  -- « Payer » est proposé aux étudiants. Désactiver ne touche pas l'empreinte : un paiement déjà envoyé se confirme encore.
  ouverts boolean not null default false,
  -- Empreinte SHA-256 (hexadécimale) du jeton du serveur (tiré de la clé Payiz), posée à l'activation ; elle autorise
  -- le serveur à confirmer.
  empreinte text,
  active_le timestamptz,
  active_par uuid references public.profils (id) on delete set null
);
alter table public.reglages_paiement add column if not exists ouverts boolean not null default false;
alter table public.reglages_paiement enable row level security;
insert into public.reglages_paiement (id) values (true) on conflict (id) do nothing;

-- Personne n'écrit directement : seules les fonctions ci-dessous le font.
revoke insert, update, delete on public.formules, public.codes_promo, public.paiements, public.abonnements from anon, authenticated;
revoke all on public.evenements_payiz, public.reglages_paiement from anon, authenticated;
revoke all on sequence public.numeros_recus from anon, authenticated;

-- ─── Aides internes ─────────────────────────────────────────────────────────────────────────────────
-- L'argent (prix, codes, activation, annulation) : administrateurs seulement.
create or replace function public.equipe_paiements()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.roles where profil_id = (select auth.uid()) and role in ('admin', 'super_admin'));
$$;

create or replace function public.jeton_paiement_valide(p_jeton text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    coalesce(p_jeton, '') <> ''
    and encode(sha256(convert_to(p_jeton, 'UTF8')), 'hex') = (select r.empreinte from public.reglages_paiement r where r.id),
    false
  );
$$;

create or replace function public.exiger_jeton_paiement(p_jeton text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.jeton_paiement_valide(p_jeton) then
    raise exception 'Jeton de paiement non reconnu.' using errcode = '42501';
  end if;
end;
$$;

-- Un abonnement en cours : aujourd'hui entre son début et sa fin, et pas annulé.
create or replace function public.abonne(p_profil uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.abonnements a
    where a.profil_id = p_profil and a.annule_le is null and a.debut <= now() and now() < a.fin
  );
$$;

-- La fin réelle de l'accès : la dernière fin à venir (les abonnements pris en cours s'enchaînent).
create or replace function public.fin_abonnement(p_profil uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select max(a.fin) from public.abonnements a where a.profil_id = p_profil and a.annule_le is null and a.fin > now();
$$;

-- Début + N mois, compté à l'heure du Bénin et ramené au dernier jour du mois (31 août + 6 mois = 28 février).
create or replace function public.fin_periode(p_debut timestamptz, p_mois integer)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select ((p_debut at time zone 'Africa/Porto-Novo') + make_interval(months => p_mois)) at time zone 'Africa/Porto-Novo';
$$;

-- La règle des codes promo, partagée par « Appliquer » et la préparation du paiement.
create or replace function public.remise_code(p_code text, p_formule uuid, p_profil uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_formule public.formules%rowtype;
  v_code public.codes_promo%rowtype;
  v_prix integer;
  v_remise integer;
  v_montant integer;
begin
  select * into v_formule from public.formules where id = p_formule;
  if not found or not v_formule.active or v_formule.prix_fcfa is null then
    return jsonb_build_object('ok', false, 'message', 'Cet abonnement n’est pas encore proposé.');
  end if;
  v_prix := v_formule.prix_fcfa;
  if coalesce(trim(p_code), '') = '' then
    return jsonb_build_object('ok', true, 'code_id', null, 'prix_initial', v_prix, 'remise', 0, 'montant', v_prix);
  end if;

  select * into v_code from public.codes_promo where code = upper(trim(p_code)) and actif;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Ce code n’existe pas.');
  end if;
  if v_code.debut is not null and now() < v_code.debut then
    return jsonb_build_object('ok', false, 'message', 'Ce code n’est pas encore valable.');
  end if;
  if v_code.fin is not null and now() >= v_code.fin then
    return jsonb_build_object('ok', false, 'message', 'Ce code a expiré.');
  end if;
  -- Seuls les paiements réussis consomment le code.
  if v_code.limite is not null
     and (select count(*) from public.paiements p where p.code_promo_id = v_code.id and p.statut = 'reussi') >= v_code.limite then
    return jsonb_build_object('ok', false, 'message', 'Ce code a atteint sa limite.');
  end if;
  if exists (select 1 from public.paiements p where p.code_promo_id = v_code.id and p.statut = 'reussi' and p.profil_id = p_profil) then
    return jsonb_build_object('ok', false, 'message', 'Vous avez déjà utilisé ce code.');
  end if;

  v_remise := case when v_code.type = 'pourcentage' then floor(v_prix * v_code.valeur / 100.0)::integer else least(v_code.valeur, v_prix) end;
  v_montant := v_prix - v_remise;
  -- Payiz n'accepte pas moins de 1 000 FCFA ; 0 (100 %) est un abonnement offert.
  if v_montant between 1 and 999 then
    return jsonb_build_object('ok', false, 'message', 'Ce code ne s’applique pas à cet abonnement.');
  end if;
  return jsonb_build_object('ok', true, 'code_id', v_code.id, 'prix_initial', v_prix, 'remise', v_remise, 'montant', v_montant);
end;
$$;

create or replace function public.carte_paiement(p public.paiements)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'statut', p.statut,
    'formule', (select jsonb_build_object('code', f.code, 'nom', f.nom, 'duree_mois', f.duree_mois) from public.formules f where f.id = p.formule_id),
    'prix_initial', p.prix_initial,
    'remise', p.remise,
    'montant', p.montant,
    'code', (select c.code from public.codes_promo c where c.id = p.code_promo_id),
    'operateur', p.operateur,
    'telephone_masque', p.telephone_masque,
    'motif_echec', p.motif_echec,
    'numero_recu', p.numero_recu,
    'payiz_id', p.payiz_id,
    'cree_le', p.cree_le,
    'essai_le', p.essai_le,
    'confirme_le', p.confirme_le,
    'abonnement', (select jsonb_build_object('debut', a.debut, 'fin', a.fin) from public.abonnements a where a.paiement_id = p.id)
  );
$$;

-- La réussite d'un paiement : une seule fois (verrou de la ligne), un numéro de reçu, et l'abonnement, qui commence à la
-- fin de celui en cours s'il y en a un.
create or replace function public.activer_paiement(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.paiements%rowtype;
  v_duree integer;
  v_debut timestamptz;
begin
  select * into v from public.paiements where id = p_id for update;
  if not found or v.statut = 'reussi' then
    return;
  end if;
  update public.paiements
  set statut = 'reussi',
      motif_echec = null,
      confirme_le = now(),
      numero_recu = 'ET-R-' || to_char(now() at time zone 'Africa/Porto-Novo', 'YYYY') || '-' || lpad(nextval('public.numeros_recus')::text, 6, '0')
  where id = p_id;
  if v.profil_id is null then
    return;
  end if;
  select duree_mois into v_duree from public.formules where id = v.formule_id;
  v_debut := greatest(now(), coalesce(public.fin_abonnement(v.profil_id), now()));
  insert into public.abonnements (profil_id, formule_id, paiement_id, debut, fin)
  values (v.profil_id, v.formule_id, v.id, v_debut, public.fin_periode(v_debut, v_duree))
  on conflict (paiement_id) do nothing;
end;
$$;

-- ─── Le réglage « Paiements activés » ───────────────────────────────────────────────────────────────
create or replace function public.paiements_ouverts()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.reglages_paiement where id and ouverts and empreinte is not null);
$$;

create or replace function public.activer_paiements(p_jeton text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  if not public.equipe_paiements() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;
  if char_length(coalesce(p_jeton, '')) < 32 then
    raise exception 'Le jeton de paiement doit compter au moins 32 caractères.';
  end if;
  update public.reglages_paiement
  set ouverts = true, empreinte = encode(sha256(convert_to(p_jeton, 'UTF8')), 'hex'), active_le = now(), active_par = (select auth.uid())
  where id;
end;
$$;

create or replace function public.desactiver_paiements()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  if not public.equipe_paiements() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;
  -- L'empreinte reste : les paiements déjà envoyés à Payiz se confirment encore.
  update public.reglages_paiement set ouverts = false where id;
end;
$$;

-- Le serveur avant d'appeler Payiz : paiements ouverts, et son jeton reconnu (sinon l'argent reçu ne pourrait pas être
-- confirmé).
create or replace function public.paiements_prets(p_jeton text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.paiements_ouverts() and public.jeton_paiement_valide(p_jeton);
$$;

-- Pour le back-office : les paiements sont-ils ouverts, et le jeton du serveur est-il celui enregistré ?
create or replace function public.etat_paiements(p_jeton text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  if not public.equipe_contenus() then
    raise exception 'Réservé à l’équipe.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'ouverts', public.paiements_ouverts(),
    'jeton_reconnu', case when coalesce(p_jeton, '') = '' then null else public.jeton_paiement_valide(p_jeton) end
  );
end;
$$;

-- ─── Ce que voit l'étudiant ─────────────────────────────────────────────────────────────────────────
create or replace function public.mon_abonnement()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_code text;
  v_nom text;
  v_fin timestamptz;
begin
  if v_uid is null then
    return jsonb_build_object('etat', 'gratuit');
  end if;
  select f.code, f.nom into v_code, v_nom
  from public.abonnements a join public.formules f on f.id = a.formule_id
  where a.profil_id = v_uid and a.annule_le is null and a.debut <= now() and now() < a.fin
  order by a.debut desc limit 1;
  if found then
    return jsonb_build_object('etat', 'actif', 'formule', jsonb_build_object('code', v_code, 'nom', v_nom), 'fin', public.fin_abonnement(v_uid));
  end if;
  select f.code, f.nom, a.fin into v_code, v_nom, v_fin
  from public.abonnements a join public.formules f on f.id = a.formule_id
  where a.profil_id = v_uid and a.annule_le is null and a.fin <= now()
  order by a.fin desc limit 1;
  if found then
    return jsonb_build_object('etat', 'expire', 'formule', jsonb_build_object('code', v_code, 'nom', v_nom), 'fin', v_fin);
  end if;
  return jsonb_build_object('etat', 'gratuit');
end;
$$;

create or replace function public.essayer_code(p_code text, p_formule uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  return public.remise_code(p_code, p_formule, (select auth.uid()));
end;
$$;

-- Le paiement à envoyer à Payiz. Un seul en cours par compte : un second « Payer » reprend celui qui attend la
-- validation sur le téléphone. À 100 %, l'abonnement est offert aussitôt, sans Payiz.
create or replace function public.preparer_paiement(p_formule uuid, p_code text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v public.paiements%rowtype;
  v_calcul jsonb;
begin
  perform public.exiger_compte_actif();
  if public.a_role('formateur') then
    raise exception 'Un compte formateur n’a pas d’abonnement.' using errcode = '42501';
  end if;
  -- Deux demandes simultanées d'un même compte passent l'une après l'autre ; un code promo est verrouillé le temps de
  -- compter ses utilisations (un code à 100 % active l'abonnement dans la même transaction).
  perform pg_advisory_xact_lock(hashtext('etudium.paiement.' || v_uid::text));
  if coalesce(trim(p_code), '') <> '' then
    perform 1 from public.codes_promo where code = upper(trim(p_code)) for update;
  end if;

  select * into v from public.paiements
  where profil_id = v_uid and statut = 'en_attente' and payiz_id is not null and essai_le > now() - interval '3 minutes'
  order by essai_le desc limit 1;
  if found then
    return public.carte_paiement(v) || jsonb_build_object('repris', true);
  end if;

  v_calcul := public.remise_code(p_code, p_formule, v_uid);
  if not (v_calcul ->> 'ok')::boolean then
    raise exception '%', v_calcul ->> 'message';
  end if;
  if (v_calcul ->> 'montant')::integer > 0 and not public.paiements_ouverts() then
    raise exception 'Les paiements ouvrent bientôt.';
  end if;

  insert into public.paiements (profil_id, formule_id, code_promo_id, prix_initial, remise, montant)
  values (v_uid, p_formule, (v_calcul ->> 'code_id')::uuid, (v_calcul ->> 'prix_initial')::integer,
          (v_calcul ->> 'remise')::integer, (v_calcul ->> 'montant')::integer)
  returning * into v;
  if v.montant = 0 then
    perform public.activer_paiement(v.id);
    select * into v from public.paiements where id = v.id;
  end if;
  return public.carte_paiement(v) || jsonb_build_object('repris', false);
end;
$$;

-- L'historique : les paiements jamais envoyés à Payiz (préparation abandonnée) n'y figurent pas.
create or replace function public.mes_paiements()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(public.carte_paiement(p) order by p.cree_le desc, p.id), '[]'::jsonb)
  from public.paiements p
  where p.profil_id = (select auth.uid()) and not (p.payiz_id is null and p.montant > 0);
$$;

create or replace function public.mon_paiement(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.carte_paiement(p) from public.paiements p where p.id = p_id and p.profil_id = (select auth.uid());
$$;

-- Le reçu d'un paiement réussi : à son compte et à l'équipe.
create or replace function public.recu(p_numero text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'numero', p.numero_recu,
    'date', p.confirme_le,
    'compte', jsonb_build_object('prenom', coalesce(pr.prenom, ''), 'nom', coalesce(pr.nom, '')),
    'formule', jsonb_build_object('nom', f.nom, 'duree_mois', f.duree_mois),
    'debut', a.debut,
    'fin', a.fin,
    'prix_initial', p.prix_initial,
    'remise', p.remise,
    'code', c.code,
    'montant', p.montant,
    'operateur', p.operateur,
    'telephone_masque', p.telephone_masque
  )
  from public.paiements p
  join public.formules f on f.id = p.formule_id
  left join public.profils pr on pr.id = p.profil_id
  left join public.abonnements a on a.paiement_id = p.id
  left join public.codes_promo c on c.id = p.code_promo_id
  where p.numero_recu = p_numero and p.statut = 'reussi'
    and (p.profil_id = (select auth.uid()) or public.equipe_contenus());
$$;

-- ─── Ce que seul le serveur fait (jeton tiré de la clé Payiz) ───────────────────────────────────────
-- Un essai lancé chez Payiz (premier envoi ou nouvel essai) : le paiement repasse en attente.
create or replace function public.noter_essai(p_paiement uuid, p_payiz text, p_operateur text, p_telephone_masque text, p_jeton text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.paiements%rowtype;
begin
  perform public.exiger_jeton_paiement(p_jeton);
  select * into v from public.paiements where id = p_paiement for update;
  if not found then
    raise exception 'Paiement inconnu.';
  end if;
  if v.statut not in ('en_attente', 'echoue') then
    raise exception 'Ce paiement n’attend plus de règlement.';
  end if;
  if v.payiz_id is not null and v.payiz_id is distinct from p_payiz then
    raise exception 'Paiement Payiz différent.';
  end if;
  update public.paiements
  set payiz_id = p_payiz,
      operateur = case when p_operateur in ('mtn', 'moov') then p_operateur else operateur end,
      telephone_masque = coalesce(nullif(p_telephone_masque, ''), telephone_masque),
      statut = 'en_attente',
      motif_echec = null,
      essai_le = now()
  where id = p_paiement
  returning * into v;
  return public.carte_paiement(v);
end;
$$;

-- Payiz dit « réussi » : le montant doit être celui enregistré. L'argent reçu l'emporte sur un état noté entre-temps
-- (expiré, annulé) ; un paiement déjà réussi est renvoyé tel quel (la relecture et la notification arrivent toutes deux).
create or replace function public.confirmer_paiement(p_paiement uuid, p_payiz text, p_montant integer, p_jeton text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.paiements%rowtype;
begin
  perform public.exiger_jeton_paiement(p_jeton);
  select * into v from public.paiements where id = p_paiement for update;
  if not found then
    raise exception 'Paiement inconnu.';
  end if;
  if v.statut <> 'reussi' then
    if v.payiz_id is not null and v.payiz_id is distinct from p_payiz then
      raise exception 'Paiement Payiz différent.';
    end if;
    if p_montant is distinct from v.montant then
      raise exception 'Montant différent du paiement enregistré.';
    end if;
    update public.paiements set payiz_id = coalesce(payiz_id, p_payiz) where id = p_paiement;
    perform public.activer_paiement(p_paiement);
  end if;
  select * into v from public.paiements where id = p_paiement;
  return public.carte_paiement(v);
end;
$$;

-- Un essai échoué (avec son motif Payiz), une demande expirée ou annulée. Sans effet sur un paiement réussi.
create or replace function public.noter_echec(p_paiement uuid, p_statut text, p_motif text, p_jeton text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.paiements%rowtype;
begin
  perform public.exiger_jeton_paiement(p_jeton);
  if p_statut is null or p_statut not in ('echoue', 'expire', 'annule') then
    raise exception 'État de paiement inconnu.';
  end if;
  select * into v from public.paiements where id = p_paiement for update;
  if not found then
    raise exception 'Paiement inconnu.';
  end if;
  if v.statut <> 'reussi' then
    update public.paiements
    set statut = p_statut,
        motif_echec = case
          when p_statut <> 'echoue' then null
          when p_motif in ('insufficient_funds', 'payer_declined', 'timeout', 'invalid_phone', 'operator_limit', 'operator_unavailable', 'declined', 'unknown') then p_motif
          else 'unknown'
        end
    where id = p_paiement
    returning * into v;
  end if;
  return public.carte_paiement(v);
end;
$$;

-- Les notifications de Payiz peuvent arriver deux fois : une notification déjà traitée est ignorée. Elle n'est notée
-- qu'une fois traitée : en cas d'échec, Payiz relance et la relance est traitée.
create or replace function public.evenement_payiz_traite(p_id text, p_jeton text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_jeton_paiement(p_jeton);
  return exists (select 1 from public.evenements_payiz where id = p_id);
end;
$$;

-- Note une notification traitée : vrai seulement la première fois.
create or replace function public.evenement_payiz(p_id text, p_jeton text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_jeton_paiement(p_jeton);
  insert into public.evenements_payiz (id) values (p_id) on conflict (id) do nothing;
  return found;
end;
$$;

-- ─── Droits ─────────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public.equipe_paiements() from public, anon, authenticated;
revoke execute on function public.jeton_paiement_valide(text) from public, anon, authenticated;
revoke execute on function public.exiger_jeton_paiement(text) from public, anon, authenticated;
revoke execute on function public.abonne(uuid) from public, anon, authenticated;
revoke execute on function public.fin_abonnement(uuid) from public, anon, authenticated;
revoke execute on function public.fin_periode(timestamptz, integer) from public, anon, authenticated;
revoke execute on function public.remise_code(text, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.carte_paiement(public.paiements) from public, anon, authenticated;
revoke execute on function public.activer_paiement(uuid) from public, anon, authenticated;

revoke execute on function public.paiements_ouverts() from public, anon, authenticated;
revoke execute on function public.paiements_prets(text) from public, anon, authenticated;
revoke execute on function public.activer_paiements(text) from public, anon, authenticated;
revoke execute on function public.desactiver_paiements() from public, anon, authenticated;
revoke execute on function public.etat_paiements(text) from public, anon, authenticated;
revoke execute on function public.mon_abonnement() from public, anon, authenticated;
revoke execute on function public.essayer_code(text, uuid) from public, anon, authenticated;
revoke execute on function public.preparer_paiement(uuid, text) from public, anon, authenticated;
revoke execute on function public.mes_paiements() from public, anon, authenticated;
revoke execute on function public.mon_paiement(uuid) from public, anon, authenticated;
revoke execute on function public.recu(text) from public, anon, authenticated;
revoke execute on function public.noter_essai(uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.confirmer_paiement(uuid, text, integer, text) from public, anon, authenticated;
revoke execute on function public.noter_echec(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.evenement_payiz(text, text) from public, anon, authenticated;
revoke execute on function public.evenement_payiz_traite(text, text) from public, anon, authenticated;

grant execute on function public.paiements_ouverts() to anon, authenticated;
grant execute on function public.paiements_prets(text) to anon, authenticated;
grant execute on function public.activer_paiements(text) to authenticated;
grant execute on function public.desactiver_paiements() to authenticated;
grant execute on function public.etat_paiements(text) to authenticated;
grant execute on function public.mon_abonnement() to authenticated;
grant execute on function public.essayer_code(text, uuid) to authenticated;
grant execute on function public.preparer_paiement(uuid, text) to authenticated;
grant execute on function public.mes_paiements() to authenticated;
grant execute on function public.mon_paiement(uuid) to authenticated;
grant execute on function public.recu(text) to authenticated;
-- Appelées par le serveur, avec ou sans session (notifications de Payiz) : le jeton les garde.
grant execute on function public.noter_essai(uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.confirmer_paiement(uuid, text, integer, text) to anon, authenticated;
grant execute on function public.noter_echec(uuid, text, text, text) to anon, authenticated;
grant execute on function public.evenement_payiz(text, text) to anon, authenticated;
grant execute on function public.evenement_payiz_traite(text, text) to anon, authenticated;

commit;
