import type { ShellUser } from "@/lib/auth/current-user";
import type { ProfileData } from "@/lib/profile/data";
import { readPreferences } from "@/lib/profile/preferences";

/**
 * Utilisatrice des écrans du design, affichée uniquement en mode démonstration (base de test pas encore
 * configurée, sur l'ordinateur de développement). Les trois rôles montrent tout le menu du profil pendant la validation.
 */
export const DEMO_USER: ShellUser = {
  prenom: "Aïcha",
  nom: "Kpadé",
  initials: "AK",
  email: "aicha.k@exemple.com",
  roles: ["etudiant", "formateur", "admin"],
  statut: "Étudiante",
  formule: "Standard",
  serie: 8,
  points: 165,
  photoUrl: null,
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
