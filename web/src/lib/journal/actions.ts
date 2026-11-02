"use server";

import { exigerDomaine } from "@/lib/admin/garde";
import { lireJournal } from "./data";
import { estCategorieJournal, type FiltresJournal, type PageJournal } from "./types";

/** « Voir plus » du journal : les 50 lignes suivantes, après `avant` (le super admin ; la base le revérifie). */
export async function chargerJournal(filtres: FiltresJournal, avant: string): Promise<PageJournal | null> {
  const garde = await exigerDomaine("journal");
  if ("erreur" in garde) return null;
  const propres: FiltresJournal = {
    categorie: estCategorieJournal(filtres?.categorie) ? filtres.categorie : null,
    auteur: typeof filtres?.auteur === "string" && /^[0-9a-f-]{36}$/i.test(filtres.auteur) ? filtres.auteur : null,
    jours: typeof filtres?.jours === "number" && [7, 30, 365].includes(filtres.jours) ? filtres.jours : null,
  };
  return lireJournal(propres, avant);
}
