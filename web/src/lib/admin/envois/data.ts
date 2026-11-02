import { configurationEnvois } from "@/lib/envois/config";
import { createClient } from "@/lib/supabase/server";
import type { EtatEnvois } from "./types";

export type { EtatEnvois } from "./types";

/**
 * L'état des envois pour le back-office (0071) : la base dit si le jeton du serveur, tiré de sa clé, est celui
 * enregistré par « Activer les envois ». Sans clé, pas d'appel. Jamais la clé ni le jeton dans le résultat.
 */
export async function lireEtatEnvois(): Promise<EtatEnvois> {
  const config = configurationEnvois();
  if (!config) return { etat: "sans_cle", email: false, push: false };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("etat_envois", { p_jeton: config.jeton });
  return { etat: !error && data === "actifs" ? "actifs" : "a_activer", email: config.email !== null, push: config.push !== null };
}
