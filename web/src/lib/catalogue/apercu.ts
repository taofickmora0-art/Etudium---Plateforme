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

/**
 * L'éditeur d'une formation : celui du back-office pour l'équipe, celui de l'espace formateur pour le formateur de la
 * formation ; null pour tout autre compte (refonte des formations, §1.3 et §2).
 */
export async function editeurFormation(formationId: string): Promise<string | null> {
  const compte = await getShellUser();
  if (!compte) return null;
  if (canAccess("admin", compte.roles)) return `/admin/formations/${formationId}`;
  if (!canAccess("formateur", compte.roles)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("formateur_de", { p_formation: formationId });
  return !error && data === true ? `/formateur/formations/${formationId}` : null;
}

/** « Modifier la leçon », au-dessus du titre de la leçon. */
export async function lienModifierLecon(formationId: string, leconId: string): Promise<string | null> {
  const editeur = await editeurFormation(formationId);
  return editeur && `${editeur}/lecons/${leconId}`;
}

/** « Modifier les leçons », sur la page du cours : l'onglet « Leçons » de l'éditeur. */
export async function lienModifierLecons(formationId: string): Promise<string | null> {
  const editeur = await editeurFormation(formationId);
  return editeur && `${editeur}?onglet=programme`;
}
