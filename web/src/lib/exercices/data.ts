import { estFonctionAbsente, liste, un } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";
import type { Lecture } from "@/lib/utilisateurs/types";
import { MIGRATION_EXERCICES, versCorrection, versExercice, versExerciceListe, versRenduACorriger, versStatut } from "./conversion";
import type { CorrectionAFaire, ExerciceEtudiant, ExerciceListe, RenduACorriger, StatutRendu } from "./types";

// Les lectures des exercices (migration 0032). La base vérifie l'accès : l'étudiant ne lit que ses rendus ; un travail
// ne se lit que par ses correcteurs (formateur de la formation, équipe).

export { MIGRATION_EXERCICES };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** L'exercice de l'étudiant ; null sans accès, si ce n'est pas un exercice, ou avant la 0032. */
export async function lireExercice(leconId: string): Promise<ExerciceEtudiant | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("exercice_etudiant", { p_lecon: leconId });
  if (error) {
    if (estFonctionAbsente(error)) return null;
    throw new Error(`Lecture de l’exercice impossible : ${error.message ?? error.code}`);
  }
  return versExercice(data);
}

/** La page « Exercices » : les exercices où le compte a rendu au moins une fois. */
export async function lireMesExercices(): Promise<Lecture<ExerciceListe[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mes_exercices");
  if (error) {
    if (estFonctionAbsente(error)) return { migrationAbsente: true };
    throw new Error(`Lecture des exercices impossible : ${error.message ?? error.code}`);
  }
  return { migrationAbsente: false, donnees: liste(data).map(versExerciceListe) };
}

/** Le dernier statut du compte à chaque exercice d'une formation ; vide avant la 0032 ou en cas d'erreur (simple affichage). */
export async function lireStatutsExercices(formationId: string): Promise<Record<string, StatutRendu>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mes_statuts_exercices", { p_formation: formationId });
  if (error) return {};
  return Object.fromEntries(Object.entries(un(data) ?? {}).map(([cle, valeur]) => [cle, versStatut(valeur)]));
}

/** Les travaux à corriger (formateur de la formation, équipe), les plus anciens d'abord. */
export async function lireCorrections(): Promise<Lecture<CorrectionAFaire[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("corrections_a_faire");
  if (error) {
    if (estFonctionAbsente(error)) return { migrationAbsente: true };
    throw new Error(`Lecture des corrections impossible : ${error.message ?? error.code}`);
  }
  return { migrationAbsente: false, donnees: liste(data).map(versCorrection) };
}

/** Un travail à corriger ; null sans droit, introuvable, ou avant la 0032. */
export async function lireRenduACorriger(renduId: string): Promise<RenduACorriger | null> {
  if (!UUID.test(renduId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rendu_a_corriger", { p_rendu: renduId });
  if (error) {
    if (estFonctionAbsente(error)) return null;
    throw new Error(`Lecture du travail impossible : ${error.message ?? error.code}`);
  }
  return versRenduACorriger(data);
}
