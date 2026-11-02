// Les chiffres de la page Parcours du back-office (migration 0065 ; demande du 2 novembre 2026, option A). Sans accès
// au serveur : la grille (composant client) les lit aussi.

export type ChiffresParcours = { formationsPubliees: number; formationsBrouillons: number; apprenants: number; certificats: number };

export type StatistiquesParcours = {
  totaux: { parcoursActifs: number; formationsPubliees: number; apprenants: number; certificats: number };
  /** Par identifiant de parcours ; un parcours absent n'a pas de chiffres. */
  parParcours: Record<string, ChiffresParcours>;
};

type Brut = Record<string, unknown>;
const objet = (v: unknown): Brut => (v && typeof v === "object" ? (v as Brut) : {});
const entier = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0);

/** parcours_back_office() → StatistiquesParcours ; un champ absent vaut 0. */
export function versStatistiquesParcours(brut: unknown): StatistiquesParcours {
  const b = objet(brut);
  const t = objet(b.totaux);
  const parParcours: Record<string, ChiffresParcours> = {};
  for (const p of Array.isArray(b.parcours) ? b.parcours.map(objet) : []) {
    if (typeof p.id !== "string" || !p.id) continue;
    parParcours[p.id] = {
      formationsPubliees: entier(p.formations_publiees),
      formationsBrouillons: entier(p.formations_brouillons),
      apprenants: entier(p.apprenants),
      certificats: entier(p.certificats),
    };
  }
  return {
    totaux: { parcoursActifs: entier(t.parcours_actifs), formationsPubliees: entier(t.formations_publiees), apprenants: entier(t.apprenants), certificats: entier(t.certificats) },
    parParcours,
  };
}

/** « 1 formation », « 8 formations », « 0 brouillon ». */
export const compter = (n: number, mot: string) => `${n.toLocaleString("fr-FR")} ${mot}${n > 1 ? "s" : ""}`;

/** La part des apprenants d'un parcours, en % entier (0 sans apprenant). */
export const part = (apprenants: number, total: number) => (total > 0 ? Math.min(100, Math.round((100 * apprenants) / total)) : 0);
