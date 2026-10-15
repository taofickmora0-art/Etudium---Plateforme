import { liste, texte, un } from "@/lib/contenus/lecture";
import { versStatut } from "@/lib/exercices/conversion";
import type { Certificat, EtatValidation, ExerciceValidation, Lot3Etudiant, PageCertificats, QuizValidation } from "./types";

// Les réponses des fonctions de la 0033, converties pour l'appli.

export const MIGRATION_CERTIFICATS = "Appliquez la migration 0033 (guide « Ce qui te revient », section 39).";

const nombre = (valeur: unknown) => Number(valeur) || 0;

export const versCertificat = (c: Record<string, unknown>): Certificat => ({
  identifiant: texte(c.identifiant),
  titulaire: texte(c.titulaire),
  formation: texte(c.formation),
  formateur: texte(c.formateur),
  parcours: texte(c.parcours),
  delivreLe: texte(c.delivre_le),
});

const versQuiz = (q: Record<string, unknown>): QuizValidation => ({
  id: texte(q.id),
  titre: texte(q.titre),
  meilleur: q.meilleur === null || q.meilleur === undefined ? null : nombre(q.meilleur),
  reussi: q.reussi === true,
});

const versExercice = (x: Record<string, unknown>): ExerciceValidation => ({
  id: texte(x.id),
  titre: texte(x.titre),
  statut: x.statut === null || x.statut === undefined ? null : versStatut(x.statut),
  valide: x.valide === true,
});

export function versEtatValidation(data: unknown): EtatValidation | null {
  const brut = un(data);
  if (!brut) return null;
  const lecons = un(brut.lecons) ?? {};
  const certificat = un(brut.certificat);
  return {
    lecons: { terminees: nombre(lecons.terminees), total: nombre(lecons.total) },
    minimum: nombre(brut.minimum),
    exercicesObligatoires: brut.exercices_obligatoires !== false,
    quiz: liste(brut.quiz).map(versQuiz),
    exercices: liste(brut.exercices).map(versExercice),
    complet: brut.complet === true,
    certificat: certificat ? { ...versCertificat(certificat), vu: certificat.vu === true } : null,
  };
}

export function versPageCertificats(data: unknown): PageCertificats {
  const brut = un(data) ?? {};
  return {
    obtenus: liste(brut.obtenus).map((c) => ({ ...versCertificat(c), slug: texte(c.slug) || null })),
    enPreparation: liste(brut.en_preparation).map((e) => ({
      formationId: texte(e.formation_id),
      titre: texte(e.titre),
      slug: texte(e.slug),
      terminees: nombre(e.terminees),
      total: nombre(e.total),
      quizRestants: nombre(e.quiz_restants),
      exercicesRestants: nombre(e.exercices_restants),
    })),
  };
}

export const versLot3Etudiant = (f: Record<string, unknown>): Lot3Etudiant => ({
  formationId: texte(f.formation_id),
  quiz: liste(f.quiz).map(versQuiz),
  exercices: liste(f.exercices).map(versExercice),
  certificat: texte(f.certificat) || null,
});
