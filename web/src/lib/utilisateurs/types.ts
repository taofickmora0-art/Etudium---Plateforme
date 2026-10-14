import type { Role } from "@/lib/auth/permissions";

// Page Utilisateurs du back-office (spec 2026-10-13-utilisateurs-roles).

export type FiltreComptes = "tous" | "etudiants" | "formateurs" | "equipe" | "suspendus";

/** Une ligne de la liste des comptes. */
export type CompteResume = {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  roles: Role[];
  inscritLe: string;
  /** Null s'il ne s'est jamais connecté. */
  derniereConnexion: string | null;
  suspendu: boolean;
};

export type PageComptes = { total: number; comptes: CompteResume[] };

/** La fiche d'un compte : identité, rôles, suspension, fiche formateur reliée, activité. */
export type CompteDetail = Omit<CompteResume, "suspendu"> & {
  suspension: { depuis: string; parNom: string; motif: string } | null;
  ficheFormateur: { id: string; nom: string } | null;
  formations: { id: string; titre: string; slug: string; terminees: number; total: number; derniereActivite: string }[];
  avis: { id: string; formationTitre: string; note: number; commentaire: string; masque: boolean; creeLe: string }[];
};

/** Une lecture qui dépend de la migration 0013 : sans elle, la page le dit au lieu d'échouer. */
export type Lecture<T> = { migrationAbsente: true } | { migrationAbsente: false; donnees: T };

/** Le résultat d'une action : son refus est affiché tel quel. */
export type Resultat = { ok: boolean; message?: string };

/** Une remarque d'un formateur sur ce compte (migration 0015), lue par l'équipe. */
export type RemarqueFormateur = { formateurNom: string; texte: string; modifieeLe: string };
