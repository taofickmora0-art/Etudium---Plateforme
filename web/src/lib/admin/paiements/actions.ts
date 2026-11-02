"use server";

import { refresh } from "next/cache";
import { ACCES_EQUIPE, exigerDomaine } from "@/lib/admin/garde";
import { estFonctionAbsente } from "@/lib/contenus/lecture";
import { versDetailPaiement, versPagePaiements, type DetailPaiement, type PagePaiements } from "./data";

// Les actions du back-office « Abonnements et paiements » (0051). Chacune vérifie l'équipe ; la base revérifie tout,
// dont le rôle d'administrateur pour l'argent, et ses messages sont faits pour être affichés tels quels.

type Resultat = { ok: true } | { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ECHEC = "L’opération n’a pas abouti. Réessayez.";
const MIGRATION = "Appliquez les migrations 0049 à 0052 (guide « Ce qui te revient », section 56).";
const GUIDE = "Ajoutez PAYIZ_CLE_SECRETE et PAIEMENT_JETON dans web/.env.local (guide « Ce qui te revient », section 56), puis relancez le serveur.";
const STATUTS = ["reussi", "en_attente", "echoue", "expire"];
const JETON_COURT =
  "PAIEMENT_JETON est trop court (32 caractères au moins). Génère-le avec la commande du guide « Ce qui te revient », section 56, colle-le dans web/.env.local, puis relance le serveur.";

function message(error: { code?: string; message?: string }): string {
  if (estFonctionAbsente(error)) return MIGRATION;
  if ((error.code === "P0001" || error.code === "42501") && error.message) return error.message.replace(/'/g, "’");
  return ECHEC;
}

async function appeler(fonction: string, args?: Record<string, unknown>): Promise<Resultat> {
  const garde = await exigerDomaine("paiements");
  if ("erreur" in garde) return { ok: false, message: garde.erreur };
  const { error } = await garde.supabase.rpc(fonction, args);
  if (error) return { ok: false, message: message(error) };
  refresh();
  return { ok: true };
}

/** « Activer les paiements » : la base garde l'empreinte du jeton du serveur. */
export async function activerPaiements(): Promise<Resultat> {
  const garde = await exigerDomaine("paiements");
  if ("erreur" in garde) return { ok: false, message: garde.erreur };
  const jeton = process.env.PAIEMENT_JETON?.trim();
  if (!jeton || !process.env.PAYIZ_CLE_SECRETE?.trim()) return { ok: false, message: GUIDE };
  if (jeton.length < 32) return { ok: false, message: JETON_COURT };
  return appeler("activer_paiements", { p_jeton: jeton });
}

export async function desactiverPaiements(): Promise<Resultat> {
  return appeler("desactiver_paiements");
}

/** Un montant saisi en FCFA (« 15 000 ») ; null si vide, NaN si illisible. */
const lireMontant = (saisie: string): number | null => {
  const brut = saisie.replace(/[\s  ]/g, "");
  if (!brut) return null;
  return /^\d+$/.test(brut) ? Number(brut) : Number.NaN;
};

export async function reglerFormule(e: { formuleId: string; prix: string; recommandee: boolean; active: boolean }): Promise<Resultat> {
  if (!UUID.test(e.formuleId)) return { ok: false, message: ECHEC };
  const prix = lireMontant(e.prix);
  if (Number.isNaN(prix)) return { ok: false, message: "Saisissez le prix en FCFA, sans décimales." };
  return appeler("regler_formule", { p_formule: e.formuleId, p_prix: prix, p_recommandee: e.recommandee, p_active: e.active });
}

/** Un jour du Bénin (« 2026-11-30 ») : son début, ou sa dernière seconde pour une fin incluse. */
const jourBenin = (jour: string, fin: boolean) => (/^\d{4}-\d{2}-\d{2}$/.test(jour) ? `${jour}T${fin ? "23:59:59" : "00:00:00"}+01:00` : null);

export async function enregistrerCodePromo(e: {
  id: string | null;
  code: string;
  type: "pourcentage" | "montant";
  valeur: string;
  debut: string;
  fin: string;
  limite: string;
  actif: boolean;
}): Promise<Resultat> {
  const valeur = lireMontant(e.valeur);
  const limite = lireMontant(e.limite);
  if (valeur === null || Number.isNaN(valeur)) return { ok: false, message: "Saisissez la valeur de la remise, sans décimales." };
  if (Number.isNaN(limite)) return { ok: false, message: "Saisissez une limite en nombre d’utilisations." };
  return appeler("enregistrer_code_promo", {
    p_id: e.id && UUID.test(e.id) ? e.id : null,
    p_code: e.code,
    p_type: e.type,
    p_valeur: valeur,
    p_debut: jourBenin(e.debut, false),
    p_fin: jourBenin(e.fin, true),
    p_limite: limite,
    p_actif: e.actif,
  });
}

const MONTANT_RECU = "Indiquez le montant reçu, en FCFA, sans décimales.";

/** Un abonnement payé hors plateforme (ou offert), enregistré à la main (0054) : l'accès s'ouvre aussitôt. */
export async function attribuerAbonnement(e: {
  compteId: string;
  formuleId: string;
  moyen: "mobile_money" | "especes" | "virement" | "offert";
  montant: string;
  reference: string;
}): Promise<Resultat> {
  if (!UUID.test(e.compteId) || !UUID.test(e.formuleId)) return { ok: false, message: ECHEC };
  const montant = e.moyen === "offert" ? 0 : lireMontant(e.montant);
  if (montant === null || Number.isNaN(montant)) return { ok: false, message: MONTANT_RECU };
  return appeler("attribuer_abonnement", {
    p_compte: e.compteId,
    p_formule: e.formuleId,
    p_moyen: e.moyen,
    p_montant: montant,
    p_reference: e.reference.trim() || null,
  });
}

/** Résilier : l'abonnement en cours et ceux qui suivent sont annulés (0054). */
export async function resilierAbonnements(compteId: string, motif: string): Promise<Resultat> {
  if (!UUID.test(compteId)) return { ok: false, message: ECHEC };
  return appeler("resilier_abonnements", { p_compte: compteId, p_motif: motif.trim() });
}

export async function annulerAbonnement(abonnementId: string, motif: string): Promise<Resultat> {
  if (!UUID.test(abonnementId)) return { ok: false, message: ECHEC };
  return appeler("annuler_abonnement", { p_abonnement: abonnementId, p_motif: motif });
}

/** La liste des paiements : jamais par l'adresse de la page (données personnelles), toujours par cette action. */
export async function chargerPaiements(f: { statut: string | null; recherche: string; page: number }): Promise<{ ok: true; page: PagePaiements } | { ok: false; message: string }> {
  const garde = await exigerDomaine("paiements");
  if ("erreur" in garde) return { ok: false, message: garde.erreur };
  const { data, error } = await garde.supabase.rpc("paiements_equipe", {
    p_statut: f.statut && STATUTS.includes(f.statut) ? f.statut : null,
    p_recherche: (f.recherche ?? "").trim().slice(0, 200),
    p_page: Math.max(1, Math.trunc(Number(f.page)) || 1),
  });
  if (error) return { ok: false, message: "La liste n’a pas pu être chargée. Réessayez." };
  return { ok: true, page: versPagePaiements(data) };
}

export async function chargerPaiement(id: string): Promise<{ ok: true; detail: DetailPaiement } | { ok: false; message: string }> {
  if (!UUID.test(id)) return { ok: false, message: ECHEC };
  const garde = await exigerDomaine("paiements");
  if ("erreur" in garde) return { ok: false, message: garde.erreur };
  const { data, error } = await garde.supabase.rpc("paiement_equipe", { p_id: id });
  if (error) return { ok: false, message: error.code === "42501" ? ACCES_EQUIPE : ECHEC };
  if (!data) return { ok: false, message: "Ce paiement n’existe plus." };
  return { ok: true, detail: versDetailPaiement(data) };
}
