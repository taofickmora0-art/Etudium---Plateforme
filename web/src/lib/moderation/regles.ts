import { MOTIFS, type Categorie, type MotifSignalement } from "./types";

// Règles et textes de la modération (spec, §3 à §5). Sans dépendance serveur : les écrans s'en servent aussi.

export { MOTIFS };

export const LIBELLES_CATEGORIES: Record<Categorie, string> = {
  spam: "Spam",
  harcelement: "Harcèlement",
  haine: "Haine",
  sexuel: "Contenu sexuel ou inapproprié",
  arnaque: "Arnaque",
  hameconnage: "Hameçonnage",
  publicite: "Publicité abusive",
  illegal: "Contenu illégal",
  hors_sujet: "Hors sujet",
  autre: "Autre violation des règles",
  aucune: "Aucune",
};

export const LIBELLES_MOTIFS: Record<MotifSignalement, string> = {
  inapproprie: "Contenu inapproprié",
  spam: "Spam ou publicité",
  harcelement: "Harcèlement",
  autre: "Autre",
};

export const PRECISIONS_MAX = 500;
/** Au-delà, un PDF n'est pas envoyé à l'IA : « analyse impossible ». */
export const PDF_ANALYSE_MAX = 5_242_880;
export const IMAGE_COTE_MAX = 1568;
export const DELAI_ANALYSE_MS = 20_000;

/** Le libellé d'une catégorie ; une valeur inconnue est une « autre violation ». */
export const libelleCategorie = (categorie: string | null | undefined) =>
  LIBELLES_CATEGORIES[(categorie ?? "") as Categorie] ?? LIBELLES_CATEGORIES.autre;

/** Le message de la base, ou null. */
export function refusSignalement(motif: MotifSignalement, precisions: string): string | null {
  const p = precisions.trim();
  if (motif === "autre" && !p) return "Précisez le motif du signalement.";
  if (p.length > PRECISIONS_MAX) return "500 caractères au plus pour les précisions.";
  return null;
}

/** Ce que lit l'auteur d'une publication (ou d'une modification) bloquée par l'analyse. */
export function messageBloquee(categorie: string | null | undefined): string {
  const libelle = categorie === "aucune" ? LIBELLES_CATEGORIES.autre : libelleCategorie(categorie);
  return `Votre publication n’a pas été publiée : elle semble enfreindre les règles de la communauté (${libelle}). Si c’est une erreur, l’équipe Étudium pourra la rétablir.`;
}
