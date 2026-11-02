import type { DocumentLecon } from "@/lib/lecon/document";
import type { EtatEdition, SaisieInfos, SaisieLecon } from "@/lib/editeur/types";
import type { GenreExercice } from "@/lib/exercices/types";
import type { TypeLecon } from "@/lib/catalogue/types";
import type { EtatFormation } from "@/lib/contenus/etat";
import type { Badge, CouleurParcours, Niveau, StatutFormation } from "@/lib/contenus/libelles";
import type { Reseaux } from "@/lib/formateurs/reseaux";
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

export type FormateurAdmin = {
  id: string;
  nom: string;
  titre: string;
  domaine: string;
  presentation: string;
  /** Les réseaux renseignés (0070), lus pour la fiche seulement ; vides avant la migration. */
  reseaux?: Reseaux;
};

export type FormationResume = {
  id: string;
  slug: string;
  titre: string;
  statut: StatutFormation;
  niveau: Niveau;
  nbLecons: number;
  /** Noms courts des parcours (« Académique »). */
  parcours: string[];
  /** État affiché, relecture comprise (migration 0014) : Brouillon, En attente de validation, À corriger… */
  etat: EtatFormation;
  /** Dernière modification par son formateur une fois en ligne (0014), ou null. */
  modifieeParFormateurLe: string | null;
  /** Des brouillons attendent « Publier les modifications » (0056) ; faux avant la 0056. */
  modificationsNonPubliees?: boolean;
  /** Pour la carte du back-office : le résumé, la couverture, la note, le formateur, la couleur du premier parcours. */
  resume?: string;
  couverture?: string | null;
  note?: number | null;
  nbAvis?: number;
  formateur?: string | null;
  couleur?: CouleurParcours;
};

/** `publiee` : statut de la leçon (0027) ; vrai avant la 0027. */
export type LeconResume = {
  id: string;
  titre: string;
  dureeSecondes: number;
  apercu: boolean;
  aVideo: boolean;
  publiee: boolean;
  /** Leçon de contenu, quiz ou exercice (0031) ; « lecon » avant la 0031. */
  type: TypeLecon;
  /** Le nombre de questions d'un quiz (0031), pour l'onglet Leçons ; absent s'il n'a pas pu être lu. */
  nbQuestions?: number;
  /** Un exercice (0032) : simple, ou avec rendu ; null pour les autres types, ou avant la 0032. */
  genreExercice?: GenreExercice | null;
  /** Modifiée, pas encore publiée : un brouillon l'attend (0056). */
  brouillon?: boolean;
};

export type ModuleAdmin = { id: string; titre: string; ordre: number; lecons: LeconResume[] };

export type FormationAdmin = FormationResume & {
  resume: string;
  description: string;
  objectifs: string[];
  competences: string[];
  formateurId: string | null;
  gratuite: boolean;
  badge: Badge | null;
  seuilVideo: number;
  /** Score minimal aux quiz (0031) ; null avant la 0031 (le champ n'est pas affiché). */
  scoreQuiz: number | null;
  /** « Exercices obligatoires » pour le certificat (0033) ; null avant la 0033 (le réglage n'est pas affiché). */
  exercicesObligatoires: boolean | null;
  publieeLe: string | null;
  parcoursIds: string[];
  modules: ModuleAdmin[];
  /** Chemin de l'image de couverture (migration 0012), ou null. */
  couverture: string | null;
  /** Relecture (migration 0014) : envoyée par le formateur, renvoyée par l'équipe avec sa remarque. */
  envoyeeLe: string | null;
  renvoyeeLe: string | null;
  remarqueRelecture: string | null;
  /** Les informations générales dans l'éditeur (0056) : le brouillon s'il existe ; absent avant la 0056. */
  edition?: EtatEdition<SaisieInfos>;
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
  /** Pour « Voir comme un étudiant ». */
  formationSlug: string;
  /** Statut (0027) ; vrai avant la 0027. */
  publiee: boolean;
  /** « Activer les commentaires » (0027) ; vrai avant la 0027. */
  commentairesActifs: boolean;
  /** Leçon de contenu, quiz ou exercice (0031) ; « lecon » avant la 0031. */
  type: TypeLecon;
  /** Un exercice (0032) : simple, ou avec rendu ; null pour les autres types, ou avant la 0032. */
  genreExercice: GenreExercice | null;
  /** « Leçon 2 sur 5 · Module 1 : titre » : son rang dans toute la formation, et sa section. */
  position: { rang: number; total: number; module: { rang: number; titre: string } };
  /** Les leçons voisines dans l'ordre de la formation (flèches ‹ › de l'éditeur). */
  voisines: { precedente: string | null; suivante: string | null };
  titre: string;
  titreCourt: string | null;
  dureeSecondes: number;
  apercu: boolean;
  resume: string;
  pointsCles: string[];
  video: Video | null;
  texte: string;
  /** Le contenu riche (fin du lot 4) ; une leçon ancienne arrive convertie depuis son texte. */
  document?: DocumentLecon;
  /** Le lien signé de chaque image du document (et de son brouillon). */
  images?: Record<string, string>;
  /** Ce que l'éditeur affiche et enregistre (0056) : le brouillon s'il existe, sinon l'en-ligne ; absent avant la 0056. */
  edition?: EtatEdition<SaisieLecon>;
  ressources: RessourceAdmin[];
};

