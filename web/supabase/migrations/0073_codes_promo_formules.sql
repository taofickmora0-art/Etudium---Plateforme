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

-- ─── Droits ─────────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public.remise_code(text, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.codes_promo_equipe() from public, anon, authenticated;
revoke execute on function public.enregistrer_code_promo(uuid, text, text, integer, timestamptz, timestamptz, integer, boolean, uuid[]) from public, anon, authenticated;

grant execute on function public.codes_promo_equipe() to authenticated;
grant execute on function public.enregistrer_code_promo(uuid, text, text, integer, timestamptz, timestamptz, integer, boolean, uuid[]) to authenticated;

commit;
