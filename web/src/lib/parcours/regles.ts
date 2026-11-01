import type { TagTone } from "@/components/ui/Tag";
import type { CarteCatalogue } from "@/lib/catalogue/types";

// Règles de la page « Mes parcours » (NdParcours). La progression arrive en 1.7 ; la page reçoit une table vide d'ici là.

export type ProgressionFormation = { pourcentage: number; terminee: boolean };

const position = (carte: CarteCatalogue, slug: string) => carte.parcours.find((p) => p.slug === slug)?.position ?? Number.MAX_SAFE_INTEGER;

/** Les formations d'un parcours, dans l'ordre choisi au back-office. */
export function formationsDuParcours(cartes: CarteCatalogue[], slug: string): CarteCatalogue[] {
  return cartes
    .filter((c) => c.parcours.some((p) => p.slug === slug))
    .sort((a, b) => position(a, slug) - position(b, slug) || a.titre.localeCompare(b.titre, "fr"));
}

/**
 * État affiché à droite d'une formation : terminée, en cours (pourcentage), sinon ouverte ou fermée. Une formation
 * gratuite est ouverte à tous ; une formation payante, à l'abonné (lot 2).
 */
export function etatFormation(carte: CarteCatalogue, progression?: ProgressionFormation, abonne = false): { libelle: string; ton: TagTone; verrou?: boolean } {
  if (progression?.terminee || (progression?.pourcentage ?? 0) >= 100) return { libelle: "Terminé", ton: "valide" };
  if (progression && progression.pourcentage > 0) return { libelle: `${Math.round(progression.pourcentage)} %`, ton: "nouveau" };
  if (carte.gratuite) return { libelle: "Gratuite", ton: "gratuit" };
  if (abonne) return { libelle: "Incluse", ton: "nouveau" };
  return { libelle: "Verrouillée", ton: "verrouillee", verrou: true };
}

/** Progression d'un parcours : moyenne des progressions de ses formations, et nombre de formations terminées. */
export function progressionDuParcours(
  cartes: CarteCatalogue[],
  progressions: Map<string, ProgressionFormation>,
): { pourcentage: number; terminees: number; total: number } {
  if (cartes.length === 0) return { pourcentage: 0, terminees: 0, total: 0 };
  const valeurs = cartes.map((c) => progressions.get(c.slug));
  const somme = valeurs.reduce((total, p) => total + Math.min(100, p?.pourcentage ?? 0), 0);
  return {
    pourcentage: Math.round(somme / cartes.length),
    terminees: valeurs.filter((p) => p?.terminee || (p?.pourcentage ?? 0) >= 100).length,
    total: cartes.length,
  };
}
