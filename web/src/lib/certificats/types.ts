// Les certificats (lot 3, étape C ; migration 0033).

import type { StatutRendu } from "@/lib/exercices/types";

/** Ce que montre un certificat, figé au jour de sa délivrance. */
export type Certificat = {
  identifiant: string;
  titulaire: string;
  formation: string;
  formateur: string;
  parcours: string;
  /** « 2026-10-15 » (jour au Bénin). */
  delivreLe: string;
};

export type QuizValidation = { id: string; titre: string; meilleur: number | null; reussi: boolean };
export type ExerciceValidation = { id: string; titre: string; statut: StatutRendu | null; valide: boolean };

/** La page « Validation de votre formation » : chaque condition, et le certificat s'il est délivré. */
export type EtatValidation = {
  lecons: { terminees: number; total: number };
  minimum: number;
  exercicesObligatoires: boolean;
  quiz: QuizValidation[];
  exercices: ExerciceValidation[];
  complet: boolean;
  certificat: (Certificat & { vu: boolean }) | null;
};

export type EnPreparation = { formationId: string; titre: string; slug: string; terminees: number; total: number; quizRestants: number; exercicesRestants: number };

/** La page « Certificats ». */
export type PageCertificats = { obtenus: (Certificat & { slug: string | null })[]; enPreparation: EnPreparation[] };

/** La fiche d'un étudiant, côté formateur : par formation commencée. */
export type Lot3Etudiant = { formationId: string; quiz: QuizValidation[]; exercices: ExerciceValidation[]; certificat: string | null };
