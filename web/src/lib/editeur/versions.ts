import { estFonctionAbsente } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";
import type { Lecture } from "@/lib/utilisateurs/types";
import type { VersionFormation } from "./types";

/** L'historique d'une formation (0057), la plus récente d'abord ; avant la 0057, la migration manque. */
export async function lireVersions(formationId: string): Promise<Lecture<VersionFormation[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("versions_formation", { p_formation: formationId });
  if (error) {
    if (estFonctionAbsente(error)) return { migrationAbsente: true };
    throw new Error(`Lecture de l’historique impossible : ${error.message ?? error.code}`);
  }
  const lignes = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  return {
    migrationAbsente: false,
    donnees: lignes.map((v) => ({
      id: String(v.id ?? ""),
      numero: Number(v.numero ?? 0),
      creeLe: typeof v.cree_le === "string" ? v.cree_le : "",
      auteur: typeof v.auteur === "string" ? v.auteur : null,
      resume: typeof v.resume === "string" ? v.resume : "",
      enLigne: v.en_ligne === true,
    })),
  };
}
