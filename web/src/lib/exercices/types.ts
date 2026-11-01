import type { DocumentLecon } from "@/lib/lecon/document";
// Les exercices (lot 3, étape B ; migration 0032) : un élément du programme, de type « exercice ».

export type GenreExercice = "simple" | "rendu";
export type StatutRendu = "en_attente" | "a_corriger" | "valide";

export const LIBELLES_STATUT: Record<StatutRendu, string> = { en_attente: "En attente", a_corriger: "À corriger", valide: "Validé" };

/** Une version déposée (ou, pour un exercice simple, « terminé ») et sa correction. */
export type VersionRendu = {
  id: string;
  version: number;
  nomFichier: string;
  format: string;
  tailleOctets: number;
  message: string;
  statut: StatutRendu;
  /** La remarque (à corriger) ou le commentaire (validé) du correcteur. */
  remarque: string;
  correcteur: string | null;
  corrigeLe: string | null;
  creeLe: string;
  aUnFichier: boolean;
};

/** L'exercice vu par l'étudiant : son dernier statut et ses versions, de la plus récente à la plus ancienne. */
export type ExerciceEtudiant = { genre: GenreExercice; statut: StatutRendu | null; peutDeposer: boolean; versions: VersionRendu[] };

/** Une ligne de la page « Exercices ». */
export type ExerciceListe = {
  leconId: string;
  titre: string;
  genre: GenreExercice;
  formation: string;
  slug: string;
  module: string;
  moduleRang: number;
  statut: StatutRendu;
  version: number;
  remarque: string;
  correcteur: string | null;
  corrigeLe: string | null;
  creeLe: string;
};

/** Un travail en attente, dans la page « Corrections ». */
export type CorrectionAFaire = {
  renduId: string;
  etudiant: string;
  exercice: string;
  formation: string;
  formationId: string;
  module: string;
  moduleRang: number;
  version: number;
  nomFichier: string;
  deposeLe: string;
};

/** Un travail à corriger, avec l'exercice et l'historique de l'étudiant. */
export type RenduACorriger = {
  etudiant: string;
  exercice: { id: string; titre: string; genre: GenreExercice; consigne: string; consigneDocument?: DocumentLecon | null };
  /** Le lien signé de chaque image de la consigne riche (0055). */
  images?: Record<string, string>;
  formation: { id: string; titre: string; slug: string };
  module: { titre: string; rang: number };
  version: VersionRendu;
  /** La dernière version de l'étudiant : seule elle se corrige. */
  derniere: boolean;
  historique: VersionRendu[];
  /** Le travail en attente suivant, s'il y en a un. */
  suivant: string | null;
};
