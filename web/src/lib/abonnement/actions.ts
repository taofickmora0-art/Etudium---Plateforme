"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { estFonctionAbsente } from "@/lib/contenus/lecture";
import { viderFileApres } from "@/lib/envois/declencher";
import { configurationPaiement, type ConfigPaiement } from "@/lib/paiements/config";
import { lireMoyensDePaiement } from "@/lib/paiements/moyens";
import { codePaysValide, indicatifDuPays } from "@/lib/paiements/pays";
import { creerPaiementPayiz, ErreurPayiz, lirePaiementPayiz, relancerPaiementPayiz } from "@/lib/paiements/payiz";
import {
  codeOperateurValide,
  erreurPayizASignaler,
  erreurPayizTraduite,
  masquerTelephone,
  messageErreurPayiz,
  messageOperateurRequis,
  nomOperateur,
  normaliserTelephone,
} from "@/lib/paiements/regles";
import { appliquerPayiz } from "@/lib/paiements/synchroniser";
import { createClient } from "@/lib/supabase/server";
import { versCartePaiement, versEssaiCode } from "./conversion";
import { etapeDepuisCarte } from "./regles";
import type { CartePaiement, EssaiCode, EtapePaiement, MoyensDePaiement, Operateur } from "./types";

// Les actions de la souscription (lot 2, spec §3). La base prépare le paiement (montant, code promo, un seul en cours) ;
// le serveur appelle Payiz avec sa clé secrète, puis note l'essai avec le jeton du serveur. Le numéro complet ne quitte
// jamais cette action : seul son masque est enregistré. Depuis le 3 novembre 2026, tous les pays et tous les opérateurs
// de Payiz : le pays (et l'opérateur, s'il est choisi) part avec le numéro ; le pays et le nom de l'opérateur sont notés.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INDISPONIBLE = "Les paiements ouvrent bientôt.";
const NUMERO_INVALIDE_BENIN = "Saisissez un numéro béninois à 10 chiffres (01 XX XX XX XX).";
const PAYS_A_CHOISIR = "Choisissez votre pays.";
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

/** Le payeur vérifié : son numéro international, son pays, et l'indicatif de ce pays. */
type Payeur = { telephone: string; pays: string; indicatif: string };

/**
 * Le pays et le numéro saisis, vérifiés avant tout appel : l'indicatif vient de la table des pays (sans appel), sinon de
 * la liste de Payiz. Un message s'il manque quelque chose.
 */
async function verifierPayeur(saisie: string, pays: string): Promise<Payeur | string> {
  if (!codePaysValide(pays)) return PAYS_A_CHOISIR;
  const indicatif = indicatifDuPays(pays) ?? (await lireMoyensDePaiement({ devise: "XOF" })).pays.find((p) => p.code === pays)?.indicatif;
  if (!indicatif) return messageErreurPayiz("country_unavailable");
  const telephone = normaliserTelephone(saisie, { code: pays, indicatif });
  if (!telephone) return pays === "BEN" ? NUMERO_INVALIDE_BENIN : messageErreurPayiz("phone_invalid");
  return { telephone, pays, indicatif };
}

/** Le nom d'un opérateur dans la liste de Payiz (celui qu'il porte au moment du paiement) ; null s'il n'y est pas. */
const nomDans = (moyens: MoyensDePaiement, pays: string, code: Operateur | null) =>
  (code && moyens.pays.find((p) => p.code === pays)?.operateurs.find((o) => o.code === code)?.nom) || null;

/** Les opérateurs proposés par Payiz avec `operator_required` (`details.operators` : des codes, ou des objets). */
function candidatsDe(details: Record<string, unknown> | undefined): { code: Operateur; nom: string | null }[] {
  const brut = Array.isArray(details?.operators) ? details.operators : [];
  const candidats: { code: Operateur; nom: string | null }[] = [];
  for (const c of brut) {
    const objet = c && typeof c === "object" ? (c as Record<string, unknown>) : null;
    const code = objet ? objet.code : c;
    if (!codeOperateurValide(code) || candidats.some((x) => x.code === code)) continue;
    candidats.push({ code, nom: typeof objet?.name === "string" && objet.name.trim() ? objet.name.trim().slice(0, 60) : null });
  }
  return candidats;
}

/**
 * Un refus de Payiz. Ce qui ne regarde pas l'étudiant (clé refusée, compte, réseau) s'affiche « indisponible » et
 * s'écrit dans le journal du serveur pour l'équipe : code, statut, message de Payiz ; jamais la clé ni le numéro. Un
 * pays, une monnaie ou une conversion indisponibles se disent à l'étudiant et s'écrivent aussi dans le journal.
 * `operator_required` nomme les opérateurs possibles, que l'écran propose.
 */
function refusPayiz(action: "payer" | "reessayer", x: unknown, moyens: MoyensDePaiement, pays: string): EtapePaiement {
  if (!(x instanceof ErreurPayiz)) return erreur(ECHEC);
  if (!erreurPayizTraduite(x.code) || erreurPayizASignaler(x.code)) {
    const details = x.details ? ` ${sansNumero(JSON.stringify(x.details))}` : "";
    console.error(`[payiz] ${action} refusé : statut ${x.statut}, code ${x.code}, « ${sansNumero(x.message)} »${details}`);
  }
  if (x.code === "operator_required") {
    const candidats = candidatsDe(x.details);
    if (candidats.length) {
      const noms = candidats.map((c) => c.nom ?? nomDans(moyens, pays, c.code) ?? nomOperateur(c.code));
      return { etat: "erreur", message: messageOperateurRequis(noms), candidats: candidats.map((c) => c.code) };
    }
  }
  return erreur(messageErreurPayiz(x.code));
}

type Essai = { operateur: Operateur | null; moyens: MoyensDePaiement; payeur: Payeur };

async function noterEssai(supabase: SupabaseClient, config: ConfigPaiement, paiementId: string, payizId: string, e: Essai) {
  const { data, error } = await supabase.rpc("noter_essai", {
    p_paiement: paiementId,
    p_payiz: payizId,
    p_operateur: e.operateur,
    p_operateur_nom: nomDans(e.moyens, e.payeur.pays, e.operateur),
    p_pays: e.payeur.pays,
    p_telephone_masque: masquerTelephone(e.payeur.telephone, e.payeur.indicatif),
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

/** « Appliquer » : le montant après remise (et les moyens de paiement pour ce montant), ou le motif du refus. */
export async function essayerCode(formuleId: string, code: string): Promise<EssaiCode> {
  if (!UUID.test(formuleId) || !code.trim()) return { ok: false, message: "Ce code n’existe pas." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("essayer_code", { p_code: code.trim(), p_formule: formuleId });
  if (error) return { ok: false, message: messageBase(error) };
  const essai = versEssaiCode(data);
  // Le montant à payer chez chaque opérateur dépend du montant : la base limite déjà les essais de code (0053).
  if (essai.ok && essai.montant > 0 && configurationPaiement()) return { ...essai, moyens: await lireMoyensDePaiement({ montant: essai.montant, devise: "XOF" }) };
  return essai;
}

type Entree = { formuleId: string; code: string; telephone: string; /** ISO 3166 alpha-3. */ pays: string; operateur: Operateur | null };

/** « Payer » : prépare le paiement, l'envoie chez Payiz (la demande part sur le téléphone) et note l'essai. */
export async function payer(e: Entree): Promise<EtapePaiement> {
  if (!UUID.test(e.formuleId)) return erreur(CHOISIR);
  const saisie = e.telephone.trim();
  let payeur: Payeur | null = null;
  if (saisie) {
    const verifie = await verifierPayeur(saisie, e.pays);
    if (typeof verifie === "string") return erreur(verifie);
    payeur = verifie;
  }
  // Sans code promo, le paiement n'est jamais gratuit : ce qui manque se dit avant de rien préparer en base.
  if (!e.code.trim()) {
    if (!configurationPaiement()) return erreur(INDISPONIBLE);
    if (!payeur) return erreur(NUMERO_VIDE);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("preparer_paiement", { p_formule: e.formuleId, p_code: e.code.trim() || null });
  if (error) return erreur(messageBase(error));
  const carte = versCartePaiement(data);
  // Code à 100 % : l'abonnement est offert, sans Payiz ; sa confirmation par e-mail part tout de suite (0058).
  if (carte.statut === "reussi") {
    viderFileApres();
    return { etat: "reussi", paiement: carte };
  }

  const config = configurationPaiement();
  if (!config) return erreur(INDISPONIBLE);
  // Un paiement attend déjà la validation sur le téléphone : on le reprend (choix 3).
  if (carte.repris) return etapeDepuisCarte(carte);
  if (!payeur) return erreur(NUMERO_VIDE);
  if (!(await prets(supabase, config))) return erreur(INDISPONIBLE);

  const operateur = codeOperateurValide(e.operateur) ? e.operateur : null;
  // La liste de Payiz (le nom de l'opérateur, les candidats) est lue en même temps : elle est le plus souvent déjà gardée.
  const [creation, moyens] = await Promise.all([
    creerPaiementPayiz(config.cle, { paiementId: carte.id, montant: carte.montant, formule: carte.formule, telephone: payeur.telephone, pays: payeur.pays, operateur }).then(
      (p) => ({ ok: true as const, p }),
      (x: unknown) => ({ ok: false as const, x }),
    ),
    lireMoyensDePaiement({ montant: carte.montant, devise: "XOF" }),
  ]);
  if (!creation.ok) return refusPayiz("payer", creation.x, moyens, payeur.pays);
  const deduit = creation.p.latest_attempt?.operator;
  return noterEssai(supabase, config, carte.id, creation.p.id, { operateur: operateur ?? (codeOperateurValide(deduit) ? deduit : null), moyens, payeur });
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

/** « Réessayer » : un nouvel essai sur le même paiement, avec le même numéro ou un autre (d'un autre pays aussi). */
export async function reessayer(e: { paiementId: string; telephone: string; pays: string; operateur: Operateur | null }): Promise<EtapePaiement> {
  if (!UUID.test(e.paiementId)) return erreur(INTROUVABLE);
  const payeur = await verifierPayeur(e.telephone.trim(), e.pays);
  if (typeof payeur === "string") return erreur(payeur);
  const config = configurationPaiement();
  if (!config) return erreur(INDISPONIBLE);

  const supabase = await createClient();
  const lu = await lirePaiement(supabase, e.paiementId);
  if (typeof lu === "string") return erreur(lu);
  if (lu.statut === "reussi") return { etat: "reussi", paiement: lu };
  if (!lu.payizId) return erreur(messageErreurPayiz("payment_closed"));
  if (!(await prets(supabase, config))) return erreur(INDISPONIBLE);

  const operateur = codeOperateurValide(e.operateur) ? e.operateur : null;
  const [relance, moyens] = await Promise.all([
    relancerPaiementPayiz(config.cle, lu.payizId, { telephone: payeur.telephone, pays: payeur.pays, operateur, cleIdempotence: `${lu.id}-${Date.now()}` }).then(
      (essai) => ({ ok: true as const, essai }),
      (x: unknown) => ({ ok: false as const, x }),
    ),
    lireMoyensDePaiement({ montant: lu.montant, devise: "XOF" }),
  ]);
  if (!relance.ok) {
    if (relance.x instanceof ErreurPayiz && relance.x.code === "payment_closed") {
      const { data, error } = await supabase.rpc("noter_echec", { p_paiement: lu.id, p_statut: "expire", p_motif: null, p_jeton: config.jeton });
      return error ? erreur(messageBase(error)) : etapeDepuisCarte(versCartePaiement(data));
    }
    return refusPayiz("reessayer", relance.x, moyens, payeur.pays);
  }
  const deduit = relance.essai?.operator;
  return noterEssai(supabase, config, lu.id, lu.payizId, { operateur: operateur ?? (codeOperateurValide(deduit) ? deduit : null), moyens, payeur });
}
