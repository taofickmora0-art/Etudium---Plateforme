import { demoModeActive } from "@/lib/auth/current-user";
import { liste, texte, un, verifier, type Ligne } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";
import type { LeconTrouvable } from "./regles";

/**
 * Les leçons des formations publiées, avec leur formation et le numéro de leur module (sa place dans la formation).
 * L'accès est calculé par la base (aperçu, gratuite, équipe) : il décide du lien (leçon ou fiche).
 */
export async function listLeconsPubliees(): Promise<LeconTrouvable[]> {
  if (demoModeActive()) return [];
  const supabase = await createClient();
  const lignes = verifier(
    await supabase
      .from("lecons")
      .select("id, titre, duree_secondes, accessible, module_id, modules!inner(id, titre, formations!inner(slug, titre, statut, modules(id, ordre)))")
      .eq("modules.formations.statut", "publiee"),
  ) as Ligne[] | null;
  return liste(lignes).map((l) => {
    const mod = un(l.modules);
    const formation = un(mod?.formations);
    const ordres = [...liste(formation?.modules)].sort((a, b) => Number(a.ordre ?? 0) - Number(b.ordre ?? 0));
    const rang = ordres.findIndex((m) => String(m.id) === String(mod?.id));
    return {
      id: String(l.id),
      titre: texte(l.titre),
      dureeSecondes: Number(l.duree_secondes ?? 0),
      accessible: l.accessible === true,
      formation: { slug: texte(formation?.slug), titre: texte(formation?.titre) },
      module: { numero: rang + 1, titre: texte(mod?.titre) },
    };
  });
}
