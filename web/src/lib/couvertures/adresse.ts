// Adresse publique des couvertures (espace de stockage « couvertures », public, migration 0012). Sans dépendance :
// utilisée par les composants, le serveur et next.config (images autorisées).

const DOSSIER = "/storage/v1/object/public/couvertures";

/** L'adresse publique d'une couverture, ou null (pas d'image, ou base non configurée : couverture par défaut). */
export function urlCouverture(chemin: string | null, supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL): string | null {
  if (!chemin || !supabaseUrl) return null;
  return `${supabaseUrl.replace(/\/+$/, "")}${DOSSIER}/${chemin}`;
}

/** Les adresses d'images que `next/image` peut optimiser : les couvertures du projet Supabase. */
export function motifsImages(supabaseUrl: string | undefined): { protocol: "https"; hostname: string; pathname: string }[] {
  if (!supabaseUrl) return [];
  try {
    return [{ protocol: "https", hostname: new URL(supabaseUrl).hostname, pathname: `${DOSSIER}/**` }];
  } catch {
    return [];
  }
}
