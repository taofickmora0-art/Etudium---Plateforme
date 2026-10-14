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
export type ContenuAnalyse = {
  titre: string;
  texte: string;
  espace: string;
  fichier: { type: string; octets: Uint8Array } | null;
  /** L'aperçu du premier lien, lu sur la page par le serveur (migration 0021) : la carte que les membres verront. */
  lien?: { url: string; titre: string; description: string };
};

export type OngletFile = "a_examiner" | "bloquees";

/** Le contenu visé par une action de l'équipe : une publication ou une réponse. */
export type CibleModeration = { publicationId: string } | { reponseId: string };

/** Un élément de la file : une publication ou une réponse, ses raisons d'y être, le fichier avec un lien temporaire. */
export type ElementFile = {
  type: "publication" | "reponse";
  id: string;
  publicationId: string;
  espace: { id: string | null; nom: string };
  auteur: { id: string; prenom: string; nom: string };
  creeLe: string;
  titre: string;
  texte: string;
  pieceJointe: { chemin: string; nom: string; type: string; taille: number; url: string | null } | null;
  statut: "publiee" | "en_attente" | "bloquee";
  analyse: { decision: Decision; categorie: Categorie; raison: string } | null;
  /** Pour une réponse : le début de la publication. */
  extrait: string | null;
  signalements: {
    nombre: number;
    motifs: { motif: MotifSignalement; nombre: number }[];
    details: { motif: MotifSignalement; precisions: string; par: string; le: string }[];
  };
};

/** L'état de l'analyse pour le back-office : la base (active, en attente) et le serveur (clé, jeton). */
export type EtatModeration = {
  active: boolean;
  cle: boolean;
  jeton: "reconnu" | "non_reconnu" | "absent";
  derniereAnalyse: string | null;
  enAttente: number;
};
