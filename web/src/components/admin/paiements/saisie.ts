/** Un champ de montant ou de nombre : seuls les chiffres sont gardés (« 15 000 FCFA » donne « 15000 »). */
export const chiffresSeulement = (saisie: string): string => saisie.replace(/\D/g, "");
