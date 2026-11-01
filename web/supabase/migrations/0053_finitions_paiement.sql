-- Migration 0053 : les finitions du paiement (relecture du lot 2, 1er novembre 2026). Une préparation jamais partie
-- chez Payiz est reprise au lieu d'en créer une autre ; deux confirmations simultanées d'un même compte s'enchaînent ;
-- annuler un abonnement avance ceux qui le suivaient ; les essais de codes promo sont limités (10 par 10 minutes et par
-- compte). Chaque fonction reprend sa dernière définition. Rejouable.

begin;

-- ─── Les essais de codes promo ──────────────────────────────────────────────────────────────────────
create table if not exists public.essais_codes (
  profil_id uuid not null references public.profils (id) on delete cascade,
  essaye_le timestamptz not null default now()
);
create index if not exists essais_codes_profil_idx on public.essais_codes (profil_id, essaye_le);
alter table public.essais_codes enable row level security;
revoke all on public.essais_codes from anon, authenticated;

-- Note un essai du compte ; faux (et rien de noté) au-delà de 10 essais en 10 minutes. Les essais de plus d'un jour
-- sont effacés au passage.
create or replace function public.noter_essai_code()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  delete from public.essais_codes where profil_id = v_uid and essaye_le < now() - interval '1 day';
  if (select count(*) from public.essais_codes where profil_id = v_uid and essaye_le > now() - interval '10 minutes') >= 10 then
    return false;
  end if;
  insert into public.essais_codes (profil_id) values (v_uid);
  return true;
end;
$$;

-- « Appliquer » (dernière définition : 0049), avec la limite d'essais.
create or replace function public.essayer_code(p_code text, p_formule uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  if not public.noter_essai_code() then
    return jsonb_build_object('ok', false, 'message', 'Trop d’essais de code. Réessayez dans quelques minutes.');
  end if;
  return public.remise_code(p_code, p_formule, (select auth.uid()));
end;
$$;

-- Préparer un paiement (dernière définition : 0049_abonnements_paiements.sql).
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
    -- Un code saisi compte comme un essai (limite contre les codes devinés, 0053).
    if not public.noter_essai_code() then
      raise exception 'Trop d’essais de code. Réessayez dans quelques minutes.';
    end if;
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

  -- Une préparation jamais partie chez Payiz (coupure réseau, Payiz lent) est reprise pour le même abonnement, le même
  -- code et le même montant : même identifiant, donc même clé d'idempotence, et pas de seconde demande au téléphone (0053).
  select * into v from public.paiements
  where profil_id = v_uid and statut = 'en_attente' and payiz_id is null
    and formule_id = p_formule
    and code_promo_id is not distinct from (v_calcul ->> 'code_id')::uuid
    and montant = (v_calcul ->> 'montant')::integer
    and cree_le > now() - interval '15 minutes'
  order by cree_le desc limit 1;
  if found then
    return public.carte_paiement(v) || jsonb_build_object('repris', false);
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

-- Activer un paiement réussi (dernière définition : 0049_abonnements_paiements.sql).
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
  -- Deux paiements du même compte confirmés en même temps : le second attend le premier, et s'enchaîne après (0053).
  perform pg_advisory_xact_lock(hashtext('etudium.abonnement.' || v.profil_id::text));
  select duree_mois into v_duree from public.formules where id = v.formule_id;
  v_debut := greatest(now(), coalesce(public.fin_abonnement(v.profil_id), now()));
  insert into public.abonnements (profil_id, formule_id, paiement_id, debut, fin)
  values (v.profil_id, v.formule_id, v.id, v_debut, public.fin_periode(v_debut, v_duree))
  on conflict (paiement_id) do nothing;
end;
$$;

-- Annuler un abonnement (dernière définition : 0051_paiements_equipe.sql).
create or replace function public.annuler_abonnement(p_abonnement uuid, p_motif text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motif text := btrim(coalesce(p_motif, ''));
  v_profil uuid;
  v_debut timestamptz;
  v_fin timestamptz;
begin
  perform public.exiger_equipe_paiements();
  if char_length(v_motif) < 3 or char_length(v_motif) > 300 then
    raise exception 'Indiquez le motif (3 à 300 caractères).';
  end if;
  update public.abonnements
  set annule_le = now(), motif_annulation = v_motif
  where id = p_abonnement and annule_le is null
  returning profil_id, debut, fin into v_profil, v_debut, v_fin;
  if v_profil is null then
    raise exception 'Cet abonnement est déjà annulé.';
  end if;
  -- Les abonnements qui le suivaient avancent d'autant (0053) : pas de trou dans l'accès, et chacun garde sa durée.
  if v_fin > now() then
    update public.abonnements
    set debut = debut - (v_fin - greatest(now(), v_debut)), fin = fin - (v_fin - greatest(now(), v_debut))
    where profil_id = v_profil and annule_le is null and debut >= v_fin;
  end if;
  perform public.notifier(array[v_profil], 'service', 'Votre abonnement a été annulé', v_motif, '/abonnement');
end;
$$;

revoke execute on function public.noter_essai_code() from public, anon, authenticated;

commit;
