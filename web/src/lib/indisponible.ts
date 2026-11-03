// Une fonction absente de la base (sa migration n'est pas appliquée) : l'équipe lit quelle migration appliquer ; un
// étudiant, un formateur ou un visiteur lit seulement que la fonction n'est pas disponible, sans numéro ni guide.

export const INDISPONIBLE = "Cette fonction n’est pas disponible pour le moment.";

/** Le message d'une fonction absente de la base : celui de la migration pour l'équipe, le message neutre sinon. */
export const messageAbsente = (equipe: boolean, migration: string) => (equipe ? migration : INDISPONIBLE);
