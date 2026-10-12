// Progression du compte connecté : une ligne par leçon ouverte (migrations 0007 et 0008).

export type LigneProgression = {
  leconId: string;
  formationId: string;
  /** Date de fin de la leçon, ou null si elle n'est pas terminée. */
  termineeLe: string | null;
  /** Dernière visite. */
  vueLe: string;
  /** Où reprendre la vidéo, en secondes. */
  positionSecondes: number;
};
