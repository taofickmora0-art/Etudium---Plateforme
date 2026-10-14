// Types de la modération (spec du 14 octobre 2026, migration 0020).

/** « echec » : l'analyse n'a pas pu se faire (panne, délai, fichier trop lourd) ; la publication paraît et entre dans la file. */
export type Decision = "autoriser" | "signaler" | "bloquer" | "echec";

export const CATEGORIES = ["spam", "harcelement", "haine", "sexuel", "arnaque", "hameconnage", "publicite", "illegal", "hors_sujet", "autre", "aucune"] as const;
export type Categorie = (typeof CATEGORIES)[number];

export type Verdict = { decision: Decision; categorie: Categorie; raison: string };

export const MOTIFS = ["inapproprie", "spam", "harcelement", "autre"] as const;
export type MotifSignalement = (typeof MOTIFS)[number];

/** Lue côté serveur seulement (web/.env.local). */
export type ConfigModeration = { cle: string; jeton: string; modele: string };

/** Ce qui part à l'IA : le titre, le texte, l'espace, et le fichier joint relu depuis le stockage. */
export type ContenuAnalyse = { titre: string; texte: string; espace: string; fichier: { type: string; octets: Uint8Array } | null };
