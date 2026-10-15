// Pages « Bientôt disponible » : textes seuls, sans icônes (lus par la coque côté serveur et par les tests).

/**
 * Pages « Bientôt disponible » : clé = adresse sans « / ». `quand` dit à quel moment l'écran arrive,
 * d'après la feuille de route (docs/superpowers/specs/2026-10-09-feuille-de-route-design.md).
 */
export const PAGES_A_VENIR = {
  abonnement: { titre: "Mon abonnement", quand: "au lot 2, Abonnements et paiement", description: "Votre formule, vos paiements et vos reçus s’afficheront ici." },
  admin: { titre: "Back-office", quand: "au lot 1, avec le back-office de saisie", description: "L’équipe Étudium y gérera les formations et les comptes." },
  // Back-office (menu de l'équipe)
  "admin/paiements": { titre: "Abonnements et paiements", quand: "au lot 2, Abonnements et paiement", description: "Les formules, les abonnements et les paiements s’afficheront ici." },
} satisfies Record<string, { titre: string; quand: string; description: string }>;

export type PageAVenir = keyof typeof PAGES_A_VENIR;
