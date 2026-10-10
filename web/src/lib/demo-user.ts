import type { ShellUser } from "@/lib/auth/current-user";

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
};
