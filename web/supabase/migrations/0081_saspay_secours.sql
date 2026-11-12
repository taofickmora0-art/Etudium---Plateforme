-- Migration 0081 : SasPay en secours de Payiz (demande du 12 novembre 2026 : Payiz ne couvre pas plusieurs pays
-- d'Afrique). L'étudiant voit une seule liste de pays et d'opérateurs ; un opérateur que Payiz encaisse part chez Payiz,
-- les autres chez SasPay, sans que l'étudiant le sache. L'identifiant du paiement chez SasPay est gardé dans payiz_id,
-- préfixé « softpay: » : aucune colonne nouvelle, et aucun nom de prestataire dans les données envoyées au navigateur.
--   - noter_essai : après un échec, un nouvel essai peut porter un autre identifiant (SasPay crée une demande à chaque
--     essai ; un réessai peut aussi changer de prestataire). Tant qu'une demande attend sur le téléphone, l'identifiant
--     ne change pas (« Paiement Payiz différent. », comme avant).
--   - noter_echec reçoit la référence du paiement qui a échoué (facultative : l'appli d'avant cette version l'appelle
--     sans) : un échec qui arrive en retard pour une demande remplacée (Payiz qui fait expirer son ancien paiement après un
--     réessai chez SasPay) ne touche pas la demande en cours.
--   - paiements_softpay_en_attente : pour les notifications de SasPay, qui ne nomment pas notre paiement : les paiements
--     SasPay en attente depuis moins de 24 h, relus chez SasPay. Gardée par le jeton du serveur.
-- À appliquer après la 0080. Rejouable.

begin;

-- ─── Noter un essai (dernière définition : 0072_paiements_tous_pays.sql) ────────────────────────────
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
  -- Une demande qui attend encore peut aboutir : on ne la remplace pas. Après un échec, la nouvelle demande la remplace.
  if v.statut = 'en_attente' and v.payiz_id is not null and v.payiz_id is distinct from p_payiz then
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

-- ─── Noter un échec (dernière définition : 0049_abonnements_paiements.sql) ──────────────────────────
-- Avec la référence : ignoré si ce n'est plus la demande notée (la carte est renvoyée telle quelle).
drop function if exists public.noter_echec(uuid, text, text, text);
create or replace function public.noter_echec(p_paiement uuid, p_statut text, p_motif text, p_jeton text, p_payiz text default null)
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
  if v.statut <> 'reussi' and (p_payiz is null or v.payiz_id is not distinct from p_payiz) then
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

revoke execute on function public.noter_echec(uuid, text, text, text, text) from public, anon, authenticated;
-- Appelée par le serveur, avec ou sans session : le jeton la garde (comme en 0049).
grant execute on function public.noter_echec(uuid, text, text, text, text) to anon, authenticated;

-- ─── Les paiements SasPay en attente (pour ses notifications) ───────────────────────────────────────
create or replace function public.paiements_softpay_en_attente(p_jeton text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_jeton_paiement(p_jeton);
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'ref', p.payiz_id, 'montant', p.montant) order by p.essai_le desc)
    from (
      select id, payiz_id, montant, essai_le
      from public.paiements
      where statut = 'en_attente' and payiz_id like 'softpay:%' and essai_le > now() - interval '24 hours'
      order by essai_le desc
      limit 50
    ) p
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.paiements_softpay_en_attente(text) from public, anon, authenticated;
grant execute on function public.paiements_softpay_en_attente(text) to anon, authenticated;

commit;
