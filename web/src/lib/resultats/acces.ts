import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// Le jeton de déverrouillage de « Mes résultats » (migration 0077) : rendu par la base quand le code est bon, gardé
// dans un cookie httpOnly (le navigateur ne peut pas le lire), et envoyé à chaque requête du serveur dans l'en-tête
// lu par les règles d'accès. Serveur seulement.

export const COOKIE_RESULTATS = "etudium-resultats";
export const ENTETE_RESULTATS = "x-etudium-resultats";

/** Le client de la base pour les résultats : avec le jeton du cookie, s'il y en a un. */
export async function clientResultats() {
  const jeton = (await cookies()).get(COOKIE_RESULTATS)?.value ?? "";
  return createClient(jeton ? { entetes: { [ENTETE_RESULTATS]: jeton } } : {});
}

/** Garde le jeton (cookie de session, httpOnly) ; null : le retire. */
export async function garderJeton(jeton: string | null) {
  const magasin = await cookies();
  if (!jeton) {
    magasin.delete(COOKIE_RESULTATS);
    return;
  }
  magasin.set(COOKIE_RESULTATS, jeton, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
}
