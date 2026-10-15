// L'identifiant d'un certificat et son adresse de vérification (celle du QR Code).

/** « ET-2026-K7Q2-M9XD » : l'année, puis 8 caractères (sans 0, O, 1, I). */
const IDENTIFIANT = /^ET-\d{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

/** La saisie mise en forme (majuscules, sans espaces autour), ou null si elle n'a pas la forme d'un identifiant. */
export function normaliserIdentifiant(saisie: string): string | null {
  const identifiant = (typeof saisie === "string" ? saisie : "").trim().toUpperCase();
  return IDENTIFIANT.test(identifiant) ? identifiant : null;
}

/**
 * L'identifiant lu dans une adresse /c/… : décodé si possible (un QR Code abîmé ou une adresse recopiée peut porter un
 * « % » invalide, qui ferait échouer le décodage), 200 caractères au plus.
 */
export function identifiantDeLAdresse(brut: string): string {
  let texte = brut;
  try {
    texte = decodeURIComponent(brut);
  } catch {
    texte = brut;
  }
  return texte.slice(0, 200);
}

/** L'adresse publique qui montre directement le résultat de la vérification. */
export function adresseVerification(identifiant: string): string {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return `${site}/c/${identifiant}`;
}
