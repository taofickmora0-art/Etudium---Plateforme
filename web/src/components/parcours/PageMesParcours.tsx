import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { listCatalogue, listParcoursCatalogue } from "@/lib/catalogue/data";
import { lireProgression } from "@/lib/progression/data";
import { progressionsParFormation } from "@/lib/progression/regles";
import { MesParcours } from "./MesParcours";

/**
 * Lit les parcours, les formations publiées et la progression du compte, puis affiche Mes parcours.
 * Sans progression en base (migrations 0007 et 0008 pas encore appliquées), tout est à 0 %.
 */
export async function PageMesParcours() {
  let donnees;
  try {
    donnees = await Promise.all([listParcoursCatalogue(), listCatalogue(), lireProgression()]);
  } catch (erreur) {
    return siTablesAbsentes(erreur);
  }
  const [parcours, cartes, lignes] = donnees;
  return <MesParcours parcours={parcours} cartes={cartes} progressions={lignes ? progressionsParFormation(cartes, lignes) : new Map()} />;
}
