import { demoModeActive } from "@/lib/auth/current-user";
import { estTablesAbsentes, liste, texte, verifier, type Ligne } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";

/**
 * Les favoris du compte connecté (les règles de la base ne rendent que les siens), le plus récent d'abord.
 * Null si la table n'est pas encore dans la base (migration 0009).
 */
export async function lireFavoris(): Promise<{ formationId: string; ajouteLe: string }[] | null> {
  if (demoModeActive()) return null;
  const supabase = await createClient();
  try {
    const lignes = verifier(await supabase.from("favoris").select("formation_id, ajoute_le").order("ajoute_le", { ascending: false })) as Ligne[] | null;
    return liste(lignes).map((l) => ({ formationId: String(l.formation_id), ajouteLe: texte(l.ajoute_le) }));
  } catch (erreur) {
    if (estTablesAbsentes(erreur)) return null;
    throw erreur;
  }
}
