import { moment } from "@/lib/communaute/regles";

// Règles d'affichage du formateur public (spec du 2 novembre 2026, §5 et §6).

/** « 1 formation », « 3 formations » (zéro reste au singulier). */
export const nombreDeFormations = (n: number) => `${n} ${n > 1 ? "formations" : "formation"}`;

/**
 * « A rejoint : il y a 3 jours », « A rejoint : hier », puis la date au-delà d'une semaine (le temps relatif de la
 * communauté) ; rien si la date est inconnue.
 */
export function arriveeDuFormateur(rejointLe: string, maintenant: Date): string {
  if (!rejointLe || Number.isNaN(Date.parse(rejointLe))) return "";
  return `A rejoint : ${moment(rejointLe, maintenant)}`;
}
