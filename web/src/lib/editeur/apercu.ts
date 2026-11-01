import type { SupabaseClient } from "@supabase/supabase-js";
import type { FicheFormation } from "@/lib/catalogue/types";
import { createClient } from "@/lib/supabase/server";
import { versSaisieInfos } from "./saisie";

// L'aperçu des brouillons (fin du lot 4, spec §2.3) : l'équipe et le formateur de la formation voient, sur la page leçon
// et sur la fiche, ce qu'ils ont modifié et pas encore publié. La règle de lecture des brouillons (0056) ne les donne
// qu'à eux : pour un étudiant, ces lectures ne trouvent rien, et il voit ce qui est en ligne.

/** Les données du brouillon d'une leçon, ou null (aucun, pas lisible, ou avant la 0056). */
export async function brouillonDeLecon(supabase: SupabaseClient, leconId: string): Promise<Record<string, unknown> | null> {
  try {
    const { data, error } = await supabase.from("brouillons_lecons").select("donnees").eq("lecon_id", leconId).maybeSingle();
    if (error || !data) return null;
    const donnees = (data as { donnees?: unknown }).donnees;
    return donnees && typeof donnees === "object" ? (donnees as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** La fiche avec les informations générales de son brouillon, pour qui peut le lire. */
export async function avecBrouillonFormation(fiche: FicheFormation): Promise<{ fiche: FicheFormation; brouillon: boolean }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("brouillons_formations").select("donnees").eq("formation_id", fiche.id).maybeSingle();
    if (error || !data) return { fiche, brouillon: false };
    const infos = versSaisieInfos((data as { donnees?: unknown }).donnees);
    return { fiche: { ...fiche, ...infos }, brouillon: true };
  } catch {
    return { fiche, brouillon: false };
  }
}
