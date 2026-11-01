import type { SupabaseClient } from "@supabase/supabase-js";

// Les images du contenu riche (fin du lot 4, spec §1.2) : un espace privé ; chaque affichage passe par un lien signé
// d'une heure, que la règle de stockage n'accorde qu'à qui a accès à la formation (0055).

export const ESPACE_IMAGES = "images_lecons";
const DUREE_S = 3600;

/** Le lien signé de chaque image, en un appel ; une image refusée ou absente est laissée de côté. */
export async function signerImages(supabase: SupabaseClient, chemins: string[]): Promise<Record<string, string>> {
  const uniques = [...new Set(chemins)];
  if (uniques.length === 0) return {};
  try {
    const { data, error } = await supabase.storage.from(ESPACE_IMAGES).createSignedUrls(uniques, DUREE_S);
    if (error || !data) return {};
    return Object.fromEntries(data.filter((d) => d.path && d.signedUrl && !d.error).map((d) => [d.path as string, d.signedUrl]));
  } catch {
    return {};
  }
}
