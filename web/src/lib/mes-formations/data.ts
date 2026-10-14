import { versVueCarte, type VueCarteSuivie } from "@/components/mes-formations/CarteSuivie";
import { listFiches } from "@/lib/catalogue/data";
import { lireFavoris } from "@/lib/favoris/data";
import { lireProgression } from "@/lib/progression/data";
import { formationsSuivies } from "./regles";

/**
 * Les formations suivies du compte, de la plus récemment ouverte à la plus ancienne (« Mes formations » et sa rangée de
 * la page Formations). Sans les tables de progression (0007, 0008), aucune n'est encore commencée. Relance les erreurs.
 */
export async function lireFormationsSuivies(): Promise<VueCarteSuivie[]> {
  const [lignes, favoris] = await Promise.all([lireProgression(), lireFavoris()]);
  const ids = [...new Set((lignes ?? []).map((l) => l.formationId))];
  if (ids.length === 0) return [];
  const fiches = await listFiches(ids);
  return formationsSuivies(fiches, lignes ?? [], new Set((favoris ?? []).map((f) => f.formationId))).map(versVueCarte);
}
