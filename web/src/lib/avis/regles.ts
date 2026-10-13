import type { EtatProgression } from "@/lib/progression/regles";
import type { Etoiles, ResumeAvis } from "./types";

// Règles des avis (spec du lot 1, Q8, §7). La base vérifie elle aussi la règle des 50 % (migration 0010).

export const COMMENTAIRE_MAX = 1000;
/** Avis montrés sur la fiche : celui du compte d'abord, puis les plus récents. */
export const AVIS_MAX = 6;
/** De 5 à 1 : l'ordre des barres de la répartition. */
export const ETOILES: Etoiles[] = [5, 4, 3, 2, 1];

/** À partir de 50 % de progression : leçons terminées × 2 ≥ leçons de la formation (même calcul que la base). */
export function peutDonnerAvis(etat: Pick<EtatProgression, "terminees" | "total">): boolean {
  return etat.total > 0 && etat.terminees.size * 2 >= etat.total;
}

/** Moyenne au dixième et nombre d'avis, d'après le nombre d'avis par note. */
export function resumeDepuis(repartition: Record<Etoiles, number>): ResumeAvis {
  const total = ETOILES.reduce((somme, n) => somme + repartition[n], 0);
  const points = ETOILES.reduce((somme, n) => somme + n * repartition[n], 0);
  return { moyenne: total > 0 ? Math.round((10 * points) / total) / 10 : null, total, repartition: { ...repartition } };
}

/** Part de chaque note en %, arrondie par la méthode du plus grand reste : le total fait toujours 100. */
export function pourcentages({ total, repartition }: ResumeAvis): Record<Etoiles, number> {
  const parts: Record<Etoiles, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  if (total === 0) return parts;
  const exactes = ETOILES.map((n) => ({ n, exacte: (100 * repartition[n]) / total }));
  for (const { n, exacte } of exactes) parts[n] = Math.floor(exacte);
  let manque = 100 - ETOILES.reduce((somme, n) => somme + parts[n], 0);
  // À reste égal, la note la plus haute d'abord (tri stable, de 5 à 1).
  for (const { n } of [...exactes].sort((a, b) => (b.exacte - Math.floor(b.exacte)) - (a.exacte - Math.floor(a.exacte)))) {
    if (manque <= 0) break;
    parts[n] += 1;
    manque -= 1;
  }
  return parts;
}

/** « 4,8 ». */
export const formatNote = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** « 1 avis », « 126 avis » (invariable). */
export const libelleNombreAvis = (n: number) => `${n} avis`;

const TONS = ["bleu", "violet", "ambre"] as const;

/** La couleur de l'avatar d'un avis, toujours la même pour un même avis. */
export function toneAvatar(id: string): (typeof TONS)[number] {
  let somme = 0;
  for (const caractere of id) somme = (somme + caractere.charCodeAt(0)) % 9973;
  return TONS[somme % TONS.length];
}
