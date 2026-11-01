// Les règles des abonnements (lot 2) : durées, montants, dates.

/** « 3 mois », « 6 mois », « 1 an ». */
export const dureeAbonnement = (mois: number): string => (mois === 12 ? "1 an" : `${mois} mois`);
