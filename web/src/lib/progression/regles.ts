import type { CarteCatalogue, FicheFormation, LeconFiche, ModuleFiche } from "@/lib/catalogue/types";
import type { LigneProgression } from "./types";

// Règles de la progression (spec du lot 1, Q2) : chaque leçon compte pareil, quelle que soit sa durée.

export type EtatProgression = {
  pourcentage: number;
  terminees: Set<string>;
  total: number;
  /** Durées des leçons pas encore terminées, en secondes (« 2 h restantes »). */
  restantSecondes: number;
  /** Où reprendre : « Prochaine leçon », « Continuer », « Vous êtes ici ». */
  aReprendre: LeconFiche | null;
  /** Au moins une leçon ouverte. */
  commencee: boolean;
  terminee: boolean;
};

const pourcentage = (faites: number, total: number) => (total > 0 ? Math.round((100 * faites) / total) : 0);

/**
 * La leçon où reprendre : la dernière ouverte si elle n'est pas terminée ; sinon la première leçon ouverte (accessible)
 * non terminée qui la suit ; sinon la première leçon accessible non terminée. Jamais une leçon fermée.
 */
function oReprendre(lecons: LeconFiche[], terminees: Set<string>, lignes: LigneProgression[]): LeconFiche | null {
  const aFaire = (l: LeconFiche) => l.accessible && !terminees.has(l.id);
  const derniere = [...lignes].sort((a, b) => b.vueLe.localeCompare(a.vueLe))[0];
  const rang = derniere ? lecons.findIndex((l) => l.id === derniere.leconId) : -1;
  if (rang >= 0 && aFaire(lecons[rang])) return lecons[rang];
  return lecons.slice(rang + 1).find(aFaire) ?? lecons.find(aFaire) ?? null;
}

/** La progression d'une formation, d'après les lignes du compte (celles des autres formations sont ignorées). */
export function etatFormation(fiche: Pick<FicheFormation, "id" | "modules">, lignes: LigneProgression[]): EtatProgression {
  const lecons = fiche.modules.flatMap((m) => m.lecons);
  const ids = new Set(lecons.map((l) => l.id));
  const siennes = lignes.filter((l) => l.formationId === fiche.id && ids.has(l.leconId));
  const terminees = new Set(siennes.filter((l) => l.termineeLe).map((l) => l.leconId));
  const total = lecons.length;
  return {
    pourcentage: pourcentage(terminees.size, total),
    terminees,
    total,
    restantSecondes: lecons.filter((l) => !terminees.has(l.id)).reduce((s, l) => s + l.dureeSecondes, 0),
    aReprendre: siennes.length > 0 ? oReprendre(lecons, terminees, siennes) : null,
    commencee: siennes.length > 0,
    terminee: total > 0 && terminees.size === total,
  };
}

/** Badge d'un module : « Terminé » si toutes ses leçons le sont, « En cours » s'il est entamé ou contient la leçon où reprendre. */
export function etatModule(module: ModuleFiche, terminees: ReadonlySet<string>, aReprendre: LeconFiche | null): "termine" | "en-cours" | null {
  if (module.lecons.length === 0) return null;
  const faites = module.lecons.filter((l) => terminees.has(l.id)).length;
  if (faites === module.lecons.length) return "termine";
  if (faites > 0 || module.lecons.some((l) => l.id === aReprendre?.id)) return "en-cours";
  return null;
}

/** Pourcentage de chaque formation commencée, par adresse (page Mes parcours). */
export function progressionsParFormation(cartes: CarteCatalogue[], lignes: LigneProgression[]): Map<string, { pourcentage: number; terminee: boolean }> {
  const progressions = new Map<string, { pourcentage: number; terminee: boolean }>();
  for (const carte of cartes) {
    const siennes = lignes.filter((l) => l.formationId === carte.id);
    if (siennes.length === 0) continue;
    const faites = new Set(siennes.filter((l) => l.termineeLe).map((l) => l.leconId)).size;
    progressions.set(carte.slug, { pourcentage: pourcentage(faites, carte.nbLecons), terminee: carte.nbLecons > 0 && faites >= carte.nbLecons });
  }
  return progressions;
}
