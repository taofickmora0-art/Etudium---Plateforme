import { BookOpen01Icon, Notification02Icon, Video01Icon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@/components/ui/Icon";
import type { AppNotification, TonNotification } from "@/components/ui/NotificationsPanel";
import { quand } from "@/lib/notifications/temps";
import type { CategorieNotification, NotificationLue } from "@/lib/notifications/types";

/**
 * Pastille de chaque catégorie (spec des notifications, §3) : nouveaux contenus en bleu, annonces en violet, service
 * (compte et travail) en gris. Les autres catégories servent aux parties suivantes du lot 5 et aux lots 2 et 3.
 */
export const TON_CATEGORIE: Record<CategorieNotification, { tone: TonNotification; icon?: IconSvgElement }> = {
  nouveaux_contenus: { tone: "information", icon: BookOpen01Icon },
  annonces: { tone: "annonce" },
  service: { tone: "neutre", icon: Notification02Icon },
  sessions_live: { tone: "information", icon: Video01Icon },
  communaute: { tone: "neutre" },
  exercices: { tone: "reussite" },
  expiration_renouvellement: { tone: "attention" },
  rappels_apprentissage: { tone: "information" },
  recommandations: { tone: "information" },
};

/** Une notification de la base, prête pour le panneau ou la page ; `quandDe` donne le moment affiché. */
export function versPanneau(n: NotificationLue, maintenant: Date, quandDe: (iso: string, maintenant: Date) => string = quand): AppNotification {
  return {
    id: n.id,
    ...TON_CATEGORIE[n.categorie],
    title: n.titre,
    body: n.texte,
    when: quandDe(n.creeLe, maintenant),
    unread: !n.lue,
    href: n.lien ?? undefined,
  };
}
