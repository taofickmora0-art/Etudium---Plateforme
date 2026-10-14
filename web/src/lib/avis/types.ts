// Avis des étudiants (spec du lot 1, Q8, §7) : une note de 1 à 5 et un commentaire facultatif (migration 0010).

export type Etoiles = 1 | 2 | 3 | 4 | 5;

/** Un avis tel que la base le rend à tous : prénom et initiale de l'auteur, jamais son identifiant. */
export type AvisPublic = {
  id: string;
  note: Etoiles;
  commentaire: string;
  /** « Fifamè A. ». */
  auteur: string;
  /** « FA ». */
  initiales: string;
  creeLe: string;
  modifieLe: string;
  /**
   * L'avis du compte connecté. Masqué par l'équipe, il lui reste visible, sans aucune mention : son auteur ne doit
   * pas savoir qu'il est masqué (spec des notifications, §5).
   */
  estMoi: boolean;
};

export type ResumeAvis = {
  /** Moyenne au dixième, ou null sans avis. */
  moyenne: number | null;
  total: number;
  /** Nombre d'avis visibles par note. */
  repartition: Record<Etoiles, number>;
};

export type AvisFormation = { avis: AvisPublic[]; resume: ResumeAvis };

/** Un avis vu par l'équipe (back-office, spec §10). */
export type AvisEquipe = {
  id: string;
  formationTitre: string;
  formationSlug: string;
  auteur: string;
  note: Etoiles;
  commentaire: string;
  masque: boolean;
  creeLe: string;
};
