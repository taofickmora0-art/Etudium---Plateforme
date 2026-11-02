import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { listCatalogue, listParcoursCatalogue } from "@/lib/catalogue/data";
import { ecrireFiltres, lireFiltres, type Filtres } from "@/lib/catalogue/filtres";
import type { EtatsCartes } from "@/lib/catalogue/types";
import { lireApprenants } from "@/lib/inscriptions/data";
import { lireSuiviDuCompte } from "@/lib/mes-formations/data";
import { Catalogue } from "./Catalogue";
import { ListeMesFormations } from "./ListeMesFormations";

/**
 * Ce qui accompagne les cartes (rangée « Mes formations », apprenants, inscription, favoris) ne doit jamais empêcher le
 * catalogue de s'afficher : une lecture impossible les retire, et laisse une trace.
 */
async function ouRien<T>(lire: () => Promise<T>, quoi: string): Promise<T | null> {
  try {
    return await lire();
  } catch (erreur) {
    console.error(`Lecture ${quoi} impossible :`, erreur instanceof Error ? erreur.message : erreur);
    return null;
  }
}

type Params = Record<string, string | string[] | undefined>;

/**
 * Lit les formations publiées et les parcours, puis affiche le catalogue avec les filtres de l'adresse.
 * `imposer` fixe certains filtres (« Formations gratuites »). En même temps : le nombre d'apprenants (tous) et, pour un
 * compte connecté, ses formations, ses inscriptions et ses favoris (spec du 2 novembre 2026, §4).
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
    donnees = await Promise.all([
      listCatalogue(),
      listParcoursCatalogue(),
      ouRien(lireApprenants, "du nombre d'apprenants"),
      variante === "connecte" ? ouRien(lireSuiviDuCompte, "des formations suivies") : Promise.resolve(null),
    ]);
  } catch (erreur) {
    return siTablesAbsentes(erreur);
  }
  const [cartes, parcours, apprenants, suivi] = donnees;
  // Sans formation suivie, aucune rangée : pas d'espace vide sous le titre.
  const suivies = avecMesFormations ? (suivi?.suivies ?? []) : [];
  const rangee = suivies.length > 0 ? <ListeMesFormations suivies={suivies} /> : undefined;
  // Un visiteur n'a ni inscription ni cœur.
  const etats: EtatsCartes = { apprenants, inscrites: suivi?.inscrites ?? {}, favoris: suivi?.favoris ?? null };
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
      etats={etats}
    />
  );
}
