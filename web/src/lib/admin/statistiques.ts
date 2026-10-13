import { demoModeActive } from "@/lib/auth/current-user";
import { estFonctionAbsente, liste, texte } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";

// Chiffres du tableau de bord du back-office (migration 0011), réservés à l'équipe. Revenus, abonnés et sessions live
// arrivent avec leurs lots (2 et 5) : leurs tuiles ont déjà leur place à l'écran.

export type StatistiquesBackOffice = {
  utilisateurs: number;
  inscritsSemaine: number;
  inscritsMois: number;
  inscritsMoisPrecedent: number;
  /** Moyenne des pourcentages des formations commencées ; null sans formation commencée. */
  progressionMoyenne: number | null;
  /** Les 5 formations publiées commencées par le plus d'étudiants. */
  formationsSuivies: { titre: string; slug: string; etudiants: number }[];
};

/** Croissance du mois, en % : les nouveaux inscrits rapportés aux inscrits du début du mois ; null sans base. */
export function croissance({ utilisateurs, inscritsMois }: Pick<StatistiquesBackOffice, "utilisateurs" | "inscritsMois">): number | null {
  const debut = utilisateurs - inscritsMois;
  return debut > 0 ? Math.round((100 * inscritsMois) / debut) : null;
}

const nombre = (valeur: unknown) => Number(valeur ?? 0) || 0;

/** Les chiffres de la plateforme ; null sans la migration 0011 (l'écran le dit). */
export async function lireStatistiques(): Promise<StatistiquesBackOffice | null> {
  if (demoModeActive()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("statistiques_back_office");
  if (error) {
    if (estFonctionAbsente(error)) return null;
    throw new Error(error.message ?? "Lecture des statistiques impossible.");
  }
  const d = (data ?? {}) as Record<string, unknown>;
  return {
    utilisateurs: nombre(d.utilisateurs),
    inscritsSemaine: nombre(d.inscrits_semaine),
    inscritsMois: nombre(d.inscrits_mois),
    inscritsMoisPrecedent: nombre(d.inscrits_mois_precedent),
    progressionMoyenne: d.progression_moyenne === null || d.progression_moyenne === undefined ? null : nombre(d.progression_moyenne),
    formationsSuivies: liste(d.formations_suivies).map((f) => ({ titre: texte(f.titre), slug: texte(f.slug), etudiants: nombre(f.etudiants) })),
  };
}
