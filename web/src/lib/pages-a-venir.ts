// Pages « Bientôt disponible » : textes seuls, sans icônes (lus par la coque côté serveur et par les tests).

const LOT_1 = "au lot 1, Catalogue et apprentissage";
const LOT_5 = "au lot 5, Communauté et accompagnement";

/**
 * Pages « Bientôt disponible » : clé = adresse sans « / ». `quand` dit à quel moment l'écran arrive,
 * d'après la feuille de route (docs/superpowers/specs/2026-10-09-feuille-de-route-design.md).
 */
export const PAGES_A_VENIR = {
  evenements: { titre: "Événements", quand: LOT_5, description: "Les sessions live et les événements de vos parcours s’afficheront ici." },
  communaute: { titre: "Communauté", quand: LOT_5, description: "Vous pourrez échanger avec les autres étudiants de vos parcours." },
  messages: { titre: "Messages", quand: LOT_5, description: "Vous pourrez écrire à vos formateurs." },
  notifications: { titre: "Notifications", quand: LOT_5, description: "Toutes vos notifications seront réunies ici." },
  recherche: { titre: "Recherche", quand: LOT_1, description: "Vous pourrez chercher une formation, un parcours ou une ressource." },
  aide: { titre: "Aide", quand: LOT_1, description: "Les réponses aux questions fréquentes s’afficheront ici." },
  exercices: { titre: "Exercices", quand: "au lot 3, Quiz, exercices et certificats", description: "Vos exercices à rendre et à corriger s’afficheront ici." },
  certificats: { titre: "Certificats", quand: "au lot 3, Quiz, exercices et certificats", description: "Vos certificats et leur QR Code de vérification s’afficheront ici." },
  abonnement: { titre: "Mon abonnement", quand: "au lot 2, Abonnements et paiement", description: "Votre formule, vos paiements et vos reçus s’afficheront ici." },
  formateur: { titre: "Espace formateur", quand: "au lot 4, Espace formateur", description: "Les formateurs y créeront et suivront leurs formations." },
  admin: { titre: "Back-office", quand: "au lot 1, avec le back-office de saisie", description: "L’équipe Étudium y gérera les formations et les comptes." },
} satisfies Record<string, { titre: string; quand: string; description: string }>;

export type PageAVenir = keyof typeof PAGES_A_VENIR;
