import { demoModeActive, getAuthUser } from "@/lib/auth/current-user";
import { estFonctionAbsente, estTablesAbsentes, liste, texte, verifier, type Ligne } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";
import type { AccesFormation, Inscription } from "./types";

// Lectures de l'inscription aux formations (migration 0069 ; spec du 2 novembre 2026, §2 et §4).

/**
 * Les inscriptions du compte connecté, la plus récente d'abord. L'équipe des contenus lit toutes les lignes : on ne
 * demande que les siennes. Un visiteur n'en a aucune ; null sans la migration 0069 ou en démonstration.
 */
export async function lireInscriptions(): Promise<Inscription[] | null> {
  if (demoModeActive()) return null;
  const compte = await getAuthUser();
  if (!compte) return [];
  const supabase = await createClient();
  try {
    const lignes = verifier(
      await supabase.from("inscriptions_formations").select("formation_id, inscrit_le").eq("profil_id", compte.id).order("inscrit_le", { ascending: false }),
    ) as Ligne[] | null;
    return liste(lignes).map((l) => ({ formationId: String(l.formation_id), inscritLe: texte(l.inscrit_le) }));
  } catch (erreur) {
    if (estTablesAbsentes(erreur)) return null;
    throw erreur;
  }
}

/**
 * Le nombre d'inscrits de chaque formation publiée, par identifiant (lisible par tous, visiteurs compris). Null sans la
 * migration 0069 ou en démonstration : les cartes n'affichent pas le nombre d'apprenants.
 */
export async function lireApprenants(): Promise<Record<string, number> | null> {
  if (demoModeActive()) return null;
  const { data, error } = await (await createClient()).rpc("apprenants_formations");
  if (error) {
    if (estFonctionAbsente(error)) return null;
    throw new Error(`Lecture du nombre d’apprenants impossible (${error.code ?? "?"}).`);
  }
  return Object.fromEntries(liste(data).map((l) => [String(l.formation_id), Number(l.apprenants ?? 0)]));
}

/**
 * L'accès du compte connecté à une formation (inscrit_formation et formation_ouverte) : le bouton du haut de la fiche et
 * le verrou d'une leçon fermée faute d'inscription. Null sans la migration 0069 ou en démonstration : les boutons d'avant.
 */
export async function lireAccesFormation(formationId: string): Promise<AccesFormation | null> {
  if (demoModeActive()) return null;
  const supabase = await createClient();
  const [inscrit, ouverte] = await Promise.all([
    supabase.rpc("inscrit_formation", { p_formation: formationId }),
    supabase.rpc("formation_ouverte", { p_formation: formationId }),
  ]);
  for (const { error } of [inscrit, ouverte]) {
    if (!error) continue;
    if (estFonctionAbsente(error)) return null;
    throw new Error(`Lecture de l’inscription impossible (${error.code ?? "?"}).`);
  }
  return { inscrit: inscrit.data === true, ouverte: ouverte.data === true };
}
