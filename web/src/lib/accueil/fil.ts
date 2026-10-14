import type { CarteCatalogue } from "@/lib/catalogue/types";
import type { Publication } from "@/lib/communaute/types";

/** Une formation est « nouvelle » dans le fil de l'Accueil pendant 30 jours après sa mise en ligne (spec, §2). */
export const NOUVELLES_JOURS = 30;
/** « Formations disponibles » sous le fil : les plus récentes (spec, §3). */
export const FORMATIONS_DISPONIBLES = 4;

const recentesDabord = (a: CarteCatalogue, b: CarteCatalogue) => Date.parse(b.publieeLe) - Date.parse(a.publieeLe);

/** Les formations mises en ligne depuis 30 jours (pas dans le futur), de la plus récente à la plus ancienne. */
export function nouvellesFormations(cartes: CarteCatalogue[], maintenant: Date): CarteCatalogue[] {
  const depuis = maintenant.getTime() - NOUVELLES_JOURS * 86_400_000;
  return cartes
    .filter((c) => {
      const date = Date.parse(c.publieeLe);
      return !Number.isNaN(date) && date >= depuis && date <= maintenant.getTime();
    })
    .sort(recentesDabord);
}

/** Les formations les plus récentes du catalogue, pour « Formations disponibles ». */
export function formationsDisponibles(cartes: CarteCatalogue[]): CarteCatalogue[] {
  return [...cartes].sort(recentesDabord).slice(0, FORMATIONS_DISPONIBLES);
}

export type ElementFil = { type: "publication"; publication: Publication } | { type: "formation"; formation: CarteCatalogue };

/**
 * Le fil de l'Accueil : avant chaque publication, les nouvelles formations plus récentes qu'elle (à égalité, la
 * publication d'abord). Celles plus anciennes que la dernière publication chargée attendent « Voir plus » ; à la fin du
 * fil (`fin`), elles viennent à la suite. Recalculé sur tout le lot chargé : chaque formation n'y paraît qu'une fois.
 */
export function entrelacer(publications: Publication[], formations: CarteCatalogue[], fin: boolean): ElementFil[] {
  const restantes = [...formations].sort(recentesDabord);
  const fil: ElementFil[] = [];
  for (const publication of publications) {
    const date = Date.parse(publication.creeLe);
    while (restantes.length > 0 && Date.parse(restantes[0].publieeLe) > date) fil.push({ type: "formation", formation: restantes.shift()! });
    fil.push({ type: "publication", publication });
  }
  if (fin) for (const formation of restantes) fil.push({ type: "formation", formation });
  return fil;
}
