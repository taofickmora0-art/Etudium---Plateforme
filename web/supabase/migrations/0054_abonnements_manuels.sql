-- Migration 0054 : les abonnements attribués à la main au back-office (demande du 1er novembre 2026). Un paiement reçu
-- hors plateforme (Mobile Money sur le numéro de l'équipe, espèces, virement) ou un abonnement offert : l'administrateur
-- l'enregistre, l'accès s'ouvre aussitôt (à la suite de l'abonnement en cours), avec un reçu et une notification. Il peut
-- aussi résilier : tout l'accès s'arrête. Réservé aux administrateurs ; l'équipe voit. Rejouable.

begin;

-- ─── L'origine d'un paiement ────────────────────────────────────────────────────────────────────────
alter table public.paiements add column if not exists source text not null default 'payiz';
alter table public.paiements add column if not exists moyen_manuel text;
alter table public.paiements add column if not exists reference_manuelle text;
alter table public.paiements add column if not exists attribue_par uuid references public.profils (id) on delete set null;
alter table public.paiements drop constraint if exists paiements_source_valide;
alter table public.paiements add constraint paiements_source_valide check (
  source in ('payiz', 'manuel')
  and (moyen_manuel is null or moyen_manuel in ('mobile_money', 'especes', 'virement', 'offert'))
  and (source = 'manuel' or moyen_manuel is null)
);
-- Le minimum de Payiz (1 000 FCFA) ne vaut pas pour un montant reçu hors plateforme.
alter table public.paiements drop constraint if exists paiements_montant_check;
alter table public.paiements drop constraint if exists paiements_montant_valide;
alter table public.paiements add constraint paiements_montant_valide check (montant >= 0 and (source = 'manuel' or montant = 0 or montant >= 1000));

-- La carte d'un paiement, avec son origine (dernière définition : 0049_abonnements_paiements.sql).
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
    'source', p.source,
    'moyen_manuel', p.moyen_manuel,
    'reference_manuelle', p.reference_manuelle,
    'cree_le', p.cree_le,
    'essai_le', p.essai_le,
    'confirme_le', p.confirme_le,
    'abonnement', (select jsonb_build_object('debut', a.debut, 'fin', a.fin) from public.abonnements a where a.paiement_id = p.id)
  );
$$;

-- L'historique de l'étudiant : un paiement manuel y figure (dernière définition : 0049_abonnements_paiements.sql).
create or replace function public.mes_paiements()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(public.carte_paiement(p) order by p.cree_le desc, p.id), '[]'::jsonb)
  from public.paiements p
  where p.profil_id = (select auth.uid()) and not (p.source = 'payiz' and p.payiz_id is null and p.montant > 0);
$$;

-- Le reçu, avec le moyen et la référence d'un paiement manuel (dernière définition : 0049_abonnements_paiements.sql).
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

-- La liste du back-office, avec l'origine (dernière définition : 0051_paiements_equipe.sql).
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
  perform public.exiger_equipe_moderation();
  with lignes as (
    select p.id, p.cree_le, p.montant, p.statut, p.operateur, p.telephone_masque, p.numero_recu, p.profil_id, p.source, p.moyen_manuel,
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

-- L'état d'un compte (la logique de mon_abonnement, 0049_abonnements_paiements.sql), pour le compte connecté comme pour la fiche du back-office.
create or replace function public.etat_abonnement(p_profil uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := p_profil;
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

create or replace function public.mon_abonnement()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when (select auth.uid()) is null then jsonb_build_object('etat', 'gratuit') else public.etat_abonnement((select auth.uid())) end;
$$;

-- ─── Attribuer ──────────────────────────────────────────────────────────────────────────────────────
create or replace function public.attribuer_abonnement(p_compte uuid, p_formule uuid, p_moyen text, p_montant integer, p_reference text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_formule public.formules%rowtype;
  v_reference text := nullif(btrim(coalesce(p_reference, '')), '');
  v_montant integer;
  v_prix integer;
  v public.paiements%rowtype;
begin
  perform public.exiger_equipe_paiements();
  if not exists (select 1 from public.profils where id = p_compte) then
    raise exception 'Compte inconnu.';
  end if;
  if exists (select 1 from public.roles r where r.profil_id = p_compte and r.role = 'formateur') then
    raise exception 'Un compte formateur n’a pas d’abonnement.';
  end if;
  select * into v_formule from public.formules where id = p_formule;
  if not found then
    raise exception 'Abonnement inconnu.';
  end if;
  if p_moyen is null or p_moyen not in ('mobile_money', 'especes', 'virement', 'offert') then
    raise exception 'Choisissez le moyen de paiement.';
  end if;
  if p_moyen = 'offert' then
    v_montant := 0;
  elsif p_montant is null or p_montant < 0 then
    raise exception 'Indiquez le montant reçu.';
  else
    v_montant := p_montant;
  end if;
  if char_length(coalesce(v_reference, '')) > 120 then
    raise exception 'La référence compte 120 caractères au plus.';
  end if;
  v_prix := coalesce(v_formule.prix_fcfa, v_montant);

  insert into public.paiements (profil_id, formule_id, prix_initial, remise, montant, source, moyen_manuel, reference_manuelle, attribue_par)
  values (p_compte, p_formule, v_prix, greatest(v_prix - v_montant, 0), v_montant, 'manuel', p_moyen, v_reference, (select auth.uid()))
  returning * into v;
  -- Le numéro de reçu et l'abonnement, à la suite de celui en cours (comme un paiement en ligne).
  perform public.activer_paiement(v.id);
  select * into v from public.paiements where id = v.id;

  perform public.notifier(
    array[p_compte], 'service', 'Votre abonnement ' || v_formule.nom || ' est actif',
    'Jusqu’au ' || public.date_longue(public.fin_abonnement(p_compte)) || '.', '/abonnement'
  );
  return public.carte_paiement(v);
end;
$$;

-- ─── Résilier : tout l'accès s'arrête (l'abonnement en cours et ceux qui suivent) ───────────────────
create or replace function public.resilier_abonnements(p_compte uuid, p_motif text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motif text := btrim(coalesce(p_motif, ''));
  v_nombre integer;
begin
  perform public.exiger_equipe_paiements();
  if char_length(v_motif) < 3 or char_length(v_motif) > 300 then
    raise exception 'Indiquez le motif (3 à 300 caractères).';
  end if;
  update public.abonnements
  set annule_le = now(), motif_annulation = v_motif
  where profil_id = p_compte and annule_le is null and fin > now();
  get diagnostics v_nombre = row_count;
  if v_nombre = 0 then
    raise exception 'Ce compte n’a pas d’abonnement en cours.';
  end if;
  perform public.notifier(array[p_compte], 'service', 'Votre abonnement a été résilié', v_motif, '/abonnement');
  return v_nombre;
end;
$$;

-- ─── La fiche d'un compte au back-office : son état et ses abonnements ──────────────────────────────
create or replace function public.abonnements_compte(p_compte uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_equipe_moderation();
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

revoke execute on function public.etat_abonnement(uuid) from public, anon, authenticated;
revoke execute on function public.attribuer_abonnement(uuid, uuid, text, integer, text) from public, anon, authenticated;
revoke execute on function public.resilier_abonnements(uuid, text) from public, anon, authenticated;
revoke execute on function public.abonnements_compte(uuid) from public, anon, authenticated;
grant execute on function public.attribuer_abonnement(uuid, uuid, text, integer, text) to authenticated;
grant execute on function public.resilier_abonnements(uuid, text) to authenticated;
grant execute on function public.abonnements_compte(uuid) to authenticated;

commit;
