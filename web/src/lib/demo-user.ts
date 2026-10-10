import type { Role } from "@/components/ui/ProfileMenu";

/**
 * Utilisateur de démonstration affiché par la coque tant que la connexion n'existe pas (tâche 0.4).
 * Ce sont les données des écrans du design ; la 0.4 les remplace par le profil de la personne connectée,
 * la 0.6 par ses vrais rôles. Les trois rôles servent à montrer tout le menu du profil pendant la validation.
 */
export const DEMO_USER = {
  prenom: "Aïcha",
  nom: "Kpadé",
  initials: "AK",
  email: "aicha.k@exemple.com",
  roles: ["etudiant", "formateur", "admin"] as Role[],
  formule: "Standard",
  serie: 8,
  points: 165,
};

export type ShellUser = typeof DEMO_USER;
