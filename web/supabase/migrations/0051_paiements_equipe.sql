-- Migration 0051 : le back-office des abonnements et des paiements (lot 2, spec du 1er novembre 2026, §6). L'équipe
-- (equipe_contenus) lit les formules, les codes promo et les paiements ; seuls les administrateurs (equipe_paiements,
-- 0049) touchent à l'argent : prix, codes promo, annulation d'un abonnement (remboursement fait depuis Payiz). Rejouable.

begin;

create or replace function public.exiger_equipe_paiements()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  if not public.equipe_paiements() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;
end;
$$;

-- ─── Les formules : prix, recommandée, proposée ─────────────────────────────────────────────────────
create or replace function public.regler_formule(p_formule uuid, p_prix integer, p_recommandee boolean, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_equipe_paiements();
  if p_prix is not null and p_prix < 1000 then
    raise exception 'Le prix doit être d’au moins 1 000 FCFA.';
  end if;
  if not exists (select 1 from public.formules where id = p_formule) then
    raise exception 'Abonnement inconnu.';
  end if;
  -- Une seule formule recommandée.
  if coalesce(p_recommandee, false) then
    update public.formules set recommandee = false where id <> p_formule and recommandee;
  end if;
  update public.formules
  set prix_fcfa = p_prix, recommandee = coalesce(p_recommandee, false), active = coalesce(p_active, true)
  where id = p_formule;
end;
$$;

-- ─── Les codes promo ────────────────────────────────────────────────────────────────────────────────
create or replace function public.codes_promo_equipe()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_equipe_moderation();
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
      'utilisations', (select count(*)::integer from public.paiements p where p.code_promo_id = c.id and p.statut = 'reussi')
    ) order by c.cree_le desc, c.code)
    from public.codes_promo c
  ), '[]'::jsonb);
end;
$$;

-- Crée (p_id nul) ou modifie un code ; le code est rangé en majuscules.
create or replace function public.enregistrer_code_promo(
  p_id uuid, p_code text, p_type text, p_valeur integer, p_debut timestamptz, p_fin timestamptz, p_limite integer, p_actif boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_id uuid;
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
  return v_id;
end;
$$;

-- ─── Les paiements ──────────────────────────────────────────────────────────────────────────────────
-- Filtre : vide (tous), reussi, en_attente, echoue, expire (avec les annulés). Recherche : nom, adresse, numéro de reçu.
-- 20 par page. Les paiements jamais envoyés à Payiz (préparation abandonnée) n'y figurent pas.
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
    select p.id, p.cree_le, p.montant, p.statut, p.operateur, p.telephone_masque, p.numero_recu, p.profil_id,
           coalesce(pr.prenom, '') as prenom, coalesce(pr.nom, '') as nom, coalesce(u.email, '') as email,
           f.code as formule_code, f.nom as formule_nom, f.duree_mois
    from public.paiements p
    join public.formules f on f.id = p.formule_id
    left join public.profils pr on pr.id = p.profil_id
    left join auth.users u on u.id = p.profil_id
    where not (p.payiz_id is null and p.montant > 0)
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
        'numero_recu', g.numero_recu
      ) order by g.cree_le desc, g.id)
      from page g
    ), '[]'::jsonb)
  ) into v_resultat;
  return v_resultat;
end;
$$;

-- Le détail d'un paiement : sa carte, le compte, et l'abonnement qu'il a ouvert.
create or replace function public.paiement_equipe(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.paiements%rowtype;
begin
  perform public.exiger_equipe_moderation();
  select * into v from public.paiements where id = p_id;
  if not found then
    return null;
  end if;
  return public.carte_paiement(v) || jsonb_build_object(
    'compte', (
      select jsonb_build_object('id', pr.id, 'prenom', pr.prenom, 'nom', pr.nom, 'email', coalesce(u.email, ''))
      from public.profils pr left join auth.users u on u.id = pr.id
      where pr.id = v.profil_id
    ),
    'abonnement', (
      select jsonb_build_object('id', a.id, 'debut', a.debut, 'fin', a.fin, 'annule_le', a.annule_le, 'motif_annulation', a.motif_annulation)
      from public.abonnements a where a.paiement_id = v.id
    )
  );
end;
$$;

-- Un remboursement exceptionnel se fait depuis Payiz ; l'équipe annule alors l'abonnement ici (choix 4 de la spec).
create or replace function public.annuler_abonnement(p_abonnement uuid, p_motif text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motif text := btrim(coalesce(p_motif, ''));
  v_profil uuid;
begin
  perform public.exiger_equipe_paiements();
  if char_length(v_motif) < 3 or char_length(v_motif) > 300 then
    raise exception 'Indiquez le motif (3 à 300 caractères).';
  end if;
  update public.abonnements
  set annule_le = now(), motif_annulation = v_motif
  where id = p_abonnement and annule_le is null
  returning profil_id into v_profil;
  if v_profil is null then
    raise exception 'Cet abonnement est déjà annulé.';
  end if;
  perform public.notifier(array[v_profil], 'service', 'Votre abonnement a été annulé', v_motif, '/abonnement');
end;
$$;

-- Les chiffres en tête de la page : le mois en cours, à l'heure du Bénin.
create or replace function public.resume_paiements()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_mois timestamptz := date_trunc('month', now() at time zone 'Africa/Porto-Novo') at time zone 'Africa/Porto-Novo';
begin
  perform public.exiger_equipe_moderation();
  return jsonb_build_object(
    'revenus_mois', coalesce((select sum(p.montant) from public.paiements p where p.statut = 'reussi' and p.confirme_le >= v_mois), 0),
    'reussis_mois', (select count(*) from public.paiements p where p.statut = 'reussi' and p.confirme_le >= v_mois),
    'echoues_mois', (select count(*) from public.paiements p where p.statut = 'echoue' and p.cree_le >= v_mois),
    'abonnes_actifs', (
      select count(distinct a.profil_id) from public.abonnements a
      where a.annule_le is null and a.debut <= now() and now() < a.fin
    )
  );
end;
$$;

-- ─── Droits ─────────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public.exiger_equipe_paiements() from public, anon, authenticated;
revoke execute on function public.regler_formule(uuid, integer, boolean, boolean) from public, anon, authenticated;
revoke execute on function public.codes_promo_equipe() from public, anon, authenticated;
revoke execute on function public.enregistrer_code_promo(uuid, text, text, integer, timestamptz, timestamptz, integer, boolean) from public, anon, authenticated;
revoke execute on function public.paiements_equipe(text, text, integer) from public, anon, authenticated;
revoke execute on function public.paiement_equipe(uuid) from public, anon, authenticated;
revoke execute on function public.annuler_abonnement(uuid, text) from public, anon, authenticated;
revoke execute on function public.resume_paiements() from public, anon, authenticated;

grant execute on function public.regler_formule(uuid, integer, boolean, boolean) to authenticated;
grant execute on function public.codes_promo_equipe() to authenticated;
grant execute on function public.enregistrer_code_promo(uuid, text, text, integer, timestamptz, timestamptz, integer, boolean) to authenticated;
grant execute on function public.paiements_equipe(text, text, integer) to authenticated;
grant execute on function public.paiement_equipe(uuid) to authenticated;
grant execute on function public.annuler_abonnement(uuid, text) to authenticated;
grant execute on function public.resume_paiements() to authenticated;

commit;
