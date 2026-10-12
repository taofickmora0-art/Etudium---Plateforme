import type { Badge, CouleurParcours, Niveau } from "@/lib/contenus/libelles";

// Ce que le catalogue et la fiche formation lisent de la base (formations publiées seulement).

export type ParcoursCatalogue = { slug: string; nom: string; nomCourt: string; couleur: CouleurParcours; ordre: number };

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
};

export type LeconFiche = {
  id: string;
  titre: string;
  dureeSecondes: number;
  apercu: boolean;
  /** Calculé par la base (règle d'accès de la 0004) pour la personne qui regarde. */
  accessible: boolean;
};

export type ModuleFiche = { id: string; titre: string; lecons: LeconFiche[] };

export type FormateurFiche = { nom: string; titre: string; domaine: string; presentation: string };

export type FicheFormation = CarteCatalogue & {
  description: string;
  objectifs: string[];
  competences: string[];
  formateur: FormateurFiche | null;
  modules: ModuleFiche[];
};
