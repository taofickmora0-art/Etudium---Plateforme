import { CODES_BADGES, type CodeBadge, type ObjectifJours, type ProgressionJeu } from "./types";

// Les libellés de l'engagement (lot 6 B) et la conversion de ce que rend la base. Sans accès au serveur : utilisable par
// les composants client.

/** Les 8 badges (spec Q6) : leur nom et ce qu'il faut faire pour les obtenir. */
export const BADGES: Record<CodeBadge, { nom: string; condition: string }> = {
  premier_pas: { nom: "Premier pas", condition: "Terminer une première leçon" },
  serie_3: { nom: "Série de 3 jours", condition: "3 jours d’apprentissage d’affilée" },
  serie_7: { nom: "Série de 7 jours", condition: "7 jours d’apprentissage d’affilée" },
  serie_30: { nom: "Série de 30 jours", condition: "30 jours d’apprentissage d’affilée" },
  premier_quiz: { nom: "Premier quiz réussi", condition: "Réussir un premier quiz" },
  premier_exercice: { nom: "Premier exercice validé", condition: "Faire valider un premier exercice" },
  premier_certificat: { nom: "Premier certificat", condition: "Obtenir un premier certificat" },
  trois_certificats: { nom: "Trois certificats", condition: "Obtenir trois certificats" },
};

const nombre = (n: number) => n.toLocaleString("fr-FR");

/** « 0 jour », « 1 jour », « 8 jours ». */
export const jours = (n: number) => `${nombre(n)} ${n > 1 ? "jours" : "jour"}`;

/** « 0 point », « 1 point », « 165 points ». */
export const points = (n: number) => `${nombre(n)} ${n > 1 ? "points" : "point"}`;

export const estCodeBadge = (v: unknown): v is CodeBadge => typeof v === "string" && (CODES_BADGES as readonly string[]).includes(v);

const entier = (v: unknown, defaut: number) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : defaut);
const objectif = (v: unknown): ObjectifJours => (v === 3 || v === 7 ? v : 5);

/** ma_progression_jeu() → ProgressionJeu ; un champ absent ou faux prend une valeur sûre (rien ne casse l'en-tête). */
export function versProgressionJeu(brut: unknown): ProgressionJeu {
  const b = brut && typeof brut === "object" ? (brut as Record<string, unknown>) : {};
  const joursBruts = Array.isArray(b.jours_semaine) ? b.jours_semaine : [];
  const badges = Array.isArray(b.badges) ? b.badges : [];
  return {
    serie: entier(b.serie, 0),
    pointsTotal: entier(b.points_total, 0),
    pointsSemaine: entier(b.points_semaine, 0),
    niveau: Math.max(1, entier(b.niveau, 1)),
    pointsAvantNiveau: entier(b.points_avant_niveau, 200),
    objectifJours: objectif(b.objectif_jours),
    joursSemaine: Array.from({ length: 7 }, (_, i) => joursBruts[i] === true),
    badges: badges.flatMap((x) => {
      const badge = x && typeof x === "object" ? (x as Record<string, unknown>) : {};
      return estCodeBadge(badge.code) ? [{ code: badge.code, obtenuLe: typeof badge.obtenu_le === "string" ? badge.obtenu_le : "" }] : [];
    }),
  };
}
