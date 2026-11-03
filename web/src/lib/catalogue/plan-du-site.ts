import { demoModeActive } from "@/lib/auth/current-user";
import { estFonctionAbsente, liste, texte, verifier } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";

// Les formations et les livres du plan du site (sitemap.xml) : publiés seulement, lus comme le catalogue (un visiteur est
// « anon », règles de la 0004 ; la Bibliothèque, 0074). Juste l'adresse, les dates et la fiche du formateur : ni
// programme ni leçons.

export type FormationDuPlan = { slug: string; publieeLe: string | null; modifieLe: string | null; formateurId: string | null };
export type LivreDuPlan = { slug: string; publieLe: string | null };

/** Aucune en démonstration (sans base) ; une erreur de lecture est levée : le plan garde alors ses pages fixes. */
export async function listFormationsDuPlan(): Promise<FormationDuPlan[]> {
  if (demoModeActive()) return [];
  const supabase = await createClient();
  const lignes = verifier(await supabase.from("formations").select("slug, publiee_le, modifie_le, formateur_id").eq("statut", "publiee"));
  return liste(lignes).map((f) => ({
    slug: texte(f.slug),
    publieeLe: texte(f.publiee_le) || null,
    modifieLe: texte(f.modifie_le) || null,
    formateurId: texte(f.formateur_id) || null,
  }));
}

/**
 * Les livres publiés, lus par le catalogue public de la Bibliothèque (la table des livres n'est lue que par l'équipe).
 * Aucun en démonstration ni sans la 0074 ; une autre erreur est levée : le plan garde alors ses formations.
 */
export async function listLivresDuPlan(): Promise<LivreDuPlan[]> {
  if (demoModeActive()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("bibliotheque_catalogue", { p_recherche: "", p_parcours: null, p_categorie: null, p_gratuits: false });
  if (error) {
    if (estFonctionAbsente(error)) return [];
    throw new Error(`Lecture des livres du plan du site impossible (${error.code ?? "?"}).`);
  }
  const livres = (data as { livres?: unknown } | null)?.livres;
  return liste(livres).map((l) => ({ slug: texte(l.slug), publieLe: texte(l.publie_le) || null }));
}
