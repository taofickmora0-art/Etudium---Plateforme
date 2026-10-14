import { versVueCarte } from "@/components/mes-formations/CarteSuivie";
import { listFiches } from "@/lib/catalogue/data";
import { lireFavoris } from "@/lib/favoris/data";
import { formationsSuivies } from "@/lib/mes-formations/regles";
import { lireProgression } from "@/lib/progression/data";
import { ListeMesFormations } from "./ListeMesFormations";

/**
 * Les formations suivies du compte, lues comme sur « Mes formations ». Une lecture impossible (tables absentes, base
 * injoignable) n'empêche pas le catalogue de s'afficher : la rangée est simplement absente.
 */
async function lireSuivies() {
  try {
    const [lignes, favoris] = await Promise.all([lireProgression(), lireFavoris()]);
    const ids = [...new Set((lignes ?? []).map((l) => l.formationId))];
    if (ids.length === 0) return [];
    const fiches = await listFiches(ids);
    return formationsSuivies(fiches, lignes ?? [], new Set((favoris ?? []).map((f) => f.formationId))).map(versVueCarte);
  } catch {
    return [];
  }
}

export async function RangeeMesFormations() {
  return <ListeMesFormations suivies={await lireSuivies()} />;
}
