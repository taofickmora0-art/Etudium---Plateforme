// L'inscription aux formations (migration 0069 ; spec du 2 novembre 2026, §2).

/** Une inscription du compte connecté : la formation et sa date (la première, l'inscription est rejouable). */
export type Inscription = { formationId: string; inscritLe: string };
