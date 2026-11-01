// Pages « Bientôt disponible » : textes seuls, sans icônes (lus par la coque côté serveur et par les tests).

/**
 * Pages « Bientôt disponible » : clé = adresse sans « / ». `quand` dit à quel moment l'écran arrive,
 * d'après la feuille de route (docs/superpowers/specs/2026-10-09-feuille-de-route-design.md).
 */
export const PAGES_A_VENIR = {
  admin: { titre: "Back-office", quand: "au lot 1, avec le back-office de saisie", description: "L’équipe Étudium y gérera les formations et les comptes." },
} satisfies Record<string, { titre: string; quand: string; description: string }>;

export type PageAVenir = keyof typeof PAGES_A_VENIR;
