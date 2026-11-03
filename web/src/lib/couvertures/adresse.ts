// Adresse publique des couvertures (espace de stockage « couvertures », public, migration 0012). Sans dépendance :
// utilisée par les composants, le serveur et next.config (images autorisées).

const DOSSIER = "/storage/v1/object/public/couvertures";

/**
 * L'adresse du projet Supabase (« https://abcd.supabase.co »), telle que la saisie la donne : espaces et « / » de fin
 * retirés, et l'adresse d'une de ses API (« …/rest/v1/ », « …/auth/v1 », « …/storage/v1 ») ramenée au projet. Le
 * 3 novembre 2026, « …/rest/v1/ » collé dans Vercel faisait échouer l'inscription sans trace dans Supabase.
 */
export function racineSupabase(saisie: string | undefined): string {
  return (saisie ?? "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/(rest|auth|storage)\/v1$/i, "")
    .replace(/\/+$/, "");
}

/** L'adresse publique d'une couverture, ou null (pas d'image, ou base non configurée : couverture par défaut). */
export function urlCouverture(chemin: string | null, supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL): string | null {
  const racine = racineSupabase(supabaseUrl);
  if (!chemin || !racine) return null;
  return `${racine}${DOSSIER}/${chemin}`;
}

/** Les adresses d'images que `next/image` peut optimiser : les couvertures du projet Supabase. */
export function motifsImages(supabaseUrl: string | undefined): { protocol: "https"; hostname: string; pathname: string }[] {
  if (!supabaseUrl) return [];
  try {
    return [{ protocol: "https", hostname: new URL(racineSupabase(supabaseUrl)).hostname, pathname: `${DOSSIER}/**` }];
  } catch {
    return [];
  }
}
