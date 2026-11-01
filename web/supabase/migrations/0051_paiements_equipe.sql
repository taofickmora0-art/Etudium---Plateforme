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

-- ─── Le tableau de bord : les tuiles du lot 2 (dernière définition : 0031_quiz.sql) ─────────────────────────
create or replace function public.statistiques_back_office(p_maintenant timestamptz default now())
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_mois timestamptz := date_trunc('month', p_maintenant);
  -- Le mois en cours au Bénin, pour l'argent (lot 2).
  v_mois_local timestamp := date_trunc('month', p_maintenant at time zone 'Africa/Porto-Novo');
  v_resultat jsonb;
begin
  if not public.equipe_contenus() then
    raise exception 'Les statistiques sont réservées à l’équipe.' using errcode = '42501';
  end if;

  with
    -- Une ligne par étudiant et par formation commencée : sa part de leçons terminées.
    suivis as (
      select p.profil_id, m.formation_id, count(p.terminee_le) as terminees
      from public.progression_lecons p
      join public.lecons l on l.id = p.lecon_id
      join public.modules m on m.id = l.module_id
      where l.publiee and l.type = 'lecon'
      group by p.profil_id, m.formation_id
    ),
    totaux as (
      select m.formation_id, count(*) as lecons
      from public.lecons l
      join public.modules m on m.id = l.module_id
      where l.publiee and l.type = 'lecon'
      group by m.formation_id
    ),
    top as (
      select f.titre, f.slug, count(*)::integer as etudiants
      from suivis s
      join public.formations f on f.id = s.formation_id
      where f.statut = 'publiee'
      group by f.id, f.titre, f.slug
      order by count(*) desc, f.titre
      limit 5
    )
  select jsonb_build_object(
    'utilisateurs', (select count(*) from public.profils),
    'inscrits_semaine', (select count(*) from public.profils where cree_le > p_maintenant - interval '7 days' and cree_le <= p_maintenant),
    'inscrits_mois', (select count(*) from public.profils where cree_le >= v_mois and cree_le <= p_maintenant),
    'inscrits_mois_precedent', (select count(*) from public.profils where cree_le >= v_mois - interval '1 month' and cree_le < v_mois),
    'progression_moyenne', (
      select round(avg(100.0 * s.terminees / t.lecons))::integer
      from suivis s
      join totaux t on t.formation_id = s.formation_id
      where t.lecons > 0
    ),
    'formations_suivies', coalesce((select jsonb_agg(jsonb_build_object('titre', titre, 'slug', slug, 'etudiants', etudiants) order by etudiants desc, titre) from top), '[]'::jsonb),
    -- Lot 2 : abonnés, conversion, chiffre d'affaires (paiements réussis), revenus par formule.
    'abonnes_actifs', (
      select count(distinct a.profil_id) from public.abonnements a
      where a.annule_le is null and a.debut <= p_maintenant and p_maintenant < a.fin
    ),
    'etudiants', (
      select count(*) from public.profils pr
      where not exists (
        select 1 from public.roles r where r.profil_id = pr.id and r.role in ('formateur', 'moderateur', 'admin', 'super_admin')
      )
    ),
    'ca_mois', coalesce((
      select sum(p.montant) from public.paiements p
      where p.statut = 'reussi' and p.confirme_le at time zone 'Africa/Porto-Novo' >= v_mois_local and p.confirme_le <= p_maintenant
    ), 0),
    'ca_total', coalesce((select sum(p.montant) from public.paiements p where p.statut = 'reussi' and p.confirme_le <= p_maintenant), 0),
    'ca_par_mois', (
      select jsonb_agg(jsonb_build_object(
        'mois', to_char(m, 'YYYY-MM'),
        'montant', coalesce((
          select sum(p.montant) from public.paiements p
          where p.statut = 'reussi'
            and p.confirme_le at time zone 'Africa/Porto-Novo' >= m
            and p.confirme_le at time zone 'Africa/Porto-Novo' < m + interval '1 month'
        ), 0)
      ) order by m)
      from generate_series(v_mois_local - interval '5 months', v_mois_local, interval '1 month') as m
    ),
    'revenus_par_formule', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', f.code,
        'nom', f.nom,
        'montant', coalesce((select sum(p.montant) from public.paiements p where p.formule_id = f.id and p.statut = 'reussi'), 0),
        'nombre', (select count(*) from public.paiements p where p.formule_id = f.id and p.statut = 'reussi')
      ) order by f.ordre)
      from public.formules f
    ), '[]'::jsonb)
  )
  into v_resultat;

  return v_resultat;
end;
$$;

-- ─── La liste des comptes : la formule de chacun (dernière définition : 0013_utilisateurs.sql) ────────────────────
create or replace function public.comptes_equipe(p_recherche text default '', p_filtre text default 'tous', p_page integer default 1)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := public.sans_accents(btrim(coalesce(p_recherche, '')));
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_resultat jsonb;
begin
  if not public.equipe_contenus() then
    raise exception 'Accès réservé à l’équipe.' using errcode = '42501';
  end if;

  with comptes as (
    select
      p.id, p.prenom, p.nom, coalesce(u.email, '') as email, p.cree_le, u.last_sign_in_at,
      coalesce((select array_agg(r.role order by r.role) from public.roles r where r.profil_id = p.id), '{}') as roles,
      exists (select 1 from public.suspensions s where s.profil_id = p.id) as suspendu
    from public.profils p
    left join auth.users u on u.id = p.id
  ),
  retenus as (
    select * from comptes c
    where (v_q = '' or strpos(public.sans_accents(c.prenom || ' ' || c.nom), v_q) > 0 or strpos(lower(c.email), v_q) > 0)
      and case p_filtre
        when 'etudiants' then not (c.roles && array['formateur', 'moderateur', 'admin', 'super_admin']::public.role_etudium[])
        when 'formateurs' then 'formateur' = any (c.roles)
        when 'equipe' then c.roles && array['moderateur', 'admin', 'super_admin']::public.role_etudium[]
        when 'suspendus' then c.suspendu
        else true
      end
  ),
  page as (
    select * from retenus order by cree_le desc, id limit 25 offset (v_page - 1) * 25
  )
  select jsonb_build_object(
    'total', (select count(*) from retenus),
    'comptes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'prenom', g.prenom,
        'nom', g.nom,
        'email', g.email,
        'roles', to_jsonb(g.roles::text[]),
        'inscrit_le', g.cree_le,
        'derniere_connexion', g.last_sign_in_at,
        'suspendu', g.suspendu,
        -- Le nom de l'abonnement en cours (lot 2) ; null sans abonnement.
        'formule', (
          select f.nom from public.abonnements a join public.formules f on f.id = a.formule_id
          where a.profil_id = g.id and a.annule_le is null and a.debut <= now() and now() < a.fin
          order by a.debut desc limit 1
        )
      ) order by g.cree_le desc, g.id)
      from page g
    ), '[]'::jsonb)
  ) into v_resultat;
  return v_resultat;
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
