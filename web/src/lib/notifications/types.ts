// Centre de notifications (spec des notifications, migration 0016).

/** Les catégories de l'onglet Notifications du profil (dont « messages », lot 5), plus « service » (compte et travail :
 * toujours envoyée). */
export const CATEGORIES_NOTIFICATION = [
  "nouveaux_contenus",
  "sessions_live",
  "expiration_renouvellement",
  "exercices",
  "rappels_apprentissage",
  "communaute",
  "messages",
  "recommandations",
  "annonces",
  "service",
] as const;

export type CategorieNotification = (typeof CATEGORIES_NOTIFICATION)[number];

export type NotificationLue = {
  /** Identifiant croissant : il sert aussi de curseur à « Voir plus ». */
  id: string;
  categorie: CategorieNotification;
  titre: string;
  texte: string;
  /** Toujours une adresse du site, ou rien. */
  lien: string | null;
  creeLe: string;
  lue: boolean;
};

/** Une lecture : les notifications, s'il en reste après, et le nombre de toutes les non lues du compte. */
export type LotNotifications = { lignes: NotificationLue[]; suite: boolean; nonLues: number };

/** Une annonce envoyée, vue par l'équipe (back-office). */
export type Annonce = {
  id: string;
  titre: string;
  texte: string;
  lien: string | null;
  /** « Aïcha Kpadé », ou « Compte supprimé ». */
  auteur: string;
  creeLe: string;
  destinataires: number;
};
