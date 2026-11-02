-- Migration 0072 : le paiement ouvert à tous les pays et à tous les opérateurs de Payiz (demande du 2 novembre 2026 :
-- Payiz accepte Celtiis, permet de choisir un pays, et les payeurs ne sont pas tous béninois).
--   - L'opérateur d'un paiement n'est plus limité à MTN et Moov (contrainte de la 0049) : tout code d'opérateur de Payiz
--     (« celtiis », « orange_money »…), en minuscules, chiffres, « _ » et « - », 40 caractères au plus.
--   - Chaque paiement garde le pays du payeur (ISO 3166 alpha-3, « BEN ») et le nom de l'opérateur au moment du paiement
--     (« Celtiis Cash »), pour le reçu, l'historique et le back-office. Les paiements déjà passés par Payiz l'ont tous été
--     depuis le Bénin (seuls les numéros en +229 étaient acceptés) : leur pays devient « BEN ». Leur nom reste vide :
--     l'appli le déduit du code (« MTN Mobile Money », « Moov Money »).
--   - noter_essai reçoit le pays et le nom (deux paramètres facultatifs : l'appli d'avant cette version l'appelle encore
--     avec ses 5 paramètres).
--   - La carte d'un paiement, le reçu, la liste du back-office et la fiche d'un compte les renvoient.
-- Les paiements existants sont gardés. À appliquer après la 0071. Rejouable.

begin;

-- ─── Les colonnes et leurs contraintes ──────────────────────────────────────────────────────────────
alter table public.paiements add column if not exists pays text;
alter table public.paiements add column if not exists operateur_nom text;

-- « operateur in ('mtn', 'moov') » (0049, contrainte sans nom : paiements_operateur_check).
alter table public.paiements drop constraint if exists paiements_operateur_check;
alter table public.paiements drop constraint if exists paiements_operateur_valide;
alter table public.paiements add constraint paiements_operateur_valide check (operateur is null or operateur ~ '^[a-z0-9_-]{1,40}$');
alter table public.paiements drop constraint if exists paiements_pays_valide;
alter table public.paiements add constraint paiements_pays_valide check (pays is null or pays ~ '^[A-Z]{3}$');
alter table public.paiements drop constraint if exists paiements_operateur_nom_valide;
alter table public.paiements add constraint paiements_operateur_nom_valide check (operateur_nom is null or char_length(operateur_nom) between 1 and 60);

update public.paiements set pays = 'BEN'
where pays is null and source = 'payiz' and telephone_masque like '+229 %';

-- ─── Noter un essai, avec le pays et le nom de l'opérateur ──────────────────────────────────────────
-- Dernière définition : 0049_abonnements_paiements.sql. Un code d'opérateur illisible ne remplace rien ; un nouvel
-- opérateur remplace aussi le nom (vide s'il n'est pas donné) ; un pays illisible ne remplace rien.
drop function if exists public.noter_essai(uuid, text, text, text, text);
create or replace function public.noter_essai(
  p_paiement uuid, p_payiz text, p_operateur text, p_telephone_masque text, p_jeton text,
  p_pays text default null, p_operateur_nom text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.paiements%rowtype;
  v_operateur text := case when p_operateur ~ '^[a-z0-9_-]{1,40}$' then p_operateur end;
  v_nom text := nullif(left(btrim(coalesce(p_operateur_nom, '')), 60), '');
  v_pays text := case when upper(btrim(coalesce(p_pays, ''))) ~ '^[A-Z]{3}$' then upper(btrim(p_pays)) end;
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
      operateur = coalesce(v_operateur, operateur),
      operateur_nom = case when v_operateur is not null then v_nom else operateur_nom end,
      pays = coalesce(v_pays, pays),
      telephone_masque = coalesce(nullif(p_telephone_masque, ''), telephone_masque),
      statut = 'en_attente',
      motif_echec = null,
      essai_le = now()
  where id = p_paiement
  returning * into v;
  return public.carte_paiement(v);
end;
$$;

revoke execute on function public.noter_essai(uuid, text, text, text, text, text, text) from public, anon, authenticated;
-- Appelée par le serveur, avec ou sans session : le jeton la garde (comme en 0049).
grant execute on function public.noter_essai(uuid, text, text, text, text, text, text) to anon, authenticated;

-- ─── La carte d'un paiement (dernière définition : 0054_abonnements_manuels.sql) ─────────────────────
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
    'operateur_nom', p.operateur_nom,
    'pays', p.pays,
    'telephone_masque', p.telephone_masque,
    'motif_echec', p.motif_echec,
    'numero_recu', p.numero_recu,
    'payiz_id', p.payiz_id,
    'source', p.source,
    'moyen_manuel', p.moyen_manuel,
    'reference_manuelle', p.reference_manuelle,
    'cree_le', p.cree_le,
    'essai_le', p.essai_le,
    'confirme_le', p.confirme_le,
    'abonnement', (select jsonb_build_object('debut', a.debut, 'fin', a.fin) from public.abonnements a where a.paiement_id = p.id)
  );
$$;

-- ─── Le reçu (dernière définition : 0054_abonnements_manuels.sql) ────────────────────────────────────
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
    'operateur_nom', p.operateur_nom,
    'pays', p.pays,
    'telephone_masque', p.telephone_masque,
    'moyen_manuel', p.moyen_manuel,
    'reference_manuelle', p.reference_manuelle
  )
  from public.paiements p
  join public.formules f on f.id = p.formule_id
  left join public.profils pr on pr.id = p.profil_id
  left join public.abonnements a on a.paiement_id = p.id
  left join public.codes_promo c on c.id = p.code_promo_id
  where p.numero_recu = p_numero and p.statut = 'reussi'
    and (p.profil_id = (select auth.uid()) or public.equipe_contenus());
$$;

-- ─── La liste du back-office (dernière définition : 0060_domaines_equipe.sql) ────────────────────────
create or replace function public.paiements_equipe(p_statut text, p_recherche text, p_page integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := lower(btrim(coalesce(p_recherche, '')));
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_resultat jsonb;
begin
  perform public.exiger_equipe_admin();
  with lignes as (
    select p.id, p.cree_le, p.montant, p.statut, p.operateur, p.operateur_nom, p.pays, p.telephone_masque, p.numero_recu, p.profil_id,
           p.source, p.moyen_manuel,
           coalesce(pr.prenom, '') as prenom, coalesce(pr.nom, '') as nom, coalesce(u.email, '') as email,
           f.code as formule_code, f.nom as formule_nom, f.duree_mois
    from public.paiements p
    join public.formules f on f.id = p.formule_id
    left join public.profils pr on pr.id = p.profil_id
    left join auth.users u on u.id = p.profil_id
    where not (p.source = 'payiz' and p.payiz_id is null and p.montant > 0)
      and case
        when coalesce(p_statut, '') = '' then true
        when p_statut = 'expire' then p.statut in ('expire', 'annule')
        else p.statut = p_statut
      end
      and (
        v_q = ''
        or strpos(lower(coalesce(p.numero_recu, '')), v_q) > 0
        or strpos(lower(coalesce(u.email, '')), v_q) > 0
        or strpos(public.sans_accents(coalesce(pr.prenom, '') || ' ' || coalesce(pr.nom, '')), public.sans_accents(v_q)) > 0
      )
  ),
  page as (
    select * from lignes order by cree_le desc, id limit 20 offset (v_page - 1) * 20
  )
  select jsonb_build_object(
    'total', (select count(*) from lignes),
    'lignes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'cree_le', g.cree_le,
        'compte', jsonb_build_object('id', g.profil_id, 'prenom', g.prenom, 'nom', g.nom, 'email', g.email),
        'formule', jsonb_build_object('code', g.formule_code, 'nom', g.formule_nom, 'duree_mois', g.duree_mois),
        'montant', g.montant,
        'statut', g.statut,
        'operateur', g.operateur,
        'operateur_nom', g.operateur_nom,
        'pays', g.pays,
        'telephone_masque', g.telephone_masque,
        'numero_recu', g.numero_recu,
        'source', g.source,
        'moyen_manuel', g.moyen_manuel
      ) order by g.cree_le desc, g.id)
      from page g
    ), '[]'::jsonb)
  ) into v_resultat;
  return v_resultat;
end;
$$;

-- ─── La fiche d'un compte au back-office (dernière définition : 0060_domaines_equipe.sql) ────────────
create or replace function public.abonnements_compte(p_compte uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_equipe_admin();
  return jsonb_build_object(
    'etat', public.etat_abonnement(p_compte),
    'abonnements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'formule', jsonb_build_object('code', f.code, 'nom', f.nom, 'duree_mois', f.duree_mois),
        'debut', a.debut,
        'fin', a.fin,
        'annule_le', a.annule_le,
        'motif_annulation', a.motif_annulation,
        'paiement_id', p.id,
        'source', p.source,
        'moyen_manuel', p.moyen_manuel,
        'operateur', p.operateur,
        'operateur_nom', p.operateur_nom,
        'pays', p.pays,
        'montant', p.montant,
        'numero_recu', p.numero_recu
      ) order by a.debut desc)
      from public.abonnements a
      join public.formules f on f.id = a.formule_id
      join public.paiements p on p.id = a.paiement_id
      where a.profil_id = p_compte
    ), '[]'::jsonb)
  );
end;
$$;

commit;
