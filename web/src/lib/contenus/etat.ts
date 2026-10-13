import type { TagTone } from "@/components/ui/Tag";
import type { StatutFormation } from "./libelles";

// État affiché d'une formation (spec de l'espace formateur, §2) : le statut enregistré, complété par la relecture.
// Un brouillon envoyé par son formateur attend la validation d'un admin ; renvoyé avec une remarque, il est à corriger.

export type EtatFormation = "brouillon" | "en_attente" | "a_corriger" | "publiee" | "archivee";

export function etatFormation(f: { statut: StatutFormation; envoyeeLe: string | null; renvoyeeLe: string | null }): EtatFormation {
  if (f.statut !== "brouillon") return f.statut;
  if (f.envoyeeLe) return "en_attente";
  if (f.renvoyeeLe) return "a_corriger";
  return "brouillon";
}

export const ETATS: Record<EtatFormation, string> = {
  brouillon: "Brouillon",
  en_attente: "En attente de validation",
  a_corriger: "À corriger",
  publiee: "Publiée",
  archivee: "Archivée",
};

export const TON_ETAT: Record<EtatFormation, TagTone> = {
  brouillon: "enAttente",
  en_attente: "populaire",
  a_corriger: "echoue",
  publiee: "valide",
  archivee: "aCorriger",
};

/** Filtres de la liste des formations du back-office (« toutes » n'en est pas un : rien n'est filtré). */
export type FiltreEtat = "en_attente" | "brouillon" | "publiee" | "archivee";

/** « Brouillons » réunit les brouillons et ceux à corriger : ni en ligne, ni en attente de l'équipe. */
export function correspondAuFiltre(etat: EtatFormation, filtre: FiltreEtat): boolean {
  return filtre === "brouillon" ? etat === "brouillon" || etat === "a_corriger" : etat === filtre;
}
