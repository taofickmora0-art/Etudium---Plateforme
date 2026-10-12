import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { listCatalogue, listParcoursCatalogue } from "@/lib/catalogue/data";
import { lireFiltres, type Filtres } from "@/lib/catalogue/filtres";
import { Catalogue } from "./Catalogue";

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
}: {
  params: Params;
  variante: "public" | "connecte";
  chemin: "/formations" | "/formations-gratuites";
  imposer?: Partial<Filtres>;
}) {
  let donnees;
  try {
    donnees = await Promise.all([listCatalogue(), listParcoursCatalogue()]);
  } catch (erreur) {
    return siTablesAbsentes(erreur);
  }
  const [cartes, parcours] = donnees;
  const filtres = { ...lireFiltres(params, parcours.map((p) => p.slug)), ...imposer };
  return <Catalogue cartes={cartes} parcours={parcours} filtresInitiaux={filtres} variante={variante} chemin={chemin} />;
}
