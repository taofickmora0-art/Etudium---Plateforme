import type { Badge, CouleurParcours, Niveau } from "@/lib/contenus/libelles";

// Ce que le catalogue et la fiche formation lisent de la base (formations publiées seulement).

export type ParcoursCatalogue = {
  slug: string;
  nom: string;
  nomCourt: string;
  couleur: CouleurParcours;
  ordre: number;
  /** Lue pour la liste des parcours (page Mes parcours), pas sur les cartes. */
  description?: string;
};

export type CarteCatalogue = {
  id: string;
  slug: string;
  titre: string;
  resume: string;
  niveau: Niveau;
  gratuite: boolean;
  /** Disponible seule, en formation complémentaire. */
  achatSepare: boolean;
  badge: Badge | null;
  publieeLe: string;
  /** Somme des durées des leçons. */
  dureeSecondes: number;
  nbLecons: number;
  /** Parcours de la formation, avec sa position dans chacun. */
  parcours: (ParcoursCatalogue & { position: number })[];
  /** Moyenne des avis visibles, au dixième ; null sans avis ou sans la migration 0010. */
  note: number | null;
  nbAvis: number;
  /** Chemin de l'image de couverture (espace « couvertures ») ; null : couverture par défaut du parcours. */
  couverture: string | null;
};

export type LeconFiche = {
  id: string;
  titre: string;
  /** Titre raccourci du programme de gauche de la page leçon (null : le titre complet, coupé). */
  titreCourt?: string | null;
  dureeSecondes: number;
  apercu: boolean;
  /** Calculé par la base (règle d'accès de la 0004) pour la personne qui regarde. */
  accessible: boolean;
};

export type ModuleFiche = { id: string; titre: string; lecons: LeconFiche[] };

export type FormateurFiche = { nom: string; titre: string; domaine: string; presentation: string };

export type FicheFormation = CarteCatalogue & {
  description: string;
  /** Part d'une vidéo à regarder réellement pour terminer une leçon, en % (spec Q4). */
  seuilVideo: number;
  objectifs: string[];
  competences: string[];
  formateur: FormateurFiche | null;
  modules: ModuleFiche[];
};
