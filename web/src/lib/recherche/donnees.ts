import { versVueCarte, type VueCarteSuivie } from "@/components/mes-formations/CarteSuivie";
import { lireCatalogue } from "@/lib/bibliotheque/data";
import type { CarteLivre } from "@/lib/bibliotheque/types";
import { listCatalogue, listFiches, listParcoursCatalogue } from "@/lib/catalogue/data";
import type { CarteCatalogue } from "@/lib/catalogue/types";
import { lireInscriptions } from "@/lib/inscriptions/data";
import { formationsALire, formationsSuivies } from "@/lib/mes-formations/regles";
import { lireProgression } from "@/lib/progression/data";
import { listLeconsPubliees } from "./data";
import { recommandations, rechercher, type Resultats } from "./regles";

/** Ce que la page Recherche affiche pour une requête (déjà coupée à 100 caractères). */
export type DonneesRecherche = {
  cartes: CarteCatalogue[];
  resultats: Resultats | null;
  suivies: Map<string, VueCarteSuivie>;
  terminees: Set<string>;
  recommandees: CarteCatalogue[];
};

/** Les livres publiés (0074) : sans la migration, ou si la lecture échoue, la recherche continue sans eux. */
async function livresOuRien(): Promise<CarteLivre[]> {
  try {
    return (await lireCatalogue())?.livres ?? [];
  } catch (erreur) {
    console.error("Lecture des livres pour la recherche impossible :", erreur instanceof Error ? erreur.message : erreur);
    return [];
  }
}

/**
 * Les données de la recherche (spec du lot 1, §8) : le catalogue, les parcours et, s'il y a une requête, les leçons
 * publiées et les livres de la Bibliothèque ; la recherche se fait en mémoire (rien n'atteint la base). Les formations
 * trouvées qui sont « à moi » (comme dans « Mes formations » : inscrites, même à 0 % ; sans la 0069, commencées) montrent
 * leur progression ; les recommandations écartent les formations commencées ou inscrites. Relance les erreurs (sauf
 * celles des livres, qui ne sont qu'un complément).
 */
export async function lireRecherche(q: string): Promise<DonneesRecherche> {
  const [cartes, parcours, lecons, lignes, inscriptions, livres] = await Promise.all([
    listCatalogue(),
    listParcoursCatalogue(),
    q.trim() ? listLeconsPubliees() : [],
    lireProgression(),
    lireInscriptions(),
    q.trim() ? livresOuRien() : [],
  ]);
  const resultats = q.trim() ? rechercher({ cartes, parcours, lecons, livres }, q) : null;
  const aMoi = new Set(formationsALire(lignes, inscriptions));
  const ids = (resultats?.formations ?? []).map((c) => c.id).filter((id) => aMoi.has(id));
  const suivies = new Map<string, VueCarteSuivie>(
    formationsSuivies(ids.length > 0 ? await listFiches(ids) : [], lignes ?? [], new Set(), inscriptions).map((s) => [s.fiche.id, versVueCarte(s)]),
  );
  const terminees = new Set((lignes ?? []).filter((l) => l.termineeLe).map((l) => l.leconId));
  const dejaSuivies = new Set([...(lignes ?? []).map((l) => l.formationId), ...(inscriptions ?? []).map((i) => i.formationId)]);
  return { cartes, resultats, suivies, terminees, recommandees: recommandations(cartes, dejaSuivies) };
}
