// Les onglets de « Mon profil » (NdProfil). « Préférences », sur la page Notifications, ouvre directement le sien :
// /profil?onglet=notifications. Toute autre valeur ouvre Informations.

export const ONGLETS_PROFIL = ["informations", "notifications", "securite"] as const;
export type OngletProfil = (typeof ONGLETS_PROFIL)[number];

export const ongletProfil = (valeur: string | undefined): OngletProfil =>
  ONGLETS_PROFIL.includes(valeur as OngletProfil) ? (valeur as OngletProfil) : "informations";
