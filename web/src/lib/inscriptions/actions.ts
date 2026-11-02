"use server";

import { revalidatePath } from "next/cache";
import { getShellUser } from "@/lib/auth/current-user";
import { estFonctionAbsente } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";

// « S'inscrire à ce cours » (migration 0069 ; spec du 2 novembre 2026, §2 et §5) : la base vérifie tout (compte connecté,
// non suspendu, pas formateur ; formation publiée et ouverte au compte) et refuse en français. Rejouable.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION_EXPIREE = "Votre session a expiré. Reconnectez-vous.";
const INSCRIPTION_ECHEC = "L’inscription n’a pas abouti. Réessayez.";
const MIGRATION_INSCRIPTIONS = "Appliquez la migration 0069 (guide « Ce qui te revient », section 68).";

/** Inscrit le compte connecté à la formation ; la fiche, ses leçons, « Mes formations », le catalogue et les favoris se relisent. */
export async function sInscrireFormation(formationId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!(await getShellUser())) return { ok: false, message: SESSION_EXPIREE };
  if (typeof formationId !== "string" || !UUID.test(formationId)) return { ok: false, message: INSCRIPTION_ECHEC };
  const supabase = await createClient();
  const { error } = await supabase.rpc("s_inscrire_formation", { p_formation: formationId });
  if (error) {
    if (estFonctionAbsente(error)) return { ok: false, message: MIGRATION_INSCRIPTIONS };
    // Le refus de la base (P0001, 42501) est écrit pour l'étudiant.
    if ((error.code === "P0001" || error.code === "42501") && error.message) return { ok: false, message: error.message.replace(/'/g, "’") };
    return { ok: false, message: INSCRIPTION_ECHEC };
  }
  // Les cadenas tombent : la fiche et ses leçons, puis les listes où la formation devient « à moi ».
  revalidatePath("/formations/[slug]", "page");
  revalidatePath("/formations/[slug]/lecons/[leconId]", "page");
  revalidatePath("/mes-formations");
  revalidatePath("/formations");
  revalidatePath("/favoris");
  return { ok: true };
}
