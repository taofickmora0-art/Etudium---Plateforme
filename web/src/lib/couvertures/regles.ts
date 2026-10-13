// Images de couverture des formations (spec du 13 octobre 2026) : règles communes au navigateur et au serveur.

export const COUVERTURE_MAX_OCTETS = 5 * 1024 * 1024;
export const COUVERTURE_TYPE = "Choisissez une image JPG, PNG ou WebP.";
export const COUVERTURE_TROP_LOURDE = "L’image dépasse 5 Mo.";

export type TypeCouverture = "image/jpeg" | "image/png" | "image/webp";

/** Le vrai format, d'après la signature du fichier (pas son nom) : JPG, PNG ou WebP ; sinon null. */
export function detecterImage(octets: Uint8Array): TypeCouverture | null {
  const a = (signature: number[], depuis = 0) => signature.every((octet, i) => octets[depuis + i] === octet);
  if (a([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (a([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // WebP : « RIFF », la taille sur 4 octets, puis « WEBP ».
  if (a([0x52, 0x49, 0x46, 0x46]) && a([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

export const extensionDe = (type: TypeCouverture) => ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" })[type] as "jpg" | "png" | "webp";

/** Contrôle avant l'envoi : le format (signature) puis le poids. */
export function verifierCouverture(
  fichier: { size: number },
  octets: Uint8Array,
): { ok: true; type: TypeCouverture; extension: "jpg" | "png" | "webp" } | { ok: false; erreur: string } {
  const type = detecterImage(octets);
  if (!type) return { ok: false, erreur: COUVERTURE_TYPE };
  if (fichier.size > COUVERTURE_MAX_OCTETS) return { ok: false, erreur: COUVERTURE_TROP_LOURDE };
  return { ok: true, type, extension: extensionDe(type) };
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** Un fichier directement dans le dossier de la formation : `<formation_id>/<uuid>.<jpg|png|webp>`. */
export function cheminValide(formationId: string, chemin: string): boolean {
  if (!new RegExp(`^${UUID}$`, "i").test(formationId)) return false;
  return new RegExp(`^${formationId}/${UUID}\\.(jpg|png|webp)$`, "i").test(chemin);
}
