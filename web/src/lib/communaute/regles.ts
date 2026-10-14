import type { Curseur } from "./types";

// Règles de la communauté, recopiées de la migration 0019 : le navigateur refuse tôt, la base revérifie tout.

export const TITRE_MAX = 120;
export const TEXTE_MAX = 3000;
export const REPONSE_MAX = 1000;
/** 10 Mo, la limite de l'espace de stockage « communaute ». */
export const PIECE_MAX_OCTETS = 10_485_760;
export const TYPES_PIECE = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const NOMBRE_FIL = 20;

export const REFUS_TEXTE = "Écrivez votre publication (3 000 caractères au plus).";
export const REFUS_TITRE = "Le titre dépasse 120 caractères.";
export const REFUS_REPONSE = "Écrivez votre réponse (1 000 caractères au plus).";
export const REFUS_PIECE = "Joignez une image (JPEG, PNG ou WebP) ou un PDF de 10 Mo au plus.";

/** Le message de la base, ou null ; le texte d'abord, comme elle. */
export function refusPublication(titre: string, texte: string): string | null {
  const t = texte.trim();
  if (t.length < 1 || t.length > TEXTE_MAX) return REFUS_TEXTE;
  if (titre.trim().length > TITRE_MAX) return REFUS_TITRE;
  return null;
}

export function refusReponse(texte: string): string | null {
  const t = texte.trim();
  return t.length < 1 || t.length > REPONSE_MAX ? REFUS_REPONSE : null;
}

export function refusPiece(type: string, taille: number): string | null {
  return TYPES_PIECE.includes(type) && taille >= 1 && taille <= PIECE_MAX_OCTETS ? null : REFUS_PIECE;
}

/** « 240 Ko », « 1,2 Mo » : des kilo-octets de 1 024, comme l'explorateur de fichiers. */
export function tailleLisible(octets: number): string {
  if (octets < 1_048_576) return `${Math.max(1, Math.round(octets / 1024))} Ko`;
  return `${(octets / 1_048_576).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}

/** « Koffi D. », comme la base (nom_avis) : jamais le nom entier d'un membre sous une réponse. */
export function nomCourt(prenom: string, nom: string): string {
  const p = prenom.trim();
  const n = nom.trim();
  if (!p) return "Membre d’Étudium";
  return n ? `${p} ${n.charAt(0).toUpperCase()}.` : p;
}

/** « Espace général », « Espace Académique ». */
export function nomEspace(espace: { id: string | null; nom: string }): string {
  return `Espace ${espace.nom}`;
}

/** Où reprendre le fil : après la dernière publication affichée. */
export function curseur(derniere: { id: string; creeLe: string }): Curseur {
  return { avant: derniere.creeLe, avantId: derniere.id };
}
