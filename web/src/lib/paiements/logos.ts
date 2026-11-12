// Les logos des opérateurs Mobile Money, hébergés avec le site (web/public/logos/mobile-money, repris de flashSMS le
// 13 novembre 2026) : quand le prestataire n'en donne pas (SasPay n'en donne aucun, Payiz pas pour Celtiis). On reconnaît
// son opérateur à son logo avant d'avoir lu son nom. Module sans rien du serveur : l'écran s'en sert.
//
// Le début du code (« mtn_bj » → « mtn ») suffit à reconnaître la marque, chez Payiz comme chez SasPay. L'ORDRE COMPTE :
// « tigo_tz » (devenu Yas) avant « tigo ».
const LOGOS: [string, string][] = [
  ["tigo_tz", "yas.svg"],
  ["tigo", "tigo.svg"],
  ["mtn", "mtn-momo.svg"],
  ["moov", "moov-money.svg"],
  ["celtiis", "celtiis-cash.svg"],
  ["orange", "orange-money.svg"],
  ["wave", "wave.svg"],
  ["airtel", "airtel-money.svg"],
  ["mpesa", "m-pesa.svg"],
  // Vodacom encaisse sous la marque M-Pesa, en RD Congo comme en Tanzanie.
  ["vodacom", "m-pesa.svg"],
  ["halopesa", "halopesa.svg"],
  ["togocel", "mixx-by-yas-togo.png"],
  ["freemoney", "mixx-by-yas-senegal.png"],
  // Vodafone Ghana est devenu Telecel.
  ["vodafone", "telecel.png"],
  ["telecel", "telecel.png"],
  ["tnm", "tnm.png"],
  ["zamtel", "zamtel.png"],
];

/** L'adresse du logo de cet opérateur, hébergé avec le site ; null pour une marque inconnue (la pastille s'affiche). */
export function logoOperateur(code: string): string | null {
  const trouve = LOGOS.find(([debut]) => code.toLowerCase().startsWith(debut));
  return trouve ? `/logos/mobile-money/${trouve[1]}` : null;
}
