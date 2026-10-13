import type { Badge, CouleurParcours, Niveau, StatutFormation } from "@/lib/contenus/libelles";
import type { Video } from "./video";

// Ce que le back-office lit de la base (migration 0004), en camelCase.

export type ParcoursAdmin = {
  id: string;
  slug: string;
  nom: string;
  nomCourt: string;
  description: string;
  couleur: CouleurParcours;
  ordre: number;
  actif: boolean;
};

export type FormateurAdmin = { id: string; nom: string; titre: string; domaine: string; presentation: string };

export type FormationResume = {
  id: string;
  slug: string;
  titre: string;
  statut: StatutFormation;
  niveau: Niveau;
  nbLecons: number;
  /** Noms courts des parcours (« Académique »). */
  parcours: string[];
};

export type LeconResume = { id: string; titre: string; dureeSecondes: number; apercu: boolean; aVideo: boolean };

export type ModuleAdmin = { id: string; titre: string; ordre: number; lecons: LeconResume[] };

export type FormationAdmin = FormationResume & {
  resume: string;
  description: string;
  objectifs: string[];
  competences: string[];
  formateurId: string | null;
  gratuite: boolean;
  achatSepare: boolean;
  prixFcfa: number | null;
  badge: Badge | null;
  seuilVideo: number;
  publieeLe: string | null;
  parcoursIds: string[];
  modules: ModuleAdmin[];
};

export type RessourceAdmin = {
  id: string;
  titre: string;
  fichier: string;
  format: string;
  tailleOctets: number;
  telechargeable: boolean;
  ordre: number;
};

export type LeconAdmin = {
  id: string;
  moduleId: string;
  formationId: string;
  formationTitre: string;
  titre: string;
  titreCourt: string | null;
  dureeSecondes: number;
  apercu: boolean;
  resume: string;
  pointsCles: string[];
  video: Video | null;
  texte: string;
  ressources: RessourceAdmin[];
};

export type ResumeContenus = {
  parcours: number;
  formateurs: number;
  publiees: number;
  brouillons: number;
  archivees: number;
  /** Avis des étudiants ; null sans la migration 0010. */
  avis: number | null;
  avisMasques: number;
};
