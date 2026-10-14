// Types de la communauté (spec du 14 octobre 2026, migration 0019).

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
};

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
  reactions: number;
  jAime: boolean;
  reponses: number;
  /** Les deux dernières, dans l'ordre chronologique. */
  dernieresReponses: Reponse[];
  peutSupprimer: boolean;
};

export type PublicationDetail = Publication & { toutesReponses: Reponse[] };

export type LotPublications = { publications: Publication[]; suite: boolean };

/** Le fil d'un onglet : « tous » (Général) ou l'identifiant d'un parcours. */
export type FiltreFil = "tous" | string;

export type Curseur = { avant: string; avantId: string };

export type MembreActif = { prenom: string; nomCourt: string; initiales: string; espace: string };
