import { codePaysValide } from "@/lib/paiements/pays";
import { codeOperateurValide } from "@/lib/paiements/regles";
import type { CartePaiement, CodeFormule, DureeMois, EssaiCode, EtatAbonnement, Formule, MoyenManuel, Operateur, StatutPaiement } from "./types";

// Des réponses de la base (0049, en snake_case) vers les types de l'appli. Ce module n'importe rien du serveur : la coque
// (`current-user.ts`) s'en sert aussi.

type Ligne = Record<string, unknown>;

const CODES: CodeFormule[] = ["basique", "standard", "premium"];
const STATUTS: StatutPaiement[] = ["en_attente", "reussi", "echoue", "expire", "annule"];

const objet = (v: unknown): Ligne => (v && typeof v === "object" ? (v as Ligne) : {});
const texte = (v: unknown) => (typeof v === "string" ? v : "");
const texteOuNull = (v: unknown) => (typeof v === "string" && v !== "" ? v : null);
const nombre = (v: unknown) => Number(v ?? 0) || 0;
const code = (v: unknown): CodeFormule => (CODES.includes(v as CodeFormule) ? (v as CodeFormule) : "standard");
const duree = (v: unknown): DureeMois => (Number(v) === 12 ? 12 : Number(v) === 6 ? 6 : 3);
/** Un code d'opérateur Payiz (« mtn », « celtiis »…) ; null s'il est illisible. */
export const versOperateur = (v: unknown): Operateur | null => (codeOperateurValide(v) ? v : null);
/** Un pays ISO 3166 alpha-3 (« BEN ») ; null sinon. */
export const versPays = (v: unknown): string | null => (codePaysValide(v) ? v : null);
const MOYENS: MoyenManuel[] = ["mobile_money", "especes", "virement", "offert"];
export const versMoyenManuel = (v: unknown): MoyenManuel | null => (MOYENS.includes(v as MoyenManuel) ? (v as MoyenManuel) : null);

export function versFormule(l: Ligne): Formule {
  return {
    id: texte(l.id),
    code: code(l.code),
    nom: texte(l.nom),
    dureeMois: duree(l.duree_mois),
    prix: l.prix_fcfa === null || l.prix_fcfa === undefined ? null : nombre(l.prix_fcfa),
    recommandee: l.recommandee === true,
    active: l.active !== false,
  };
}

export function versEtatAbonnement(j: unknown): EtatAbonnement {
  const o = objet(j);
  if ((o.etat === "actif" || o.etat === "expire") && o.formule && typeof o.fin === "string") {
    const f = objet(o.formule);
    return { etat: o.etat, formule: { code: code(f.code), nom: texte(f.nom) }, fin: o.fin };
  }
  return { etat: "gratuit" };
}

export function versCartePaiement(j: unknown): CartePaiement {
  const o = objet(j);
  const f = objet(o.formule);
  const a = o.abonnement ? objet(o.abonnement) : null;
  return {
    id: texte(o.id),
    statut: STATUTS.includes(o.statut as StatutPaiement) ? (o.statut as StatutPaiement) : "en_attente",
    formule: { code: code(f.code), nom: texte(f.nom), dureeMois: duree(f.duree_mois) },
    prixInitial: nombre(o.prix_initial),
    remise: nombre(o.remise),
    montant: nombre(o.montant),
    code: texteOuNull(o.code),
    operateur: versOperateur(o.operateur),
    operateurNom: texteOuNull(o.operateur_nom),
    pays: versPays(o.pays),
    telephoneMasque: texteOuNull(o.telephone_masque),
    motifEchec: texteOuNull(o.motif_echec),
    numeroRecu: texteOuNull(o.numero_recu),
    payizId: texteOuNull(o.payiz_id),
    source: o.source === "manuel" ? "manuel" : "payiz",
    moyenManuel: versMoyenManuel(o.moyen_manuel),
    referenceManuelle: texteOuNull(o.reference_manuelle),
    creeLe: texte(o.cree_le),
    essaiLe: texteOuNull(o.essai_le),
    confirmeLe: texteOuNull(o.confirme_le),
    abonnement: a ? { debut: texte(a.debut), fin: texte(a.fin) } : null,
    ...(typeof o.repris === "boolean" ? { repris: o.repris } : {}),
  };
}

export function versEssaiCode(j: unknown): EssaiCode {
  const o = objet(j);
  if (o.ok === true) return { ok: true, prixInitial: nombre(o.prix_initial), remise: nombre(o.remise), montant: nombre(o.montant) };
  return { ok: false, message: texte(o.message) || "Ce code n’existe pas." };
}
