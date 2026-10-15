// L'identifiant d'un certificat et son adresse de vérification (celle du QR Code).

/** « ET-2026-K7Q2-M9XD » : l'année, puis 8 caractères (sans 0, O, 1, I). */
const IDENTIFIANT = /^ET-\d{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

/** La saisie mise en forme (majuscules, sans espaces autour), ou null si elle n'a pas la forme d'un identifiant. */
export function normaliserIdentifiant(saisie: string): string | null {
  const identifiant = (typeof saisie === "string" ? saisie : "").trim().toUpperCase();
  return IDENTIFIANT.test(identifiant) ? identifiant : null;
}

/** L'adresse publique qui montre directement le résultat de la vérification. */
export function adresseVerification(identifiant: string): string {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return `${site}/c/${identifiant}`;
}
