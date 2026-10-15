// Pages « Bientôt disponible » : textes seuls, sans icônes (lus par la coque côté serveur et par les tests).

const LOT_1 = "au lot 1, Catalogue et apprentissage";
const LOT_5 = "au lot 5, Communauté et accompagnement";

/**
 * Pages « Bientôt disponible » : clé = adresse sans « / ». `quand` dit à quel moment l'écran arrive,
 * d'après la feuille de route (docs/superpowers/specs/2026-10-09-feuille-de-route-design.md).
 */
export const PAGES_A_VENIR = {
  messages: { titre: "Messages", quand: LOT_5, description: "Vous pourrez écrire à vos formateurs." },
  aide: { titre: "Aide", quand: LOT_1, description: "Les réponses aux questions fréquentes s’afficheront ici." },
  abonnement: { titre: "Mon abonnement", quand: "au lot 2, Abonnements et paiement", description: "Votre formule, vos paiements et vos reçus s’afficheront ici." },
  admin: { titre: "Back-office", quand: "au lot 1, avec le back-office de saisie", description: "L’équipe Étudium y gérera les formations et les comptes." },
  // Back-office (menu de l'équipe)
  "admin/paiements": { titre: "Abonnements et paiements", quand: "au lot 2, Abonnements et paiement", description: "Les formules, les abonnements et les paiements s’afficheront ici." },
  // Espace formateur (son propre menu)
  "formateur/messages": { titre: "Messages", quand: LOT_5, description: "Vous pourrez écrire à vos étudiants." },
} satisfies Record<string, { titre: string; quand: string; description: string }>;

export type PageAVenir = keyof typeof PAGES_A_VENIR;
