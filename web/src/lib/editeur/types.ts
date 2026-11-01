import type { DocumentLecon } from "@/lib/lecon/document";

// L'éditeur des leçons et des informations d'une formation (fin du lot 4, spec §2) : ce qu'on saisit, ce que la base
// répond à un enregistrement, ce qui attend d'être publié.

/** Ce que l'éditeur d'une leçon enregistre tout seul. */
export type SaisieLecon = {
  titre: string;
  titreCourt: string;
  resume: string;
  pointsCles: string[];
  /** Le lien collé ; la base ne garde que le fournisseur et l'identifiant. */
  lienVideo: string;
  /** « 12:40 ». */
  duree: string;
  document: DocumentLecon;
};

/** Les informations générales d'une formation (les réglages de l'équipe restent à part). */
export type SaisieInfos = {
  titre: string;
  resume: string;
  description: string;
  objectifs: string[];
  competences: string[];
  niveau: "debutant" | "intermediaire" | "avance";
};

export type ResultatSauvegarde =
  | { ok: true; revision: number; brouillon: boolean; enregistreLe: string }
  | { ok: false; code: "conflit"; par: string | null }
  | { ok: false; code: "invalide"; erreurs: Record<string, string> }
  | { ok: false; code: "echec"; message: string };

/** Ce que l'éditeur affiche : le brouillon s'il existe, sinon ce qui est en ligne. */
export type EtatEdition<T> = {
  donnees: T;
  revision: number;
  brouillon: boolean;
  /** Visible des étudiants : les modifications passent par le brouillon. */
  enLigne: boolean;
  modifiePar: string | null;
  modifieLe: string | null;
};

export type ModificationEnAttente = {
  type: "formation" | "lecon";
  id: string;
  titre: string;
  /** La position de la leçon dans la formation (« Leçon 3 ») ; null pour les informations générales. */
  rang: number | null;
  modifiePar: string | null;
  modifieLe: string;
};

export const MIGRATION_EDITEUR = "L’enregistrement automatique n’est pas encore installé (migration 0056, guide « Ce qui te revient », section 58).";
