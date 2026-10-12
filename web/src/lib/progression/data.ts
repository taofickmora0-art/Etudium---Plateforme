import { demoModeActive } from "@/lib/auth/current-user";
import { estTablesAbsentes, liste, texte, un, verifier, type Ligne } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";
import type { LigneProgression } from "./types";

/**
 * Les lignes de progression du compte connecté (les règles de la base ne rendent que les siennes), avec la formation de
 * chaque leçon. Null si les tables ne sont pas encore dans la base (0007, 0008) : la progression ne s'affiche pas.
 */
export async function lireProgression(): Promise<LigneProgression[] | null> {
  if (demoModeActive()) return null;
  const supabase = await createClient();
  try {
    const lignes = verifier(
      await supabase.from("progression_lecons").select("lecon_id, terminee_le, vue_le, position_secondes, lecons!inner(modules!inner(formation_id))"),
    ) as Ligne[] | null;
    return liste(lignes).map((l) => ({
      leconId: String(l.lecon_id),
      formationId: texte(un(un(l.lecons)?.modules)?.formation_id),
      termineeLe: texte(l.terminee_le) || null,
      vueLe: texte(l.vue_le),
      positionSecondes: Number(l.position_secondes ?? 0),
    }));
  } catch (erreur) {
    if (estTablesAbsentes(erreur)) return null;
    throw erreur;
  }
}
