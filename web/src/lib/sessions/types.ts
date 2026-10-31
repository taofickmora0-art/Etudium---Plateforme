import type { Video } from "@/lib/communaute/video";

// Événements et sessions live (spec des sessions live, migration 0018 ; promotion, migration 0024).

export type VueSessions = "a_venir" | "inscriptions" | "passees";
export type StatutSession = "programmee" | "annulee";

/** Une carte de la page Événements. Le lien n'y est que dans sa fenêtre (10 min avant le début, jusqu'à la fin). */
export type SessionCarte = {
  id: string;
  titre: string;
  description: string;
  debut: string;
  dureeMinutes: number;
  /** « Google Meet », « Zoom », « En ligne ». */
  plateforme: string;
  lien: string | null;
  parcours: { nomCourt: string; couleur: string } | null;
  /** Le nom de la fiche formateur, ou « Équipe Étudium ». */
  animateur: string;
  inscriptions: number;
  inscrit: boolean;
  statut: StatutSession;
};

/** La carte de l'accueil : avec les initiales des 3 premiers inscrits. */
export type ProchaineSession = SessionCarte & { initiales: string[] };

/** Une ligne des listes de l'animateur et de l'équipe. */
export type LigneSessionEdition = {
  id: string;
  titre: string;
  debut: string;
  dureeMinutes: number;
  plateforme: string;
  statut: StatutSession;
  inscriptions: number;
  parcours: { nomCourt: string; couleur: string } | null;
  animateur: string;
};

export type ListeSessionsEdition = { aVenir: LigneSessionEdition[]; passees: LigneSessionEdition[] };

/** La fiche d'une session, pour son animateur et l'équipe : le lien et les inscrits (prénom et nom, jamais l'e-mail). */
export type SessionDetail = {
  id: string;
  titre: string;
  description: string;
  debut: string;
  dureeMinutes: number;
  plateforme: string;
  lien: string | null;
  parcours: { id: string; nomCourt: string; couleur: string } | null;
  formateurId: string | null;
  animateur: string;
  statut: StatutSession;
  annuleeLe: string | null;
  inscrits: { prenom: string; nom: string }[];
  /** Le visuel de promotion : l'affiche (avec un lien temporaire) ou la vidéo ; null sans visuel ou avant la 0024. */
  promoImage: (PieceSession & { url: string | null }) | null;
  promoVideo: Video | null;
};

/** L'affiche d'une session : un fichier de l'espace de stockage « communaute ». */
export type PieceSession = { chemin: string; nom: string; type: string; taille: number };

/** Le bloc d'une session dans sa publication de la communauté (jamais son lien). */
export type SessionPublication = {
  id: string;
  debut: string;
  dureeMinutes: number;
  plateforme: string;
  animateur: string;
  statut: StatutSession;
  inscriptions: number;
  inscrit: boolean;
};

/** Ce que saisit le formulaire ; date et heure à l'heure du Bénin. */
export type DonneesSession = {
  titre: string;
  description: string;
  /** « 2026-10-24 ». */
  date: string;
  /** « 15:00 ». */
  heure: string;
  /** Le fuseau dans lequel la date et l'heure sont saisies (celui de l'appareil du formateur) ; le Bénin à défaut. */
  fuseau?: string;
  dureeMinutes: number;
  lien: string;
  parcoursId: string | null;
  /** L'animateur choisi par l'équipe ; ignoré pour un formateur (il anime toujours ses sessions). */
  formateurId: string | null;
  /** Le visuel de promotion : une affiche déjà déposée, ou l'adresse d'une vidéo (pas les deux). */
  image?: PieceSession | null;
  video?: string | null;
};
