-- Migration 0073 : un code promo valable seulement pour les abonnements choisis (demande du 3 novembre 2026 : « je
-- choisis les abonnements qui seront concernés par ce code promo, en plus des limites et tout ce qu'il y a déjà »).
--   - Une table de liaison codes_promo_formules (un code, un abonnement), comme formations_parcours : une clé étrangère
--     de chaque côté, en cascade, que ne permettrait pas une colonne tableau sur codes_promo.
--   - Les codes d'avant valent pour les trois abonnements : leur comportement ne change pas.
--   - La règle des codes (remise_code : « Appliquer » et la préparation du paiement) refuse un abonnement non coché :
--     « Ce code ne s’applique pas à l’abonnement Standard. », avec le motif « abonnement » (l'écran revérifie le code
--     quand l'étudiant change d'abonnement).
--   - enregistrer_code_promo reçoit la liste des abonnements et refuse une liste vide. Appelée sans elle (l'appli d'avant
--     cette version, avec ses 8 paramètres), elle garde les abonnements du code, ou les donne tous à un nouveau code.
--   - codes_promo_equipe renvoie les abonnements de chaque code.
-- Deuxième partie (même jour : « quand quelqu'un fait un abonnement, peu importe le type, je dois recevoir une
-- notification dans l'espace admin et aussi un mail ») : chaque abonnement pris par un étudiant (payé, ou offert par un
-- code) prévient l'équipe des paiements, une seule fois, par une notification (cloche, push) et un e-mail détaillé
-- (lignes de détail : nouvelle colonne envois.details, renvoyée par prendre_envois).
-- À appliquer après la 0072. Rejouable.

begin;

-- ─── Les abonnements d'un code ──────────────────────────────────────────────────────────────────────
create table if not exists public.codes_promo_formules (
  code_id uuid not null references public.codes_promo (id) on delete cascade,
  formule_id uuid not null references public.formules (id) on delete cascade,
  primary key (code_id, formule_id)
);
create index if not exists codes_promo_formules_formule_idx on public.codes_promo_formules (formule_id);
alter table public.codes_promo_formules enable row level security;

-- Comme codes_promo (0049) : l'équipe lit ; personne n'écrit directement (enregistrer_code_promo s'en charge).
drop policy if exists "abonnements des codes lus par l'équipe" on public.codes_promo_formules;
create policy "abonnements des codes lus par l'équipe" on public.codes_promo_formules
  for select to authenticated using ((select public.equipe_contenus()));
revoke insert, update, delete on public.codes_promo_formules from anon, authenticated;

-- Les codes d'avant : tous les abonnements. Depuis cette migration, un code a toujours au moins un abonnement
-- (enregistrer_code_promo l'exige) : la relancer ne touche donc pas aux codes restreints depuis.
insert into public.codes_promo_formules (code_id, formule_id)
select c.id, f.id
from public.codes_promo c
cross join public.formules f
where not exists (select 1 from public.codes_promo_formules cf where cf.code_id = c.id)
on conflict do nothing;

-- ─── La règle des codes promo (dernière définition : 0049_abonnements_paiements.sql) ─────────────────
-- Partagée par « Appliquer » (essayer_code) et la préparation du paiement (preparer_paiement), qui l'appellent telle
-- quelle. Le refus pour un abonnement porte le motif « abonnement » : un autre abonnement peut convenir.
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
  -- Les abonnements choisis par l'équipe (0073).
  if not exists (select 1 from public.codes_promo_formules cf where cf.code_id = v_code.id and cf.formule_id = p_formule) then
    return jsonb_build_object('ok', false, 'motif', 'abonnement', 'message', format('Ce code ne s’applique pas à l’abonnement %s.', v_formule.nom));
  end if;

  v_remise := case when v_code.type = 'pourcentage' then floor(v_prix * v_code.valeur / 100.0)::integer else least(v_code.valeur, v_prix) end;
  v_montant := v_prix - v_remise;
  -- Payiz n'accepte pas moins de 1 000 FCFA ; 0 (100 %) est un abonnement offert.
  if v_montant between 1 and 999 then
    return jsonb_build_object('ok', false, 'motif', 'abonnement', 'message', 'Ce code ne s’applique pas à cet abonnement.');
  end if;
  return jsonb_build_object('ok', true, 'code_id', v_code.id, 'prix_initial', v_prix, 'remise', v_remise, 'montant', v_montant);
end;
$$;

-- ─── La lecture du back-office (dernière définition : 0060_domaines_equipe.sql) ─────────────────────
create or replace function public.codes_promo_equipe()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_equipe_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id,
      'code', c.code,
      'type', c.type,
      'valeur', c.valeur,
      'debut', c.debut,
      'fin', c.fin,
      'limite', c.limite,
      'actif', c.actif,
      'cree_le', c.cree_le,
      -- Seuls les paiements réussis consomment un code.
      'utilisations', (select count(*)::integer from public.paiements p where p.code_promo_id = c.id and p.statut = 'reussi'),
      -- Les abonnements où il vaut, dans leur ordre (0073).
      'formules', coalesce((
        select jsonb_agg(jsonb_build_object('id', f.id, 'code', f.code, 'nom', f.nom, 'duree_mois', f.duree_mois) order by f.ordre, f.nom)
        from public.codes_promo_formules cf
        join public.formules f on f.id = cf.formule_id
        where cf.code_id = c.id
      ), '[]'::jsonb)
    ) order by c.cree_le desc, c.code)
    from public.codes_promo c
  ), '[]'::jsonb);
end;
$$;

-- ─── Enregistrer un code (dernière définition : 0051_paiements_equipe.sql) ──────────────────────────
-- Crée (p_id nul) ou modifie un code ; le code est rangé en majuscules. p_formules : les abonnements où il vaut, au
-- moins un. Sans la liste (l'appli d'avant cette version), un nouveau code vaut pour tous les abonnements, comme avant,
-- et une modification garde ceux du code.
drop function if exists public.enregistrer_code_promo(uuid, text, text, integer, timestamptz, timestamptz, integer, boolean);
create or replace function public.enregistrer_code_promo(
  p_id uuid, p_code text, p_type text, p_valeur integer, p_debut timestamptz, p_fin timestamptz, p_limite integer, p_actif boolean,
  p_formules uuid[] default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_id uuid;
  v_formules uuid[];
begin
  perform public.exiger_equipe_paiements();
  if v_code !~ '^[A-Z0-9_-]{3,30}$' then
    raise exception 'Le code compte 3 à 30 lettres, chiffres, tirets ou soulignés.';
  end if;
  if p_type is null or p_type not in ('pourcentage', 'montant') then
    raise exception 'Choisissez le type de remise.';
  end if;
  if p_type = 'pourcentage' and (p_valeur is null or p_valeur < 1 or p_valeur > 100) then
    raise exception 'Un pourcentage va de 1 à 100.';
  end if;
  if p_type = 'montant' and (p_valeur is null or p_valeur < 1) then
    raise exception 'Le montant de la remise doit être positif.';
  end if;
  if p_debut is not null and p_fin is not null and p_fin <= p_debut then
    raise exception 'La fin doit suivre le début.';
  end if;
  if p_limite is not null and p_limite < 1 then
    raise exception 'La limite doit être d’au moins 1.';
  end if;
  if p_formules is not null then
    if (select count(x) from unnest(p_formules) x) = 0 then
      raise exception 'Choisissez au moins un abonnement.';
    end if;
    select coalesce(array_agg(f.id), '{}') into v_formules from public.formules f where f.id = any (p_formules);
    if cardinality(v_formules) <> (select count(distinct x) from unnest(p_formules) x) then
      raise exception 'Abonnement inconnu.';
    end if;
  end if;
  begin
    if p_id is null then
      insert into public.codes_promo (code, type, valeur, debut, fin, limite, actif, cree_par)
      values (v_code, p_type, p_valeur, p_debut, p_fin, p_limite, coalesce(p_actif, true), (select auth.uid()))
      returning id into v_id;
    else
      update public.codes_promo
      set code = v_code, type = p_type, valeur = p_valeur, debut = p_debut, fin = p_fin, limite = p_limite, actif = coalesce(p_actif, true)
      where id = p_id
      returning id into v_id;
      if v_id is null then
        raise exception 'Ce code n’existe plus.';
      end if;
    end if;
  exception when unique_violation then
    raise exception 'Ce code existe déjà.';
  end;

  if v_formules is not null then
    delete from public.codes_promo_formules where code_id = v_id and formule_id <> all (v_formules);
    insert into public.codes_promo_formules (code_id, formule_id)
    select v_id, u.formule_id from unnest(v_formules) as u (formule_id)
    on conflict do nothing;
  elsif p_id is null then
    insert into public.codes_promo_formules (code_id, formule_id)
    select v_id, f.id from public.formules f
    on conflict do nothing;
  end if;
  return v_id;
end;
$$;

-- ═══ Deuxième partie : chaque nouvel abonnement prévient l'équipe des paiements ═══════════════════════

-- ─── Les lignes de détail d'un e-mail ───────────────────────────────────────────────────────────────
-- [{ "libelle": "Prix", "valeur": "9 000 FCFA" }, …] : affichées en tableau sous le texte (src/lib/envois/email.ts).
alter table public.envois add column if not exists details jsonb;
alter table public.envois drop constraint if exists envois_details;
alter table public.envois add constraint envois_details check (details is null or jsonb_typeof(details) = 'array');

-- ─── Le nom d'un pays de Payiz (code alpha-3), en français ──────────────────────────────────────────
-- Les pays d'Afrique où Payiz peut proposer le paiement ; un autre code reste tel quel.
create or replace function public.nom_pays(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_code
    when 'BEN' then 'Bénin' when 'BFA' then 'Burkina Faso' when 'CIV' then 'Côte d’Ivoire' when 'GNB' then 'Guinée-Bissau'
    when 'MLI' then 'Mali' when 'NER' then 'Niger' when 'SEN' then 'Sénégal' when 'TGO' then 'Togo'
    when 'CMR' then 'Cameroun' when 'CAF' then 'Centrafrique' when 'COG' then 'Congo-Brazzaville' when 'COD' then 'Congo-Kinshasa'
    when 'GAB' then 'Gabon' when 'GNQ' then 'Guinée équatoriale' when 'TCD' then 'Tchad' when 'GIN' then 'Guinée'
    when 'GHA' then 'Ghana' when 'NGA' then 'Nigeria' when 'GMB' then 'Gambie' when 'SLE' then 'Sierra Leone' when 'LBR' then 'Liberia'
    when 'MRT' then 'Mauritanie' when 'CPV' then 'Cap-Vert' when 'KEN' then 'Kenya' when 'UGA' then 'Ouganda' when 'TZA' then 'Tanzanie'
    when 'RWA' then 'Rwanda' when 'BDI' then 'Burundi' when 'ZMB' then 'Zambie' when 'MOZ' then 'Mozambique' when 'MDG' then 'Madagascar'
    when 'MAR' then 'Maroc' when 'DZA' then 'Algérie' when 'TUN' then 'Tunisie' when 'EGY' then 'Égypte' when 'ZAF' then 'Afrique du Sud'
    else p_code
  end;
$$;

-- ─── L'alerte de l'équipe ───────────────────────────────────────────────────────────────────────────
-- Au moment unique où un paiement réussi crée son abonnement (activer_paiement : un abonnement par paiement, et un
-- webhook rejoué ne repasse pas par là). Destinataires : les comptes actifs du domaine « paiements » (admins et super
-- admins, membres_domaine de la 0060), l'auteur compris s'il en fait partie. Un abonnement attribué à la main (0054)
-- ne prévient pas : c'est l'équipe qui l'a fait. Un abonnement offert par un code à 100 % prévient, avec « offert ».
-- La notification (catégorie « service », comme « À modérer ») va dans la cloche, et en push pour qui a un appareil ;
-- l'e-mail, plus détaillé, est mis directement dans la file d'envoi (0058).
create or replace function public.prevenir_equipe_abonnement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paiement public.paiements%rowtype;
  v_formule public.formules%rowtype;
  v_equipe uuid[] := public.membres_domaine('paiements');
  v_nom text;
  v_email text;
  v_code text;
  v_duree text;
  v_moyen text;
  v_offert text;
  v_paye_le timestamptz;
  v_titre text;
  v_texte text;
  v_lien text := '/admin/utilisateurs/' || new.profil_id::text;
  v_details jsonb;
begin
  select * into v_paiement from public.paiements p where p.id = new.paiement_id;
  if not found or v_paiement.source = 'manuel' or cardinality(v_equipe) = 0 then
    return null;
  end if;
  select * into v_formule from public.formules f where f.id = new.formule_id;
  select nullif(btrim(concat_ws(' ', nullif(btrim(pr.prenom), ''), nullif(btrim(pr.nom), ''))), ''), nullif(btrim(u.email), '')
  into v_nom, v_email
  from public.profils pr
  left join auth.users u on u.id = pr.id
  where pr.id = new.profil_id;
  select c.code into v_code from public.codes_promo c where c.id = v_paiement.code_promo_id;
  v_duree := case when v_formule.duree_mois = 12 then '1 an' else v_formule.duree_mois || ' mois' end;
  v_paye_le := coalesce(v_paiement.confirme_le, now());
  if v_paiement.montant > 0 then
    v_moyen := coalesce(
      nullif(btrim(v_paiement.operateur_nom), ''),
      case v_paiement.operateur when 'mtn' then 'MTN Mobile Money' when 'moov' then 'Moov Money' when 'celtiis' then 'Celtiis Cash' end,
      initcap(nullif(btrim(replace(replace(v_paiement.operateur, '_', ' '), '-', ' ')), '')),
      'Mobile Money'
    ) || coalesce(' (' || public.nom_pays(v_paiement.pays) || ')', '');
  else
    v_offert := 'offert' || coalesce(' (code ' || v_code || ')', '');
  end if;

  v_titre := 'Nouvel abonnement : ' || coalesce(v_nom, v_email, 'un compte');
  v_texte := concat_ws(' · ',
    v_formule.nom,
    v_duree,
    coalesce(v_offert, public.montant_lisible(v_paiement.montant) || ' FCFA payés' || coalesce(' (code ' || v_code || ')', '')),
    v_moyen
  );

  select coalesce(jsonb_agg(jsonb_build_object('libelle', l.libelle, 'valeur', l.valeur) order by l.rang), '[]'::jsonb)
  into v_details
  from (values
    (1, 'Étudiant', coalesce(v_nom, '—')),
    (2, 'E-mail', v_email),
    (3, 'Abonnement', v_formule.nom || ' · ' || v_duree),
    (4, 'Période', 'Du ' || public.date_longue(new.debut) || ' au ' || public.date_longue(new.fin)),
    (5, 'Prix', public.montant_lisible(v_paiement.prix_initial) || ' FCFA'),
    (6, 'Remise', case when v_paiement.remise > 0 then '− ' || public.montant_lisible(v_paiement.remise) || ' FCFA' || coalesce(' (code ' || v_code || ')', '') end),
    (7, 'Montant payé', public.montant_lisible(v_paiement.montant) || ' FCFA'
      || case when v_paiement.montant = 0 then ' (offert' || coalesce(' par le code ' || v_code, '') || ')' else '' end),
    (8, 'Moyen de paiement', v_moyen || coalesce(' · ' || nullif(btrim(v_paiement.telephone_masque), ''), '')),
    (9, 'Reçu', v_paiement.numero_recu),
    (10, 'Payé le', public.date_longue(v_paye_le) || ' à ' || to_char(v_paye_le at time zone 'Africa/Porto-Novo', 'HH24" h "MI') || ' (heure du Bénin)')
  ) as l (rang, libelle, valeur)
  where l.valeur is not null;

  perform public.notifier(v_equipe, 'service', v_titre, v_texte, v_lien, true);
  insert into public.envois (canal, destinataire, titre, texte, lien, details)
  select 'email', p.id, left(v_titre, 200), left(v_texte, 400), v_lien, v_details
  from public.profils p
  where p.id = any (v_equipe);
  return null;
end;
$$;
drop trigger if exists abonnements_equipe_prevenue on public.abonnements;
create trigger abonnements_equipe_prevenue
  after insert on public.abonnements
  for each row when (new.paiement_id is not null)
  execute function public.prevenir_equipe_abonnement();

-- ─── Le serveur prend la file (dernière définition : 0058_push_emails.sql), avec les lignes de détail ─
create or replace function public.prendre_envois(p_jeton text, p_canaux text[], p_limite integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resultat jsonb;
  v_prise uuid := gen_random_uuid();
begin
  perform public.exiger_jeton_envois(p_jeton);
  -- Plus de 24 heures : trop tard pour prévenir.
  update public.envois set statut = 'abandonne', erreur = coalesce(erreur, 'Trop ancien'), pris_le = null
  where statut = 'a_envoyer' and cree_le < now() - interval '24 hours';
  -- Un compte sans adresse e-mail : rien à essayer.
  update public.envois e set statut = 'abandonne', erreur = 'Pas d’adresse e-mail', pris_le = null
  where e.statut = 'a_envoyer' and e.canal = 'email'
    and not exists (select 1 from auth.users u where u.id = e.destinataire and coalesce(btrim(u.email), '') <> '');

  with pris as (
    select e.id from public.envois e
    where e.statut = 'a_envoyer'
      and e.canal = any (coalesce(p_canaux, '{}'))
      and e.prochain_essai <= now()
      and (e.pris_le is null or e.pris_le < now() - interval '2 minutes')
    order by e.id
    limit greatest(1, least(coalesce(p_limite, 20), 50))
    for update skip locked
  ),
  reserves as (
    update public.envois e set pris_le = now(), prise = v_prise, essais = e.essais + 1
    from pris where e.id = pris.id
    returning e.*
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'prise', r.prise,
      'cree_le', r.cree_le,
      'canal', r.canal,
      'titre', r.titre,
      'texte', r.texte,
      'lien', r.lien,
      'details', r.details,
      'email', case when r.canal = 'email' then (select u.email from auth.users u where u.id = r.destinataire) end,
      'prenom', (select nullif(btrim(p.prenom), '') from public.profils p where p.id = r.destinataire),
      'appareils', case when r.canal = 'push' then coalesce((
        select jsonb_agg(jsonb_build_object('adresse', a.adresse, 'p256dh', a.cle_p256dh, 'auth', a.cle_auth))
        from public.appareils_push a where a.profil_id = r.destinataire
      ), '[]'::jsonb) else '[]'::jsonb end
    )
    order by r.id
  ), '[]'::jsonb) into v_resultat
  from reserves r;
  return v_resultat;
end;
$$;

-- ─── Droits ─────────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public.remise_code(text, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.codes_promo_equipe() from public, anon, authenticated;
revoke execute on function public.enregistrer_code_promo(uuid, text, text, integer, timestamptz, timestamptz, integer, boolean, uuid[]) from public, anon, authenticated;
revoke execute on function public.nom_pays(text) from public, anon, authenticated;
revoke execute on function public.prevenir_equipe_abonnement() from public, anon, authenticated;
revoke execute on function public.prendre_envois(text, text[], integer) from public;

grant execute on function public.codes_promo_equipe() to authenticated;
grant execute on function public.enregistrer_code_promo(uuid, text, text, integer, timestamptz, timestamptz, integer, boolean, uuid[]) to authenticated;
-- Le serveur prend la file avec ou sans session : le jeton fait foi (comme en 0058).
grant execute on function public.prendre_envois(text, text[], integer) to anon, authenticated;

commit;
