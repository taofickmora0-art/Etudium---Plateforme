// L'inscription aux formations (migration 0069 ; spec du 2 novembre 2026, §2).

/** Une inscription du compte connecté : la formation et sa date (la première, l'inscription est rejouable). */
export type Inscription = { formationId: string; inscritLe: string };

/**
 * L'accès du compte connecté à une formation (inscrit_formation et formation_ouverte, migration 0069) : est-il inscrit ?
 * La formation lui est-elle ouverte (gratuite, ou abonnement actif) ? Sert au bouton « S'inscrire à ce cours ».
 */
export type AccesFormation = { inscrit: boolean; ouverte: boolean };
