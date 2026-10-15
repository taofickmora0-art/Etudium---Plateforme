import type { CarteCatalogue } from "@/lib/catalogue/types";

// « Pour bien commencer » (NdLanding, annexe 1.12 §8 et §19) : la maquette ne dit pas comment choisir les 4 cartes.

const plusRecenteDAbord = (a: CarteCatalogue, b: CarteCatalogue) => b.publieeLe.localeCompare(a.publieeLe);

/** Ordre du premier parcours de la formation (celui de sa couleur) ; une formation sans parcours passe après. */
const ordreDuParcours = (carte: CarteCatalogue) => Math.min(Infinity, ...carte.parcours.map((p) => p.ordre));

/** Tri stable : à ordre de parcours égal, la plus récente reste devant. */
const parParcours = (cartes: CarteCatalogue[]) => [...cartes].sort((a, b) => ordreDuParcours(a) - ordreDuParcours(b));

/**
 * Jusqu'à 2 formations gratuites, puis les « Populaire », puis les autres : à chaque fois les plus récentes d'abord,
 * `max` au plus. Chaque groupe est rangé par ordre du parcours. Avec les données d'exemple, ce sont les 4 cartes de la
 * maquette, dans son ordre.
 */
export function formationsPourBienCommencer(cartes: CarteCatalogue[], max = 4): CarteCatalogue[] {
  const recentes = [...cartes].sort(plusRecenteDAbord);
  const gratuites = recentes.filter((c) => c.gratuite).slice(0, Math.min(2, max));
  const populaires = recentes.filter((c) => !c.gratuite && c.badge === "populaire").slice(0, max - gratuites.length);
  const choisies = new Set([...gratuites, ...populaires]);
  const autres = recentes.filter((c) => !choisies.has(c)).slice(0, max - choisies.size);
  return [...parParcours(gratuites), ...parParcours(populaires), ...parParcours(autres)];
}
