import type { FicheFormation } from "@/lib/catalogue/types";

// Ce que la page leçon lit de la base. Le contenu (vidéo, texte, ressources) n'existe que si la personne a accès.

export type RessourceLecon = {
  id: string;
  titre: string;
  /** Type MIME du fichier (voir FORMATS du back-office). */
  format: string;
  tailleOctets: number;
  telechargeable: boolean;
};

export type VideoLecon = { fournisseur: "youtube" | "vimeo"; id: string };

export type LeconDetail = {
  id: string;
  titre: string;
  dureeSecondes: number;
  apercu: boolean;
  accessible: boolean;
  /** « Dans cette leçon » : lisibles par tous, comme le programme. */
  resume: string;
  pointsCles: string[];
  /** Vides sans accès à la leçon. */
  video: VideoLecon | null;
  texte: string;
  ressources: RessourceLecon[];
};

export type DonneesLecon = {
  fiche: FicheFormation;
  lecon: LeconDetail;
  /** Note privée du compte connecté (null : aucune, ou visiteur). */
  note: string | null;
  /** Faux tant que la table des notes (migration 0006) n'est pas dans la base. */
  notesDisponibles: boolean;
};
