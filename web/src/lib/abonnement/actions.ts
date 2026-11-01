"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { estFonctionAbsente } from "@/lib/contenus/lecture";
import { viderFileApres } from "@/lib/envois/declencher";
import { configurationPaiement, type ConfigPaiement } from "@/lib/paiements/config";
import { creerPaiementPayiz, ErreurPayiz, lirePaiementPayiz, relancerPaiementPayiz, type PaiementPayiz } from "@/lib/paiements/payiz";
import { erreurPayizTraduite, masquerTelephone, messageErreurPayiz, normaliserTelephone } from "@/lib/paiements/regles";
import { appliquerPayiz } from "@/lib/paiements/synchroniser";
import { createClient } from "@/lib/supabase/server";
import { versCartePaiement, versEssaiCode } from "./conversion";
import { etapeDepuisCarte } from "./regles";
import type { CartePaiement, EssaiCode, EtapePaiement, Operateur } from "./types";

// Les actions de la souscription (lot 2, spec §3). La base prépare le paiement (montant, code promo, un seul en cours) ;
// le serveur appelle Payiz avec sa clé secrète, puis note l'essai avec le jeton du serveur. Le numéro complet ne quitte
// jamais cette action : seul son masque est enregistré.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INDISPONIBLE = "Les paiements ouvrent bientôt.";
const NUMERO_INVALIDE = "Saisissez un numéro béninois à 10 chiffres (01 XX XX XX XX).";
const NUMERO_VIDE = "Saisissez votre numéro Mobile Money.";
const INTROUVABLE = "Paiement introuvable.";
const CHOISIR = "Choisissez un abonnement.";
const ECHEC = "Le paiement n’a pas pu être lancé. Réessayez.";
const MIGRATION = "Les abonnements ne sont pas encore installés (migration 0049, guide « Ce qui te revient », section 56).";
const INDISPONIBLE_POUR_LE_MOMENT = "Le paiement est indisponible pour le moment. Réessayez plus tard.";
/** Le refus du jeton du serveur : une affaire de configuration, pas un message pour l'étudiant. */
const JETON_REFUSE = "Jeton de paiement non reconnu.";

type Erreur = { code?: string; message?: string };

const erreur = (message: string): EtapePaiement => ({ etat: "erreur", message });

/** Les refus de la base (P0001, 42501) sont faits pour être affichés tels quels. */
function messageBase(e: Erreur): string {
  if (estFonctionAbsente(e)) return MIGRATION;
  if (e.message === JETON_REFUSE) return INDISPONIBLE_POUR_LE_MOMENT;
  if ((e.code === "P0001" || e.code === "42501") && e.message) return e.message.replace(/'/g, "’");
  return ECHEC;
}

/** Les chiffres en série (un numéro de téléphone) ne vont pas dans le journal. */
const sansNumero = (texte: string) => texte.replace(/\+?\d{8,}/g, "•••");

/**
 * Un refus de Payiz. Ce qui ne regarde pas l'étudiant (clé refusée, compte, réseau) s'affiche « indisponible » et
 * s'écrit dans le journal du serveur pour l'équipe : code, statut, message de Payiz ; jamais la clé ni le numéro.
 */
function refusPayiz(action: "payer" | "reessayer", x: unknown): EtapePaiement {
  if (!(x instanceof ErreurPayiz)) return erreur(ECHEC);
  if (!erreurPayizTraduite(x.code)) {
    const details = x.details ? ` ${sansNumero(JSON.stringify(x.details))}` : "";
    console.error(`[payiz] ${action} refusé : statut ${x.statut}, code ${x.code}, « ${sansNumero(x.message)} »${details}`);
  }
  return erreur(messageErreurPayiz(x.code));
}

const operateurPayiz = (p: PaiementPayiz): Operateur | null => {
  const o = p.latest_attempt?.operator;
  return o === "mtn" || o === "moov" ? o : null;
};

async function noterEssai(supabase: SupabaseClient, config: ConfigPaiement, paiementId: string, payizId: string, operateur: Operateur | null, telephone: string) {
  const { data, error } = await supabase.rpc("noter_essai", {
    p_paiement: paiementId,
    p_payiz: payizId,
    p_operateur: operateur,
    p_telephone_masque: masquerTelephone(telephone),
    p_jeton: config.jeton,
  });
  if (error) return erreur(messageBase(error));
  return etapeDepuisCarte(versCartePaiement(data));
}

/** Avant tout appel à Payiz : paiements ouverts et jeton du serveur reconnu, sinon l'argent reçu ne serait pas confirmé. */
async function prets(supabase: SupabaseClient, config: ConfigPaiement): Promise<boolean> {
  const { data, error } = await supabase.rpc("paiements_prets", { p_jeton: config.jeton });
  return !error && data === true;
}

async function lirePaiement(supabase: SupabaseClient, paiementId: string): Promise<CartePaiement | string> {
  const { data, error } = await supabase.rpc("mon_paiement", { p_id: paiementId });
  if (error) return messageBase(error);
  return data ? versCartePaiement(data) : INTROUVABLE;
}

/** « Appliquer » : le montant après remise, ou le motif du refus. */
export async function essayerCode(formuleId: string, code: string): Promise<EssaiCode> {
  if (!UUID.test(formuleId) || !code.trim()) return { ok: false, message: "Ce code n’existe pas." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("essayer_code", { p_code: code.trim(), p_formule: formuleId });
  if (error) return { ok: false, message: messageBase(error) };
  return versEssaiCode(data);
}

/** « Payer » : prépare le paiement, l'envoie chez Payiz (la demande part sur le téléphone) et note l'essai. */
export async function payer(e: { formuleId: string; code: string; telephone: string; operateur: Operateur | null }): Promise<EtapePaiement> {
  if (!UUID.test(e.formuleId)) return erreur(CHOISIR);
  const saisie = e.telephone.trim();
  const telephone = saisie ? normaliserTelephone(saisie) : null;
  if (saisie && !telephone) return erreur(NUMERO_INVALIDE);
  // Sans code promo, le paiement n'est jamais gratuit : ce qui manque se dit avant de rien préparer en base.
  if (!e.code.trim()) {
    if (!configurationPaiement()) return erreur(INDISPONIBLE);
    if (!telephone) return erreur(NUMERO_VIDE);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("preparer_paiement", { p_formule: e.formuleId, p_code: e.code.trim() || null });
  if (error) return erreur(messageBase(error));
  const carte = versCartePaiement(data);
  // Code à 100 % : l'abonnement est offert, sans Payiz.
  if (carte.statut === "reussi") return { etat: "reussi", paiement: carte };

  const config = configurationPaiement();
  if (!config) return erreur(INDISPONIBLE);
  // Un paiement attend déjà la validation sur le téléphone : on le reprend (choix 3).
  if (carte.repris) return etapeDepuisCarte(carte);
  if (!telephone) return erreur(NUMERO_VIDE);
  if (!(await prets(supabase, config))) return erreur(INDISPONIBLE);

  let p: PaiementPayiz;
  try {
    p = await creerPaiementPayiz(config.cle, { paiementId: carte.id, montant: carte.montant, formule: carte.formule, telephone, operateur: e.operateur });
  } catch (x) {
    return refusPayiz("payer", x);
  }
  return noterEssai(supabase, config, carte.id, p.id, e.operateur ?? operateurPayiz(p), telephone);
}

/** L'écran d'attente, toutes les 3 secondes : l'état relu chez Payiz, appliqué en base. */
export async function suivrePaiement(paiementId: string): Promise<EtapePaiement> {
  if (!UUID.test(paiementId)) return erreur(INTROUVABLE);
  const supabase = await createClient();
  const lu = await lirePaiement(supabase, paiementId);
  if (typeof lu === "string") return erreur(lu);
  let carte = lu;
  const config = configurationPaiement();
  if (carte.statut === "en_attente" && carte.payizId && config) {
    try {
      carte = (await appliquerPayiz(supabase, carte.id, await lirePaiementPayiz(config.cle, carte.payizId), config.jeton)) ?? carte;
      // Le reçu par e-mail (migration 0058) part tout de suite.
      if (carte.statut === "reussi") viderFileApres();
    } catch {
      // Payiz injoignable ou réponse inattendue : on garde l'état connu ; le suivi suivant réessaie.
    }
  }
  return etapeDepuisCarte(carte);
}

/** « Réessayer » : un nouvel essai sur le même paiement, avec le même numéro ou un autre. */
export async function reessayer(e: { paiementId: string; telephone: string; operateur: Operateur | null }): Promise<EtapePaiement> {
  if (!UUID.test(e.paiementId)) return erreur(INTROUVABLE);
  const telephone = normaliserTelephone(e.telephone);
  if (!telephone) return erreur(NUMERO_INVALIDE);
  const config = configurationPaiement();
  if (!config) return erreur(INDISPONIBLE);

  const supabase = await createClient();
  const lu = await lirePaiement(supabase, e.paiementId);
  if (typeof lu === "string") return erreur(lu);
  if (lu.statut === "reussi") return { etat: "reussi", paiement: lu };
  if (!lu.payizId) return erreur(messageErreurPayiz("payment_closed"));
  if (!(await prets(supabase, config))) return erreur(INDISPONIBLE);

  try {
    await relancerPaiementPayiz(config.cle, lu.payizId, { telephone, operateur: e.operateur, cleIdempotence: `${lu.id}-${Date.now()}` });
  } catch (x) {
    if (x instanceof ErreurPayiz && x.code === "payment_closed") {
      const { data, error } = await supabase.rpc("noter_echec", { p_paiement: lu.id, p_statut: "expire", p_motif: null, p_jeton: config.jeton });
      return error ? erreur(messageBase(error)) : etapeDepuisCarte(versCartePaiement(data));
    }
    return refusPayiz("reessayer", x);
  }
  return noterEssai(supabase, config, lu.id, lu.payizId, e.operateur, telephone);
}
