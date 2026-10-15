// Onglet Notifications du profil (NdProfil) : les 8 catégories du design, plus « Messages » (lot 5), et 2 canaux, rangés
// dans `profils.preferences_notifications`.

export const NOTIFICATION_CATEGORIES = [
  { key: "nouveaux_contenus", label: "Nouveaux contenus", description: "Nouvelles leçons dans vos parcours" },
  { key: "sessions_live", label: "Sessions live", description: "Programmation et rappels 1 h avant" },
  { key: "expiration_renouvellement", label: "Expiration et renouvellement", description: "Rappels avant la fin de votre abonnement" },
  { key: "exercices", label: "Exercices", description: "Corrections et remarques de vos formateurs" },
  { key: "rappels_apprentissage", label: "Rappels d’apprentissage", description: "Pour garder votre série active" },
  { key: "communaute", label: "Communauté", description: "Réponses et mentions dans vos publications" },
  { key: "messages", label: "Messages", description: "Messages de vos formateurs et de l’équipe" },
  { key: "recommandations", label: "Recommandations", description: "Formations suggérées selon votre progression" },
  { key: "annonces", label: "Annonces", description: "Nouveautés d’Étudium" },
] as const;

export const CHANNELS = [
  { key: "canal_appli", label: "Notifications dans l’appli" },
  { key: "canal_push", label: "Notifications push" },
] as const;

export type PreferenceKey = (typeof NOTIFICATION_CATEGORIES)[number]["key"] | (typeof CHANNELS)[number]["key"];
export type NotificationPreferences = Record<PreferenceKey, boolean>;

export const PREFERENCE_KEYS: PreferenceKey[] = [...NOTIFICATION_CATEGORIES.map((c) => c.key), ...CHANNELS.map((c) => c.key)];

/** Préférences lues en base : une clé absente ou mal formée vaut « activé » ; les clés inconnues sont ignorées. */
export function readPreferences(raw: unknown): NotificationPreferences {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(PREFERENCE_KEYS.map((k) => [k, typeof source[k] === "boolean" ? source[k] : true])) as NotificationPreferences;
}
