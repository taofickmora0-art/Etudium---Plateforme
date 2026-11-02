import { demoModeActive } from "@/lib/auth/current-user";
import { estFonctionAbsente } from "@/lib/contenus/lecture";
import { DEMO_JEU } from "@/lib/demo-user";
import { createClient } from "@/lib/supabase/server";
import { versProgressionJeu } from "./regles";
import type { ProgressionJeu } from "./types";

/**
 * La progression du jeu du compte connecté (ma_progression_jeu, 0063) : celle du design en démonstration ; null si la
 * migration manque (la page le dit). Une autre erreur remonte à la page d'erreur (« Réessayer »).
 */
export async function lireProgressionJeu(): Promise<ProgressionJeu | null> {
  if (demoModeActive()) return DEMO_JEU;
  const { data, error } = await (await createClient()).rpc("ma_progression_jeu");
  if (error) {
    if (estFonctionAbsente(error)) return null;
    throw new Error(`Lecture de la progression impossible (${error.code ?? "?"}).`);
  }
  return versProgressionJeu(data);
}
