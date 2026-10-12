// Où envoyer une requête selon qu'on est connecté ou non (spec §4 et §7). Utilisé par le proxy.

/**
 * Pages ouvertes sans compte. Tout le reste est réservé aux comptes connectés : une page ajoutée plus tard
 * est protégée d'office. Le site public (lot 1) ajoutera ses pages ici.
 */
export const PAGES_PUBLIQUES = [
  "/connexion",
  "/inscription",
  "/verification-email",
  "/mot-de-passe-oublie",
  "/nouveau-mot-de-passe",
  "/conditions",
  "/confidentialite",
  "/etat",
  "/vitrine",
  "/auth",
];
const ECRANS_DE_COMPTE = ["/connexion", "/inscription", "/verification-email", "/mot-de-passe-oublie"];

const dans = (pathname: string, chemins: string[]) => chemins.some((c) => pathname === c || pathname.startsWith(`${c}/`));

type Situation = { pathname: string; signedIn: boolean; hadSession: boolean };

export function routeFor({ pathname, signedIn, hadSession }: Situation): { redirect?: string } {
  if (pathname === "/") return { redirect: signedIn ? "/accueil" : "/connexion" };
  if (!dans(pathname, PAGES_PUBLIQUES) && !signedIn) {
    // Un cookie de session était là mais n'est plus valable : on l'annonce (fenêtre « Votre session a expiré »).
    const next = `next=${encodeURIComponent(pathname)}`;
    return { redirect: hadSession ? `/connexion?session=expiree&${next}` : `/connexion?${next}` };
  }
  if (dans(pathname, ECRANS_DE_COMPTE) && signedIn) return { redirect: "/accueil" };
  return {};
}

/** Un cookie de session Supabase (« sb-<projet>-auth-token », éventuellement découpé en morceaux) est-il présent ? */
export const hasSessionCookie = (names: string[]) => names.some((n) => /^sb-.+-auth-token(\.\d+)?$/.test(n));

/**
 * Mode démonstration : sur l'ordinateur de développement, tant que la base de test n'est pas configurée,
 * l'espace connecté reste ouvert (avec l'utilisatrice des écrans du design) pour pouvoir valider la coque.
 * Jamais en production : une version en ligne sans base resterait fermée.
 */
export function isDemoMode({ configured, nodeEnv }: { configured: boolean; nodeEnv: string | undefined }): boolean {
  return !configured && nodeEnv === "development";
}
