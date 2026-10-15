import { estFonctionAbsente, liste, un } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";
import type { Lecture } from "@/lib/utilisateurs/types";
import { MIGRATION_QUIZ, versQuestionQuiz, versQuizAPasser } from "./conversion";
import type { QuestionQuiz, QuizAPasser } from "./types";

// Les lectures des quiz (migration 0031). La base vérifie l'accès : le quiz à passer ne contient jamais les bonnes
// réponses ; les questions complètes ne vont qu'à l'éditeur (équipe, formateur de la formation).

export { MIGRATION_QUIZ };

/** Le quiz à passer ; null sans accès, si ce n'est pas un quiz, ou avant la 0031. */
export async function lireQuizAPasser(leconId: string): Promise<QuizAPasser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("quiz_a_passer", { p_lecon: leconId });
  if (error) {
    if (estFonctionAbsente(error)) return null;
    throw new Error(`Lecture du quiz impossible : ${error.message ?? error.code}`);
  }
  return versQuizAPasser(data);
}

/** Les questions de l'éditeur, avec leurs bonnes réponses ; migrationAbsente avant la 0031. */
export async function lireQuizEditeur(leconId: string): Promise<Lecture<QuestionQuiz[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("quiz_editeur", { p_lecon: leconId });
  if (error) {
    if (estFonctionAbsente(error)) return { migrationAbsente: true };
    throw new Error(`Lecture des questions impossible : ${error.message ?? error.code}`);
  }
  return { migrationAbsente: false, donnees: liste(un(data)?.questions).map(versQuestionQuiz) };
}

/**
 * Le meilleur score du compte à chaque quiz d'une formation ; vide avant la 0031 ou pour un visiteur. Une lecture qui
 * échoue cache seulement les scores (la page de la formation ou de la leçon s'affiche), avec une trace.
 */
export async function lireMesScores(formationId: string): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mes_scores_quiz", { p_formation: formationId });
  if (error) {
    if (!estFonctionAbsente(error)) console.error(`Lecture des scores impossible : ${error.message ?? error.code}`);
    return {};
  }
  const brut = un(data) ?? {};
  return Object.fromEntries(Object.entries(brut).map(([cle, valeur]) => [cle, Number(valeur) || 0]));
}
