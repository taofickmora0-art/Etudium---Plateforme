// L'adresse publique du site (NEXT_PUBLIC_SITE_URL), pour les liens absolus : image de partage, QR Code des
// certificats, robots.txt et plan du site. Le build de production Vercel l'exige en https:// (next.config.ts) ;
// en local et en prévisualisation, repli sur http://localhost:3000.

const LOCAL = "http://localhost:3000";

/**
 * L'adresse du site, sans « / » final. Lue en toutes lettres par défaut (process.env.NEXT_PUBLIC_SITE_URL) pour que
 * Next l'injecte aussi dans le code envoyé au navigateur.
 */
export function adresseDuSite(brute: string | undefined = process.env.NEXT_PUBLIC_SITE_URL): string {
  return (brute?.trim() || LOCAL).replace(/\/+$/, "");
}
