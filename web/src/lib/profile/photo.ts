// Photo de profil : JPG ou PNG, 2 Mo maximum (spec §6). Fonctions pures, utilisées dans le navigateur et sur le serveur.

export const PHOTO_MAX_OCTETS = 2 * 1024 * 1024;
export const PHOTO_TYPE = "Choisissez une image JPG ou PNG.";
export const PHOTO_TROP_LOURDE = "Cette image dépasse 2 Mo. Choisissez-en une plus légère.";
export const PHOTO_ECHEC = "La photo n’a pas pu être enregistrée. Réessayez.";

/** Le type d'après les premiers octets du fichier (sa signature), jamais d'après son nom. */
export function detectImageType(bytes: Uint8Array): "image/jpeg" | "image/png" | null {
  const debut = (signature: number[]) => signature.every((octet, i) => bytes[i] === octet);
  if (debut([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (debut([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  return null;
}

/** Premier contrôle dans le navigateur, avant la réduction : le format annoncé. La taille se vérifie après réduction. */
export function checkPhotoFile(file: { type: string; size: number }): string | null {
  return file.type === "image/jpeg" || file.type === "image/png" ? null : PHOTO_TYPE;
}

/** Carré centré dans l'image, réduit à `max` pixels de côté au plus. */
export function squareCrop(width: number, height: number, max = 512): { sx: number; sy: number; side: number; size: number } {
  const side = Math.min(width, height);
  return { sx: Math.round((width - side) / 2), sy: Math.round((height - side) / 2), side, size: Math.min(side, max) };
}
