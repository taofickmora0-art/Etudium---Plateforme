import type { ShellUser } from "@/lib/auth/current-user";
import type { ProgressionJeu } from "@/lib/engagement/types";
import type { ProfileData } from "@/lib/profile/data";
import { readPreferences } from "@/lib/profile/preferences";

/**
 * Utilisatrice des écrans du design, affichée uniquement en mode démonstration (base de test pas encore
 * configurée, sur l'ordinateur de développement). Étudiante et équipe : deux espaces au plus (0017), et un formateur
 * n'a pas l'espace étudiant (restructuration R1).
 */
export const DEMO_USER: ShellUser = {
  prenom: "Aïcha",
  nom: "Kpadé",
  initials: "AK",
  email: "aicha.k@exemple.com",
  roles: ["etudiant", "admin"],
  statut: "Étudiante",
  formule: "Standard",
  serie: 8,
  points: 165,
  photoUrl: null,
};

/** La progression du jeu des écrans du design (NdAccueil, NdProfil : niveau 4, 8 jours, 3 badges, encore 80 points). */
export const DEMO_JEU: ProgressionJeu = {
  serie: DEMO_USER.serie,
  pointsTotal: 720,
  pointsSemaine: DEMO_USER.points,
  niveau: 4,
  pointsAvantNiveau: 80,
  objectifJours: 5,
  joursSemaine: [true, true, true, false, false, false, false],
  badges: [
    { code: "premier_pas", obtenuLe: "2026-09-02T09:00:00Z" },
    { code: "serie_3", obtenuLe: "2026-09-04T09:00:00Z" },
    { code: "serie_7", obtenuLe: "2026-10-30T09:00:00Z" },
  ],
};

/** Profil des écrans du design (NdProfil), affiché sur /profil en mode démonstration. */
export const DEMO_PROFILE: ProfileData = {
  prenom: DEMO_USER.prenom,
  nom: DEMO_USER.nom,
  email: DEMO_USER.email,
  initials: DEMO_USER.initials,
  telephone: "01 97 00 00 00",
  pays: "benin",
  niveauEtudes: "master_1",
  etablissement: "Université d’Abomey-Calavi",
  filiere: "Sociologie",
  objectifs: "Terminer mon mémoire avant juin et trouver un stage en communication digitale.",
  photoUrl: null,
  preferences: { ...readPreferences({}), recommandations: false, annonces: false },
  hasPassword: true,
  googleLinked: true,
};
