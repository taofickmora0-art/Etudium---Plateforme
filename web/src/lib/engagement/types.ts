// L'engagement de l'étudiant (lot 6 B, migration 0063) : série, points, niveau, objectif et badges.

export const CODES_BADGES = [
  "premier_pas",
  "serie_3",
  "serie_7",
  "serie_30",
  "premier_quiz",
  "premier_exercice",
  "premier_certificat",
  "trois_certificats",
] as const;

export type CodeBadge = (typeof CODES_BADGES)[number];

export type ObjectifJours = 3 | 5 | 7;

/** Ce que rend ma_progression_jeu(), converti. */
export type ProgressionJeu = {
  /** Jours d'apprentissage d'affilée jusqu'à aujourd'hui (ou hier, tant qu'aujourd'hui n'est pas fini). */
  serie: number;
  pointsTotal: number;
  /** Depuis lundi 0 h (heure du Bénin) : la pastille de l'en-tête et « Gagnés cette semaine ». */
  pointsSemaine: number;
  niveau: number;
  /** « Encore N points pour atteindre le niveau suivant. » */
  pointsAvantNiveau: number;
  objectifJours: ObjectifJours;
  /** Du lundi au dimanche : vrai pour un jour d'apprentissage. */
  joursSemaine: boolean[];
  badges: { code: CodeBadge; obtenuLe: string }[];
};
