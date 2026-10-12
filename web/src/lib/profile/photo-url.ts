import { getPublicEnv } from "@/lib/env";

/** Un fichier du dossier d'une personne : « <id>/<nom>.jpg » ou « .png », sans détour (pas de « .. », ni d'adresse, ni de paramètre). */
const CHEMIN = /^[0-9a-z-]+\/[0-9a-z-]+\.(jpg|png)$/i;

/**
 * Adresse publique d'une photo de profil à partir du chemin enregistré dans `profils.photo_url`.
 * Une adresse complète enregistrée avant la migration 0003 est ramenée à son chemin ; toute autre valeur
 * donne null (la coque affiche les initiales) : on n'affiche jamais une image prise ailleurs.
 */
export function photoPublicUrl(chemin: string | null | undefined): string | null {
  const relatif = (chemin ?? "").trim().replace(/^.*\/photos-profil\//, "");
  if (!CHEMIN.test(relatif)) return null;
  return `${getPublicEnv().supabaseUrl}/storage/v1/object/public/photos-profil/${relatif}`;
}
