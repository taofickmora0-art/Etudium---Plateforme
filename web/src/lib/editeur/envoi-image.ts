import type { SupabaseClient } from "@supabase/supabase-js";
import { FORMATS } from "@/lib/admin/fichiers";
import { identifiantAleatoire } from "@/lib/identifiant";
import { ESPACE_IMAGES } from "@/lib/lecon/images";
import { createClient } from "@/lib/supabase/client";

// L'envoi d'une image du contenu riche (fin du lot 4, spec §1.2), depuis le navigateur, dans le dossier de la formation
// de l'espace privé `images_lecons` (la règle de stockage n'y laisse déposer que l'équipe et le formateur de la
// formation). Le format se lit dans les premiers octets du fichier, pas dans son nom.

export const IMAGE_MAX_OCTETS = 5_242_880;
const EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export type EnvoiImage = { ok: true; chemin: string; url: string } | { ok: false; message: string };

export async function envoyerImage(formationId: string, fichier: File, client?: SupabaseClient): Promise<EnvoiImage> {
  if (fichier.size > IMAGE_MAX_OCTETS) return { ok: false, message: "L’image dépasse 5 Mo." };
  const octets = new Uint8Array(await fichier.slice(0, 16).arrayBuffer());
  // Le nom ne compte pas (une photo de téléphone sans extension, un PNG nommé .webp) : seuls les premiers octets.
  const format = FORMATS.find((f) => EXTENSIONS[f.mime] && f.signature?.(octets))?.mime;
  const extension = format ? EXTENSIONS[format] : undefined;
  if (!format || !extension) return { ok: false, message: "Format accepté : JPEG, PNG ou WebP." };
  const chemin = `${formationId}/${identifiantAleatoire()}.${extension}`;
  try {
    const stockage = (client ?? createClient()).storage.from(ESPACE_IMAGES);
    // Une copie typée : le navigateur annoncerait sinon son propre type (voir RessourcesEditor).
    const { error } = await stockage.upload(chemin, fichier.slice(0, fichier.size, format), { contentType: format, upsert: false });
    if (error) return { ok: false, message: "L’image n’a pas pu être envoyée. Réessayez." };
    const { data } = await stockage.createSignedUrl(chemin, 3600);
    return { ok: true, chemin, url: data?.signedUrl ?? "" };
  } catch {
    return { ok: false, message: "L’image n’a pas pu être envoyée. Réessayez." };
  }
}

/**
 * Les liens des images de l'éditeur : ceux de la page (re-signés à chaque relecture) passent devant ceux des images
 * envoyées pendant la séance, qui ne servent qu'aux images que la page ne connaît pas encore.
 */
export function liensImages(page: Record<string, string>, envoyees: Record<string, string>): Record<string, string> {
  return { ...envoyees, ...page };
}
