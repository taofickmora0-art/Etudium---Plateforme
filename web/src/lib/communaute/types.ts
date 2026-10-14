// Types de la communauté (spec du 14 octobre 2026, migration 0019 ; fil « Actualités », migration 0021).

import type { Apercu } from "./liens";
import type { Video } from "./video";

export type { Apercu, Video };

/** Un espace : le général (id null) ou celui d'un parcours ; `ouvert` dit si le compte peut y lire et publier. */
export type Espace = {
  id: string | null;
  nom: string;
  nomCourt: string;
  couleur: string | null;
  slug: string | null;
  ouvert: boolean;
};

/** Le fichier joint d'une publication ; `url` est un lien temporaire (1 h), null s'il n'a pas pu être obtenu. */
export type PieceJointe = { chemin: string; nom: string; type: string; taille: number; url: string | null };

/** Ce que le navigateur transmet après avoir déposé le fichier. */
export type PieceEnvoyee = Omit<PieceJointe, "url">;

export type Reponse = {
  id: string;
  auteur: { prenom: string; nomCourt: string };
  estMoi: boolean;
  texte: string;
  creeLe: string;
  peutSupprimer: boolean;
  /** Ni l'auteur, ni l'équipe (migration 0020). */
  peutSignaler: boolean;
};

/** « en_attente » : vue par son auteur (et l'équipe) seulement ; « bloquee » : par l'équipe seule (migration 0020). */
export type StatutPublication = "publiee" | "en_attente" | "bloquee";

export type RoleAuteur = "formateur" | "equipe" | null;

export type Publication = {
  id: string;
  auteur: { prenom: string; nom: string; role: RoleAuteur };
  estMoi: boolean;
  espace: { id: string | null; nom: string };
  titre: string;
  texte: string;
  pieceJointe: PieceJointe | null;
  creeLe: string;
  modifiee: boolean;
  statut: StatutPublication;
  reactions: number;
  jAime: boolean;
  reponses: number;
  /** Les deux dernières, dans l'ordre chronologique. */
  dernieresReponses: Reponse[];
  peutSupprimer: boolean;
  peutSignaler: boolean;
  /** L'aperçu de la première adresse du texte (0021) ; null sans lien ou avant la 0021. */
  apercu: Apercu | null;
  /** Dans les signets du compte (0021). */
  enregistree: boolean;
  /** Les initiales des trois derniers qui l'aiment (0021). */
  aimeePar: string[];
  /** La vidéo jointe (0022) ; null sans vidéo ou avant la 0022. */
  video: Video | null;
};

export type PublicationDetail = Publication & { toutesReponses: Reponse[] };

export type LotPublications = { publications: Publication[]; suite: boolean };

/** Le fil : « tous » (tous les espaces ouverts), « general » (le général seul, 0021) ou l'identifiant d'un parcours. */
export type FiltreFil = "tous" | "general" | string;

/** Le tri du fil (0021) : les plus récentes, les plus aimées et commentées en 30 jours, ou les signets du compte. */
export type TriFil = "recentes" | "populaires" | "enregistrees";

export type Curseur = { avant: string; avantId: string };

/** La suite d'un fil : un curseur pour les plus récentes, un numéro de page pour les deux autres tris. */
export type SuiteFil = { curseur?: Curseur | null; page?: number };

/** Une publication tendance (0021) : les plus aimées et commentées des 7 derniers jours. */
export type Tendance = { id: string; extrait: string; auteur: { nomCourt: string; initiales: string; equipe: boolean } };

/** Une activité récente (0021) : une publication ou une réponse, dans un espace ouvert au compte. */
export type Activite = {
  type: "publication" | "commentaire";
  publicationId: string;
  auteur: { nomCourt: string; initiales: string };
  extrait: string;
  creeLe: string;
};

/** L'annonce épinglée en tête des Actualités (0021), telle que la voit un membre ; `image` est un lien temporaire. */
export type Annonce = { titre: string; texte: string; media: "youtube" | "image" | null; youtubeId: string | null; image: string | null };

/** Le réglage complet de l'annonce, pour l'équipe. */
export type AnnonceEquipe = Annonce & { active: boolean; imageChemin: string | null; public: "tous" | "parcours"; parcoursId: string | null };

/** Ce que le formulaire de l'équipe transmet : l'adresse YouTube telle que saisie, l'affiche déjà déposée. */
export type DonneesAnnonce = {
  active: boolean;
  titre: string;
  texte: string;
  media: "youtube" | "image" | null;
  youtube: string;
  imageChemin: string | null;
  public: "tous" | "parcours";
  parcoursId: string | null;
};

/** Le compte connecté, pour l'avatar du champ de publication et le dossier de ses fichiers. */
export type MoiCommunaute = {
  compteId: string;
  prenom: string;
  nom: string;
  initiales: string;
  photoUrl: string | null;
  /** L'équipe : « Gérer l’annonce » (0021). */
  equipe?: boolean;
};
