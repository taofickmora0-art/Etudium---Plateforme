"use server";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getShellUser } from "@/lib/auth/current-user";
import { estFonctionAbsente } from "@/lib/contenus/lecture";
import { viderFileApres } from "@/lib/envois/declencher";
import { INDISPONIBLE as FONCTION_INDISPONIBLE } from "@/lib/indisponible";
import type { MoyensRoutes } from "@/lib/paiements/aiguillage";
import { configurationPaiement, type ConfigPaiement } from "@/lib/paiements/config";
import { lireMoyensDePaiement, lireMoyensRoutes } from "@/lib/paiements/moyens";
import { alpha2De, codePaysValide, indicatifDuPays } from "@/lib/paiements/pays";
import { creerPaiementPayiz, ErreurPayiz, relancerPaiementPayiz } from "@/lib/paiements/payiz";
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
import { ErreurSasPay, erreurSasPayTraduite, estSasPay, messageErreurSasPay, payerSasPay } from "@/lib/paiements/saspay";
import { relirePaiement } from "@/lib/paiements/synchroniser";
import { createClient } from "@/lib/supabase/server";
import { versCartePaiement, versEssaiCode } from "./conversion";
import { dureeAbonnement, etapeDepuisCarte } from "./regles";
import type { CartePaiement, EssaiCode, EtapePaiement, MoyensDePaiement, Operateur } from "./types";

// Les actions de la souscription (lot 2, spec §3). La base prépare le paiement (montant, code promo, un seul en cours) ;
// le serveur appelle Payiz avec sa clé secrète, puis note l'essai avec le jeton du serveur. Le numéro complet ne quitte
// jamais cette action : seul son masque est enregistré. Depuis le 3 novembre 2026, tous les pays et tous les opérateurs
// de Payiz : le pays (et l'opérateur, s'il est choisi) part avec le numéro ; le pays et le nom de l'opérateur sont notés.
// Depuis le 12 novembre 2026, SasPay encaisse les pays et les opérateurs que Payiz n'encaisse pas (aiguillage.ts), sans
// que l'étudiant le sache : sa référence est notée « softpay:… », et rien de ce qui part au navigateur ne le nomme.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INDISPONIBLE = "Les paiements ouvrent bientôt.";
const NUMERO_INVALIDE_BENIN = "Saisissez un numéro béninois à 10 chiffres (01 XX XX XX XX).";
const PAYS_A_CHOISIR = "Choisissez votre pays.";
const NUMERO_VIDE = "Saisissez votre numéro Mobile Money.";
const INTROUVABLE = "Paiement introuvable.";
const CHOISIR = "Choisissez un abonnement.";
const ECHEC = "Le paiement n’a pas pu être lancé. Réessayez.";
const INDISPONIBLE_POUR_LE_MOMENT = "Le paiement est indisponible pour le moment. Réessayez plus tard.";
/** Le refus du jeton du serveur : une affaire de configuration, pas un message pour l'étudiant. */
const JETON_REFUSE = "Jeton de paiement non reconnu.";
const CODE_PAIEMENT_REQUIS = "Saisissez le code de paiement donné par votre opérateur.";
const PEUT_ETRE_PARTIE = "La demande a peut-être été envoyée sur votre téléphone : validez-la si elle est arrivée, puis cliquez de nouveau sur « Payer ».";

/**
 * La clé d'idempotence d'une demande : la même pour une même demande (double clic, deux onglets, réponse perdue puis
 * nouveau « Payer » : SasPay rend alors la demande déjà partie, sans second débit), une autre dès que l'essai d'avant,
 * l'opérateur, le numéro ou le code changent.
 */
const cleDemande = (paiementId: string, ...parties: (string | null | undefined)[]) =>
  `${paiementId}-${createHash("sha256").update(parties.map((p) => p ?? "").join("|")).digest("hex").slice(0, 16)}`;

type Erreur = { code?: string; message?: string };

const erreur = (message: string): EtapePaiement => ({ etat: "erreur", message });

/** Les refus de la base (P0001, 42501) sont faits pour être affichés tels quels. */
function messageBase(e: Erreur): string {
  if (estFonctionAbsente(e)) return FONCTION_INDISPONIBLE;
  if (e.message === JETON_REFUSE) return INDISPONIBLE_POUR_LE_MOMENT;
  if ((e.code === "P0001" || e.code === "42501") && e.message) return e.message.replace(/'/g, "’");
  return ECHEC;
}

/** Les numéros de téléphone (même écrits avec des espaces ou des points) et les adresses e-mail ne vont pas dans le journal. */
const sansNumero = (texte: string) => texte.replace(/\+?\d(?:[\s.]?\d){7,}/g, "•••").replace(/[^\s@]+@[^\s@]+/g, "•••");

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

/** Un refus de SasPay : en clair pour l'étudiant, sans son nom ; ce qui regarde l'équipe va dans le journal du serveur. */
function refusSasPay(action: "payer" | "reessayer", x: unknown): EtapePaiement {
  if (!(x instanceof ErreurSasPay)) return erreur(ECHEC);
  // Pas de réponse à temps, même au second envoi : la demande a pu partir. Un nouveau « Payer » (même clé) la retrouve.
  if (x.code === "delai") return erreur(PEUT_ETRE_PARTIE);
  if (!erreurSasPayTraduite(x.code)) console.error(`[saspay] ${action} refusé : statut ${x.statut}, code ${x.code}, « ${sansNumero(x.message)} »`);
  return erreur(messageErreurSasPay(x.code));
}

/**
 * Qui encaisse : SasPay pour un opérateur que seul lui propose ; sinon Payiz, comme avant (il déduit l'opérateur du
 * numéro, ou refuse lui-même). Sans opérateur choisi, dans un pays où SasPay encaisse au moins un opérateur, il faut le
 * choisir : sinon Payiz restreindrait la liste à ses seuls opérateurs (`operator_required`).
 */
function aiguiller(routes: MoyensRoutes, pays: string, operateur: Operateur | null): "payiz" | "saspay" | { message: string } {
  if (operateur) return routes.prestataireDe(pays, operateur) === "saspay" ? "saspay" : "payiz";
  const ceux = routes.moyens.pays.find((p) => p.code === pays)?.operateurs ?? [];
  if (ceux.some((o) => routes.prestataireDe(pays, o.code) === "saspay")) return { message: messageOperateurRequis([]) };
  return "payiz";
}

type DemandeSecours = { payeur: Payeur; operateur: Operateur; codePaiement?: string; moyens: MoyensDePaiement; cleIdempotence: string };

/** La demande chez SasPay, puis l'essai noté ; Wave et Orange Money rendent la page de l'opérateur, où valider. */
async function payerChezSasPay(supabase: SupabaseClient, config: ConfigPaiement, carte: CartePaiement, d: DemandeSecours): Promise<EtapePaiement> {
  if (!config.saspay) return erreur(INDISPONIBLE_POUR_LE_MOMENT);
  const choisi = d.moyens.pays.find((p) => p.code === d.payeur.pays)?.operateurs.find((o) => o.code === d.operateur);
  if (choisi?.validation === "code" && !d.codePaiement?.trim()) return erreur(CODE_PAIEMENT_REQUIS);
  const pays = alpha2De(d.payeur.pays);
  if (!pays) return erreur(messageErreurPayiz("country_unavailable"));
  let ref: string;
  let redirection: string | null;
  try {
    const compte = await getShellUser();
    if (!compte) return erreur(ECHEC);
    const site = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
    ({ ref, redirection } = await payerSasPay(config.saspay.cle, {
      paiementId: carte.id,
      cleIdempotence: d.cleIdempotence,
      montant: carte.montant,
      description: `Abonnement Étudium ${carte.formule.nom} (${dureeAbonnement(carte.formule.dureeMois)})`,
      pays,
      reseau: d.operateur,
      telephone: d.payeur.telephone,
      client: { email: compte.email, prenom: compte.prenom || "Étudiant", nom: compte.nom || "Étudium" },
      urlRetour: `${site}/abonnement`,
      codePaiement: d.codePaiement,
    }));
  } catch (x) {
    return refusSasPay(carte.payizId ? "reessayer" : "payer", x);
  }
  const etape = await noterEssai(supabase, config, carte.id, ref, { operateur: d.operateur, moyens: d.moyens, payeur: d.payeur });
  return redirection && etape.etat === "attente" ? { ...etape, redirection } : etape;
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

type Entree = {
  formuleId: string;
  code: string;
  telephone: string;
  /** ISO 3166 alpha-3. */
  pays: string;
  operateur: Operateur | null;
  /** Le code de paiement généré d'avance, pour les opérateurs qui l'exigent (Orange Côte d'Ivoire, Orange Burkina). */
  codePaiement?: string;
};

/** « Payer » : prépare le paiement, l'envoie chez Payiz ou SasPay (la demande part sur le téléphone) et note l'essai. */
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
  // Avec SasPay en secours, la liste dit d'abord qui encaisse (elle est le plus souvent déjà gardée : la page vient de la
  // lire). Sans lui, tout part chez Payiz, comme avant.
  const routes = config.saspay ? await lireMoyensRoutes({ montant: carte.montant, devise: "XOF" }) : null;
  if (routes) {
    const choix = aiguiller(routes, payeur.pays, operateur);
    if (typeof choix === "object") return erreur(choix.message);
    if (choix === "saspay") {
      const cleIdempotence = cleDemande(carte.id, "", operateur, payeur.telephone, e.codePaiement?.trim());
      return payerChezSasPay(supabase, config, carte, { payeur, operateur: operateur!, codePaiement: e.codePaiement, moyens: routes.moyens, cleIdempotence });
    }
  }
  // La liste de Payiz (le nom de l'opérateur, les candidats) est lue en même temps : elle est le plus souvent déjà gardée.
  const [creation, moyens] = await Promise.all([
    creerPaiementPayiz(config.cle, { paiementId: carte.id, montant: carte.montant, formule: carte.formule, telephone: payeur.telephone, pays: payeur.pays, operateur }).then(
      (p) => ({ ok: true as const, p }),
      (x: unknown) => ({ ok: false as const, x }),
    ),
    routes ? routes.moyens : lireMoyensDePaiement({ montant: carte.montant, devise: "XOF" }),
  ]);
  if (!creation.ok) return refusPayiz("payer", creation.x, moyens, payeur.pays);
  const deduit = creation.p.latest_attempt?.operator;
  return noterEssai(supabase, config, carte.id, creation.p.id, { operateur: operateur ?? (codeOperateurValide(deduit) ? deduit : null), moyens, payeur });
}

/** L'écran d'attente, toutes les 3 secondes : l'état relu chez Payiz (ou SasPay), appliqué en base. */
export async function suivrePaiement(paiementId: string): Promise<EtapePaiement> {
  if (!UUID.test(paiementId)) return erreur(INTROUVABLE);
  const supabase = await createClient();
  const lu = await lirePaiement(supabase, paiementId);
  if (typeof lu === "string") return erreur(lu);
  let carte = lu;
  const config = configurationPaiement();
  if (carte.statut === "en_attente" && carte.payizId && config) {
    try {
      carte = (await relirePaiement(supabase, config, carte)) ?? carte;
      // Le reçu par e-mail (migration 0058) part tout de suite.
      if (carte.statut === "reussi") viderFileApres();
    } catch {
      // Prestataire injoignable ou réponse inattendue : on garde l'état connu ; le suivi suivant réessaie.
    }
  }
  return etapeDepuisCarte(carte);
}

/**
 * « Réessayer » : un nouvel essai sur le même paiement, avec le même numéro ou un autre (d'un autre pays aussi). Chez
 * Payiz après Payiz : un essai de plus sur son paiement. Sinon (SasPay, ou un changement de prestataire) : une nouvelle
 * demande, seulement quand la précédente n'attend plus sur le téléphone.
 */
export async function reessayer(e: { paiementId: string; telephone: string; pays: string; operateur: Operateur | null; codePaiement?: string }): Promise<EtapePaiement> {
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
  const routes = config.saspay ? await lireMoyensRoutes({ montant: lu.montant, devise: "XOF" }) : null;
  let choix: "payiz" | "saspay" = "payiz";
  if (routes) {
    const aiguille = aiguiller(routes, payeur.pays, operateur);
    if (typeof aiguille === "object") return erreur(aiguille.message);
    choix = aiguille;
  }
  if (choix === "saspay" || estSasPay(lu.payizId)) {
    const liste = routes ? routes.moyens : await lireMoyensDePaiement({ montant: lu.montant, devise: "XOF" });
    // L'essai d'avant fait partie de la clé : deux réessais simultanés du même échec n'en font qu'un.
    const cleIdempotence = cleDemande(lu.id, lu.payizId, operateur, payeur.telephone, e.codePaiement?.trim());
    return nouvelleDemande(supabase, config, lu, { choix, payeur, operateur, codePaiement: e.codePaiement, moyens: liste, cleIdempotence });
  }
  // Chez Payiz, chaque essai sur son paiement a sa propre clé (Payiz refuse lui-même deux essais en même temps).
  const cleIdempotence = `${lu.id}-${Date.now()}`;
  const [relance, moyens] = await Promise.all([
    relancerPaiementPayiz(config.cle, lu.payizId, { telephone: payeur.telephone, pays: payeur.pays, operateur, cleIdempotence }).then(
      (essai) => ({ ok: true as const, essai }),
      (x: unknown) => ({ ok: false as const, x }),
    ),
    routes ? routes.moyens : lireMoyensDePaiement({ montant: lu.montant, devise: "XOF" }),
  ]);
  if (!relance.ok) {
    if (relance.x instanceof ErreurPayiz && relance.x.code === "payment_closed") {
      const { data, error } = await supabase.rpc("noter_echec", { p_paiement: lu.id, p_statut: "expire", p_motif: null, p_jeton: config.jeton, p_payiz: lu.payizId });
      return error ? erreur(messageBase(error)) : etapeDepuisCarte(versCartePaiement(data));
    }
    return refusPayiz("reessayer", relance.x, moyens, payeur.pays);
  }
  const deduit = relance.essai?.operator;
  return noterEssai(supabase, config, lu.id, lu.payizId, { operateur: operateur ?? (codeOperateurValide(deduit) ? deduit : null), moyens, payeur });
}

/**
 * Un réessai qui crée une nouvelle demande (SasPay, ou un changement de prestataire) : la précédente est d'abord relue ;
 * si elle attend encore sur le téléphone, rien ne part (elle peut aboutir). Chez Payiz, un nouveau paiement porte la même
 * référence, avec une autre clé d'idempotence.
 */
async function nouvelleDemande(
  supabase: SupabaseClient,
  config: ConfigPaiement,
  lu: CartePaiement,
  d: { choix: "payiz" | "saspay"; payeur: Payeur; operateur: Operateur | null; codePaiement?: string; moyens: MoyensDePaiement; cleIdempotence: string },
): Promise<EtapePaiement> {
  let carte = lu;
  if (carte.statut === "en_attente") {
    try {
      carte = (await relirePaiement(supabase, config, carte)) ?? carte;
    } catch {
      // Le prestataire ne répond pas : l'état connu (en attente) tient.
    }
    if (carte.statut === "reussi") {
      viderFileApres();
      return { etat: "reussi", paiement: carte };
    }
    if (carte.statut === "en_attente") return erreur(messageErreurPayiz("attempt_in_progress"));
  }
  // Seul un essai échoué laisse repartir une demande : un paiement expiré ou annulé est clos (« Recommencer »).
  if (carte.statut !== "echoue") return etapeDepuisCarte(carte);
  if (d.choix === "saspay" && d.operateur) return payerChezSasPay(supabase, config, carte, { ...d, operateur: d.operateur });
  let creation;
  try {
    creation = await creerPaiementPayiz(config.cle, {
      paiementId: carte.id,
      cleIdempotence: d.cleIdempotence,
      montant: carte.montant,
      formule: carte.formule,
      telephone: d.payeur.telephone,
      pays: d.payeur.pays,
      operateur: d.operateur,
    });
  } catch (x) {
    return refusPayiz("reessayer", x, d.moyens, d.payeur.pays);
  }
  const deduit = creation.latest_attempt?.operator;
  return noterEssai(supabase, config, carte.id, creation.id, { operateur: d.operateur ?? (codeOperateurValide(deduit) ? deduit : null), moyens: d.moyens, payeur: d.payeur });
}
