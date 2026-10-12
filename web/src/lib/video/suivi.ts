// Suivi du temps réellement regardé (spec du lot 1, §5) : on garde les passages lus, pas la position atteinte.
// Un passage lu deux fois ne compte qu'une fois ; un saut dans la barre ne compte pas.

/** Un passage regardé, de `debut` à `fin`, en secondes de vidéo. */
export type Intervalle = [number, number];

/** Passages triés, chevauchements et passages contigus fusionnés. */
export function fusionner(intervalles: Intervalle[]): Intervalle[] {
  const tries = intervalles.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const resultat: Intervalle[] = [];
  for (const [a, b] of tries) {
    const dernier = resultat[resultat.length - 1];
    if (dernier && a <= dernier[1]) dernier[1] = Math.max(dernier[1], b);
    else resultat.push([a, b]);
  }
  return resultat;
}

export const ajouter = (intervalles: Intervalle[], nouveau: Intervalle): Intervalle[] => fusionner([...intervalles, nouveau]);

/** Secondes couvertes. */
export const total = (intervalles: Intervalle[]): number => fusionner(intervalles).reduce((s, [a, b]) => s + (b - a), 0);

/** « {[0,40),[60,90)} » : la forme d'un int4multirange Postgres, en secondes entières (les passages vides disparaissent). */
export function versMultirange(intervalles: Intervalle[]): string {
  const entiers = fusionner(intervalles.map(([a, b]): Intervalle => [Math.floor(a), Math.floor(b)]));
  return `{${entiers.map(([a, b]) => `[${a},${b})`).join(",")}}`;
}

/** Relit un int4multirange (« {[0,40),[60,90)} ») ; une valeur illisible donne une liste vide. */
export function depuisMultirange(texte: string): Intervalle[] {
  return [...texte.matchAll(/\[(\d+),(\d+)\)/g)].map((m): Intervalle => [Number(m[1]), Number(m[2])]);
}

/** Part regardée de la durée de référence, en pourcentage arrondi (0 sans référence, 100 au plus). */
export function pourcentageVu(intervalles: Intervalle[], reference: number): number {
  if (reference <= 0) return 0;
  return Math.min(100, Math.round((100 * total(intervalles)) / reference));
}

export type EtatSuivi = { position: number | null; instant: number; passages: Intervalle[] };
type Observation = { position: number; instant: number; vitesse: number; enLecture: boolean };

/**
 * Une observation du lecteur (environ chaque seconde). Le passage depuis l'observation précédente ne compte que si la
 * vidéo a avancé au rythme du temps réel (vitesse comprise, avec une marge) ; sinon c'est un saut, et on repart de là.
 * `instant` est en millisecondes.
 */
export function observer(etat: EtatSuivi, { position, instant, vitesse, enLecture }: Observation): EtatSuivi {
  if (!enLecture || etat.position === null) return { ...etat, position, instant };
  const avance = position - etat.position;
  const ecoule = (instant - etat.instant) / 1000;
  const lu = avance > 0 && avance <= ecoule * vitesse * 1.5 + 0.75;
  return { position, instant, passages: lu ? ajouter(etat.passages, [etat.position, position]) : etat.passages };
}
