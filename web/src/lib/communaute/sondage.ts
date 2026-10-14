// Sondages, quiz et publications programmées (spec sondages, quiz et programmation ; migration 0026) : les règles,
// vérifiées dans le champ puis par la base, avec les mêmes messages.

export type TypeSondage = "texte" | "images" | "quiz";
/** La fin d'un sondage, en jours après sa parution ; null : sans fin. */
export type DureeSondage = 1 | 3 | 7 | 14 | null;
/** Une image déjà déposée dans le dossier du compte (stockage « communaute »). */
export type ImageEnvoyee = { chemin: string; nom: string; type: string; taille: number };
export type OptionEnvoyee = { texte: string; image?: ImageEnvoyee | null; correcte?: boolean };
export type SondageEnvoye = { type: TypeSondage; choixMultiples: boolean; dureeJours: DureeSondage; explication: string; options: OptionEnvoyee[] };

export const OPTION_MAX = 80;
export const EXPLICATION_MAX = 300;
export const BORNES: Record<TypeSondage, [number, number]> = { texte: [2, 10], images: [2, 6], quiz: [2, 6] };
export const DUREES_SONDAGE: { value: string; label: string }[] = [
  { value: "1", label: "1 jour" },
  { value: "3", label: "3 jours" },
  { value: "7", label: "1 semaine" },
  { value: "14", label: "2 semaines" },
  { value: "", label: "Sans fin" },
];

const NOMBRE: Record<TypeSondage, string> = {
  texte: "Un sondage a de 2 à 10 options.",
  images: "Un sondage avec images a de 2 à 6 images.",
  quiz: "Un quiz a de 2 à 6 réponses.",
};

/** Le premier refus d'un sondage ou d'un quiz ; null s'il est bon. Pour un sondage avec images, `image` doit être présente. */
export function refusSondage(s: SondageEnvoye): string | null {
  const [min, max] = BORNES[s.type];
  if (s.options.length < min || s.options.length > max) return NOMBRE[s.type];
  for (const o of s.options) {
    const texte = o.texte.trim();
    if (texte.length > OPTION_MAX) return "Une option fait 80 caractères au plus.";
    if (s.type === "images" && !o.image) return "Chaque option d’un sondage avec images a son image.";
    if (s.type !== "images" && !texte) return "Écrivez chaque option.";
  }
  if (s.type === "quiz") {
    if (s.options.filter((o) => o.correcte).length !== 1) return "Un quiz a une seule bonne réponse.";
    if (s.explication.trim().length > EXPLICATION_MAX) return "L’explication fait 300 caractères au plus.";
  }
  return null;
}

/** Le sondage tel que l'attend la base (`publier`, p_sondage). */
export function versBase(s: SondageEnvoye) {
  const quiz = s.type === "quiz";
  return {
    type: s.type,
    choix_multiples: !quiz && s.choixMultiples,
    duree_jours: quiz ? null : s.dureeJours,
    explication: quiz ? s.explication.trim() || null : null,
    options: s.options.map((o) => ({ texte: o.texte.trim(), image: o.image ?? null, correcte: quiz && o.correcte === true })),
  };
}

/** Une heure de parution : de 10 minutes à 3 mois après maintenant. */
/** Au moment d'envoyer, la base tolère 9 minutes : l'heure choisie à 10 minutes reste valable une minute de plus. */
export const TOLERANCE_PROGRAMMATION = 9;

export function refusProgrammation(iso: string, maintenant: Date, minutes = 10): string | null {
  const moment = Date.parse(iso);
  if (Number.isNaN(moment)) return "Choisissez la date et l’heure.";
  if (moment < maintenant.getTime() + minutes * 60_000) return "Choisissez une heure au moins 10 minutes plus tard.";
  const limite = new Date(maintenant);
  limite.setMonth(limite.getMonth() + 3);
  if (moment > limite.getTime()) return "Choisissez une date dans les 3 mois qui viennent.";
  return null;
}

/** La part d'une option, en pourcentage arrondi ; aucun vote : 0. */
export function pourcentage(votes: number, total: number): number {
  return total > 0 ? Math.round((votes * 100) / total) : 0;
}
