import type { ReactNode } from "react";
import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { listCatalogue, listParcoursCatalogue } from "@/lib/catalogue/data";
import { ecrireFiltres, lireFiltres, type Filtres } from "@/lib/catalogue/filtres";
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
  rangee,
}: {
  params: Params;
  variante: "public" | "connecte";
  chemin: "/formations" | "/formations-gratuites";
  imposer?: Partial<Filtres>;
  /** La rangée « Mes formations » de la page Formations (compte connecté). */
  rangee?: ReactNode;
}) {
  let donnees;
  try {
    donnees = await Promise.all([listCatalogue(), listParcoursCatalogue()]);
  } catch (erreur) {
    return siTablesAbsentes(erreur);
  }
  const [cartes, parcours] = donnees;
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
