import type { TagTone } from "@/components/ui/Tag";

// Le journal des actions de l'équipe (lot 6 A, spec §2 ; migration 0061).

export type CategorieJournal = "comptes" | "paiements" | "contenus" | "communaute";
export type PeriodeJournal = "7" | "30" | "365" | "tout";

export type LigneJournal = { id: string; creeLe: string; auteurNom: string; categorie: CategorieJournal; resume: string };
export type PageJournal = { lignes: LigneJournal[]; suite: boolean };
export type FiltresJournal = { categorie: CategorieJournal | null; auteur: string | null; jours: number | null };
export type AuteurJournal = { id: string; nom: string };

export const CATEGORIES_JOURNAL: { value: CategorieJournal; label: string; ton: TagTone }[] = [
  { value: "comptes", label: "Comptes", ton: "enAttente" },
  { value: "paiements", label: "Paiements", ton: "valide" },
  { value: "contenus", label: "Contenus", ton: "populaire" },
  { value: "communaute", label: "Communauté", ton: "aCorriger" },
];

export const PERIODES_JOURNAL: { value: PeriodeJournal; label: string }[] = [
  { value: "7", label: "7 jours" },
  { value: "30", label: "30 jours" },
  { value: "365", label: "12 mois" },
  { value: "tout", label: "Tout" },
];

export const estCategorieJournal = (v: unknown): v is CategorieJournal => CATEGORIES_JOURNAL.some((c) => c.value === v);
export const estPeriodeJournal = (v: unknown): v is PeriodeJournal => PERIODES_JOURNAL.some((p) => p.value === v);
export const joursDe = (p: PeriodeJournal): number | null => (p === "tout" ? null : Number(p));
