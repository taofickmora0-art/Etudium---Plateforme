import { getShellUser } from "@/lib/auth/current-user";
import { canAccess } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { lireFicheParAdresse } from "./data";
import type { FicheFormation } from "./types";

/**
 * « Voir comme un étudiant » (refonte des formations, spec §3.5) : une formation pas encore publiée, ouverte par l'équipe
 * ou son formateur ; null pour tout autre compte (un étudiant qui lit une formation archivée qu'il a commencée n'est pas
 * un aperçu) et pour une formation publiée (la page s'ouvre normalement).
 */
export async function ficheApercu(slug: string): Promise<FicheFormation | null> {
  const compte = await getShellUser();
  if (!compte) return null;
  const lue = await lireFicheParAdresse(slug);
  if (!lue || lue.statut === "publiee") return null;
  const fiche: FicheFormation = lue;
  if (canAccess("admin", compte.roles)) return fiche;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("formateur_de", { p_formation: fiche.id });
  return !error && data === true ? fiche : null;
}
