// Règles du centre de notifications (spec des notifications, §3 et §4).

/** Notifications listées dans la cloche, et par lecture sur la page (« Voir plus »). */
export const NOMBRE_CLOCHE = 8;
export const NOMBRE_PAGE = 20;

export const ANNONCE_TITRE_MAX = 80;
export const ANNONCE_TEXTE_MAX = 300;
const LIEN_MAX = 300;

/** Émis sur `window` après un marquage hors de la cloche (page Notifications) : la cloche se recharge. */
export const EVENEMENT_NOTIFICATIONS = "etudium:notifications";

/** Les messages de refus d'une annonce, les mêmes que ceux de la base (publier_annonce). */
export const REFUS_ANNONCE = {
  titre: "Écrivez un titre (80 caractères au plus).",
  texte: "Écrivez le texte de l’annonce (300 caractères au plus).",
  lien: "Le lien doit être une adresse du site, commençant par « / ».",
} as const;

/** Une adresse du site : « / » d'abord, jamais « // » (un autre site), ni espace ni barre oblique inversée. */
export const lienDuSite = (lien: string) => lien.startsWith("/") && !lien.startsWith("//") && !/[\s\\]/.test(lien) && lien.length <= LIEN_MAX;
