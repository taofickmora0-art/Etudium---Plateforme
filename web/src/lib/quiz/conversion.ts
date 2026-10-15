import { liste, texte, textes, un } from "@/lib/contenus/lecture";
import { GENRES, type CorrectionQuestion, type GenreQuestion, type QuestionQuiz, type QuizAPasser, type ResultatQuiz } from "./types";

// Les réponses des fonctions de la 0031, converties pour l'appli.

export const MIGRATION_QUIZ = "Appliquez la migration 0031 (guide « Ce qui te revient », section 37).";

const nombre = (valeur: unknown) => Number(valeur) || 0;
const genre = (valeur: unknown): GenreQuestion => (GENRES.includes(valeur as GenreQuestion) ? (valeur as GenreQuestion) : "unique");

export const versQuestionQuiz = (q: Record<string, unknown>): QuestionQuiz => ({
  id: texte(q.id) || undefined,
  genre: genre(q.genre),
  enonce: texte(q.enonce),
  choix: liste(q.choix).map((c) => ({ texte: texte(c.texte), correcte: c.correcte === true })),
  reponses: textes(q.reponses),
  explication: texte(q.explication),
});

export function versQuizAPasser(data: unknown): QuizAPasser | null {
  const brut = un(data);
  if (!brut) return null;
  return {
    scoreMinimal: nombre(brut.score_minimal),
    meilleur: brut.meilleur === null || brut.meilleur === undefined ? null : nombre(brut.meilleur),
    tentatives: nombre(brut.tentatives),
    questions: liste(brut.questions).map((q) => ({ id: texte(q.id), genre: genre(q.genre), enonce: texte(q.enonce), choix: textes(q.choix) })),
  };
}

const versCorrection = (d: Record<string, unknown>): CorrectionQuestion => ({
  questionId: texte(d.question_id),
  enonce: texte(d.enonce),
  genre: genre(d.genre),
  votreReponse: texte(d.votre_reponse),
  correcte: d.correcte === true,
  bonneReponse: texte(d.bonne_reponse),
  explication: texte(d.explication),
});

export function versResultat(data: unknown): ResultatQuiz {
  const brut = un(data) ?? {};
  return {
    score: nombre(brut.score),
    bonnes: nombre(brut.bonnes),
    total: nombre(brut.total),
    reussi: brut.reussi === true,
    meilleur: nombre(brut.meilleur),
    numero: nombre(brut.numero),
    scoreMinimal: nombre(brut.score_minimal),
    detail: liste(brut.detail).map(versCorrection),
  };
}
