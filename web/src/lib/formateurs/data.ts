import { cache } from "react";
import { demoModeActive } from "@/lib/auth/current-user";
import { estFonctionAbsente } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";
import { MIGRATION_FORMATEURS, versFormateurPublic } from "./conversion";
import type { FormateurPublic } from "./types";

// Lecture du formateur public (migration 0070) : sa fiche, lisible par tous (visiteurs compris), par formateur_public.

export { MIGRATION_FORMATEURS };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * La fiche publique d'un formateur ; null si elle n'existe pas (ou en démonstration) ; « absente » sans la migration
 * 0070. Lue une seule fois par requête : la page et ses métadonnées la demandent toutes deux.
 */
export const lireFormateurPublic = cache(async (id: string): Promise<FormateurPublic | null | "absente"> => {
  if (demoModeActive() || !UUID.test(id)) return null;
  const { data, error } = await (await createClient()).rpc("formateur_public", { p_formateur: id });
  if (error) {
    if (estFonctionAbsente(error)) return "absente";
    throw new Error(`Lecture de la fiche du formateur impossible (${error.code ?? "?"}).`);
  }
  return versFormateurPublic(data);
});
