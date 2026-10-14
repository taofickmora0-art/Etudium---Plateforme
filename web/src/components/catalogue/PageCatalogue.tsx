import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { listCatalogue, listParcoursCatalogue } from "@/lib/catalogue/data";
import { ecrireFiltres, lireFiltres, type Filtres } from "@/lib/catalogue/filtres";
import { lireFormationsSuivies } from "@/lib/mes-formations/data";
import { Catalogue } from "./Catalogue";
import { ListeMesFormations } from "./ListeMesFormations";

/** La rangée « Mes formations » ne doit jamais empêcher le catalogue de s'afficher : une lecture impossible la retire. */
async function suiviesOuRien() {
  try {
    return await lireFormationsSuivies();
  } catch (erreur) {
    console.error("Lecture des formations suivies impossible :", erreur instanceof Error ? erreur.message : erreur);
    return [];
  }
}

type Params = Record<string, string | string[] | undefined>;

/**
 * Lit les formations publiées et les parcours, puis affiche le catalogue avec les filtres de l'adresse.
 * `imposer` fixe certains filtres (« Formations gratuites »).
 */
export async function PageCatalogue({
  params,
  variante,
  chemin,
  imposer,
  avecMesFormations = false,
}: {
  params: Params;
  variante: "public" | "connecte";
  chemin: "/formations" | "/formations-gratuites";
  imposer?: Partial<Filtres>;
  /** Page Formations d'un compte connecté : la rangée « Mes formations », lue en même temps que le catalogue. */
  avecMesFormations?: boolean;
}) {
  let donnees;
  try {
    donnees = await Promise.all([listCatalogue(), listParcoursCatalogue(), avecMesFormations ? suiviesOuRien() : Promise.resolve([])]);
  } catch (erreur) {
    return siTablesAbsentes(erreur);
  }
  const [cartes, parcours, suivies] = donnees;
  // Sans formation suivie, aucune rangée : pas d'espace vide sous le titre.
  const rangee = suivies.length > 0 ? <ListeMesFormations suivies={suivies} /> : undefined;
  const filtres = { ...lireFiltres(params, parcours.map((p) => p.slug)), ...imposer };
  // La clé suit les filtres de l'adresse : une navigation (« Toutes les formations » dans le menu) repart de zéro
  // au lieu de garder l'état précédent du catalogue.
  return (
    <Catalogue
      key={ecrireFiltres(filtres) || "tous"}
      cartes={cartes}
      parcours={parcours}
      filtresInitiaux={filtres}
      variante={variante}
      chemin={chemin}
      imposer={imposer}
      rangee={rangee}
    />
  );
}
