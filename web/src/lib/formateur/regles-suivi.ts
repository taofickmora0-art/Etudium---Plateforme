import type { TagTone } from "@/components/ui/Tag";
import type { EtatSuivi, FiltreSuivi } from "./suivi";

// Règles d'affichage du suivi des étudiants (spec « Étudiants » et tableau de bord du formateur, §2 à §4).
// Formulations sans genre : l'application ne connaît pas celui des étudiants.

export const LIGNES_PAR_PAGE = 25;
export const REMARQUE_MAX = 2000;

export const ETATS_SUIVI: Record<EtatSuivi, string> = { en_cours: "En cours", a_risque: "À risque", terminee: "Terminée" };

export const TON_SUIVI: Record<EtatSuivi, TagTone> = { en_cours: "compteur", a_risque: "echoue", terminee: "valide" };

export const FILTRES_SUIVI: { value: FiltreSuivi; label: string }[] = [
  { value: "tous", label: "Tous" },
  { value: "a_risque", label: "À risque" },
  { value: "terminees", label: "Terminés" },
];

export const estFiltreSuivi = (valeur: unknown): valeur is FiltreSuivi => FILTRES_SUIVI.some((f) => f.value === valeur);

/** « 1 h 25 de vidéo », « 45 min de vidéo » ; le temps de vidéo réellement regardé (migration 0007). */
export function dureeVideo(secondes: number): string {
  if (secondes <= 0) return "Aucune vidéo regardée";
  if (secondes < 60) return "Moins d’une minute de vidéo";
  const minutes = Math.floor(secondes / 60);
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  if (heures === 0) return `${minutes} min de vidéo`;
  return reste === 0 ? `${heures} h de vidéo` : `${heures} h ${String(reste).padStart(2, "0")} de vidéo`;
}

/** « Aucune activité depuis 14 jours » (étudiants à risque du tableau de bord). */
export const inactivite = (jours: number) => `Aucune activité depuis ${jours} ${jours > 1 ? "jours" : "jour"}`;
