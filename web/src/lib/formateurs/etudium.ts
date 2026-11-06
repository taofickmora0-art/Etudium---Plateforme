// L'Équipe Étudium, formatrice des formations sans formateur (migration 0078) : son profil public est
// /formateurs/etudium, avec les formations publiées sans formateur (celles réalisées avec des coachs extérieurs).

/** L'identifiant de son profil, dans l'adresse /formateurs/[id]. */
export const ID_ETUDIUM = "etudium";

/** Son avatar : l'icône de l'application. */
export const PHOTO_ETUDIUM = "/icons/icone-192.png";

export const estEtudium = (id: string) => id === ID_ETUDIUM;
