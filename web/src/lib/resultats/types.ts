// « Mes résultats » (migration 0077, spec du 5 novembre 2026) : ce que l'étudiant saisit. Les moyennes, crédits et
// mentions se calculent dans calcul.ts.

/** Un type de notes du barème : « Contrôle continu », 40 % ; `examen` : celui que le rattrapage remplace. */
export type Categorie = { cle: string; nom: string; poids: number; examen?: boolean };

/** Ce que fait une note de rattrapage : elle remplace celle de l'examen, ou la meilleure des deux est gardée. */
export type ModeRattrapage = "remplace" | "meilleure";

/** Les règles de calcul d'un parcours (celles de l'école de l'étudiant). */
export type Regles = {
  seuilUe: number;
  seuilSemestre: number;
  /** Activée : toutes les UE d'un semestre sont acquises si sa moyenne atteint `seuilSemestre`. */
  compensation: boolean;
  rattrapage: ModeRattrapage;
  categories: Categorie[];
};

export type Parcours = { id: string; nom: string; etablissement: string; regles: Regles; ordre: number };
export type Semestre = { id: string; parcoursId: string; nom: string; annee: string; ordre: number };
export type Ue = { id: string; semestreId: string; code: string; intitule: string; credits: number; ordre: number };
/** `poids` : ses crédits, ou son coefficient ; `bareme` : son barème propre (null : celui du parcours). */
export type Ecue = { id: string; ueId: string; intitule: string; poids: number; bareme: Categorie[] | null; ordre: number };
/** Une note : `categorie` est la clé d'un type du barème ; un rattrapage porte celle du type « examen ». */
export type Note = { id: string; ecueId: string; categorie: string; libelle: string; note: number; sur: number; rattrapage: boolean; date: string | null; creeLe: string };

/** Un parcours et tout ce qu'il contient, triés dans leur ordre. */
export type ParcoursComplet = { parcours: Parcours; semestres: Semestre[]; ues: Ue[]; ecues: Ecue[]; notes: Note[] };

/** L'état de l'espace : un code existe-t-il, est-il ouvert, bloqué (5 erreurs), la proposition a-t-elle été vue. */
export type EtatResultats = { pin: boolean; ouvert: boolean; bloqueJusqua: string | null; propose: boolean };
