import type { Niveau } from "@/lib/contenus/libelles";
import type { CarteCatalogue } from "./types";

// Filtres, recherche et tri du catalogue, gardés dans l'adresse (?q=…&parcours=…) : un rechargement retrouve le même
// résultat. Les mêmes fonctions servent au premier affichage (serveur) et ensuite (navigateur).

export type Acces = "tout" | "gratuites" | "incluses";
export type Tri = "parcours" | "recentes" | "duree";

export type Filtres = {
  q: string;
  /** Adresse d'un parcours, ou « tous ». */
  parcours: string;
  acces: Acces;
  niveau: Niveau | "tous";
  tri: Tri;
};

export const FILTRES_PAR_DEFAUT: Filtres = { q: "", parcours: "tous", acces: "tout", niveau: "tous", tri: "parcours" };

const ACCES: Acces[] = ["tout", "gratuites", "incluses"];
const TRIS: Tri[] = ["parcours", "recentes", "duree"];
const NIVEAUX: (Niveau | "tous")[] = ["tous", "debutant", "intermediaire", "avance"];

const premier = (valeur: string | string[] | undefined) => (Array.isArray(valeur) ? valeur[0] : valeur) ?? "";
const parmi = <T extends string>(valeur: string, permises: readonly T[], defaut: T): T => (permises.includes(valeur as T) ? (valeur as T) : defaut);

/** Filtres lus dans l'adresse ; toute valeur inconnue revient au défaut. */
export function lireFiltres(params: Record<string, string | string[] | undefined>, parcoursConnus: string[]): Filtres {
  return {
    q: premier(params.q).slice(0, 100),
    parcours: parmi(premier(params.parcours), ["tous", ...parcoursConnus], "tous"),
    acces: parmi(premier(params.acces), ACCES, "tout"),
    niveau: parmi(premier(params.niveau), NIVEAUX, "tous"),
    tri: parmi(premier(params.tri), TRIS, "parcours"),
  };
}

/**
 * « ?q=excel&parcours=… » sans les valeurs de `base` (par défaut : les valeurs par défaut), ordre stable ; « » si rien
 * ne diffère. Sur « Formations gratuites », la base porte déjà « gratuites » : l'adresse reste nue.
 */
export function ecrireFiltres(filtres: Filtres, base: Filtres = FILTRES_PAR_DEFAUT): string {
  const params = new URLSearchParams();
  for (const cle of ["q", "parcours", "acces", "niveau", "tri"] as const) {
    const valeur = cle === "q" ? filtres.q.trim() : filtres[cle];
    if (valeur && valeur !== base[cle]) params.set(cle, valeur);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** Sans accents ni majuscules : « zotéro » trouve « Zotero ». */
const sansAccents = (texte: string) =>
  texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

/** Rang de la carte dans le tri « par parcours » : ordre du premier parcours, puis position dans ce parcours. */
const rangParcours = (carte: CarteCatalogue): [number, number] => {
  const premier = [...carte.parcours].sort((a, b) => a.ordre - b.ordre)[0];
  return premier ? [premier.ordre, premier.position] : [Number.MAX_SAFE_INTEGER, 0];
};

const COMPARER: Record<Tri, (a: CarteCatalogue, b: CarteCatalogue) => number> = {
  parcours: (a, b) => {
    const [pa, ra] = rangParcours(a);
    const [pb, rb] = rangParcours(b);
    return pa - pb || ra - rb || a.titre.localeCompare(b.titre, "fr");
  },
  recentes: (a, b) => b.publieeLe.localeCompare(a.publieeLe) || a.titre.localeCompare(b.titre, "fr"),
  duree: (a, b) => a.dureeSecondes - b.dureeSecondes || a.titre.localeCompare(b.titre, "fr"),
};

export function appliquerFiltres(cartes: CarteCatalogue[], filtres: Filtres): CarteCatalogue[] {
  const recherche = sansAccents(filtres.q);
  return cartes
    .filter((c) => !recherche || sansAccents(`${c.titre} ${c.resume}`).includes(recherche))
    .filter((c) => filtres.parcours === "tous" || c.parcours.some((p) => p.slug === filtres.parcours))
    .filter((c) => filtres.acces === "tout" || (filtres.acces === "gratuites" ? c.gratuite : !c.gratuite && c.parcours.length > 0))
    .filter((c) => filtres.niveau === "tous" || c.niveau === filtres.niveau)
    .sort(COMPARER[filtres.tri]);
}
