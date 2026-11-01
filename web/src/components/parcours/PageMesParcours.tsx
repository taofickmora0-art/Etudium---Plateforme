import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { lireAbonnement } from "@/lib/abonnement/data";
import { lireMonetisation, listCatalogue, listParcoursCatalogue } from "@/lib/catalogue/data";
import { lireProgression } from "@/lib/progression/data";
import { progressionsParFormation } from "@/lib/progression/regles";
import { MesParcours } from "./MesParcours";

/**
 * Lit les parcours, les formations publiées et la progression du compte, puis affiche Mes parcours.
 * Sans progression en base (migrations 0007 et 0008 pas encore appliquées), tout est à 0 %.
 */
export async function PageMesParcours({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> } = {}) {
  const demande = (await searchParams)?.parcours;
  const initial = Array.isArray(demande) ? demande[0] : demande;
  let donnees;
  try {
    donnees = await Promise.all([listParcoursCatalogue(), listCatalogue(), lireProgression(), lireMonetisation(), lireAbonnement()]);
  } catch (erreur) {
    return siTablesAbsentes(erreur);
  }
  const [parcours, cartes, lignes, liens, abonnement] = donnees;
  return (
    <MesParcours
      parcours={parcours}
      cartes={cartes}
      progressions={lignes ? progressionsParFormation(cartes, lignes) : new Map()}
      initial={initial}
      liens={liens}
      abonne={abonnement.etat === "actif"}
    />
  );
}
