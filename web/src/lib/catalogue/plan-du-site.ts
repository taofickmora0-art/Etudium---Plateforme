import { demoModeActive } from "@/lib/auth/current-user";
import { liste, texte, verifier } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";

// Les formations du plan du site (sitemap.xml) : publiées seulement, lues comme le catalogue (un visiteur est « anon »,
// règles de la 0004). Juste l'adresse, les dates et la fiche du formateur : ni programme ni leçons.

export type FormationDuPlan = { slug: string; publieeLe: string | null; modifieLe: string | null; formateurId: string | null };

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
