// Les quiz (lot 3, étape A ; migration 0031) : un élément du programme, de type « quiz ».

export type GenreQuestion = "unique" | "multiple" | "vrai_faux" | "courte";
export const GENRES: GenreQuestion[] = ["unique", "multiple", "vrai_faux", "courte"];

/** Une question telle que l'éditeur l'écrit (avec ses bonnes réponses). */
export type QuestionQuiz = {
  id?: string;
  genre: GenreQuestion;
  enonce: string;
  /** Choix unique, réponses multiples, vrai ou faux ; vide pour une réponse courte. */
  choix: { texte: string; correcte: boolean }[];
  /** Les réponses acceptées d'une réponse courte. */
  reponses: string[];
  explication: string;
};

/** Une question telle que l'étudiant la voit : sans les bonnes réponses. */
export type QuestionAPasser = { id: string; genre: GenreQuestion; enonce: string; choix: string[] };

export type QuizAPasser = { scoreMinimal: number; questions: QuestionAPasser[]; meilleur: number | null; tentatives: number };

/** Les réponses envoyées : les indices des choix, ou le texte d'une réponse courte. */
export type ReponsesQuiz = Record<string, number[] | string>;

export type CorrectionQuestion = {
  questionId: string;
  enonce: string;
  genre: GenreQuestion;
  votreReponse: string;
  correcte: boolean;
  bonneReponse: string;
  explication: string;
};

export type ResultatQuiz = {
  score: number;
  bonnes: number;
  total: number;
  reussi: boolean;
  meilleur: number;
  numero: number;
  scoreMinimal: number;
  detail: CorrectionQuestion[];
};
