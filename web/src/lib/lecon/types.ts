import type { Reponse } from "@/lib/communaute/types";
import type { FicheFormation } from "@/lib/catalogue/types";
import type { Intervalle } from "@/lib/video/suivi";

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

/** Temps regardé de la leçon par le compte connecté (migration 0007). */
export type VisionnageLecon = { passages: Intervalle[]; positionSecondes: number; terminee: boolean };

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
  /** Null pour un visiteur, une leçon fermée, ou sans la table du visionnage. */
  visionnage: VisionnageLecon | null;
};

export type DonneesLecon = {
  fiche: FicheFormation;
  lecon: LeconDetail;
  /** Note privée du compte connecté (null : aucune, ou visiteur). */
  note: string | null;
  /** Faux tant que la table des notes (migration 0006) n'est pas dans la base. */
  notesDisponibles: boolean;
  /** Les discussions de la leçon (0028) : la première page ; null sans accès, commentaires fermés ou avant la 0028. */
  discussion?: { total: number; reponses: Reponse[] } | null;
};
