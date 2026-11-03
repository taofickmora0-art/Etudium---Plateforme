// Où envoyer une requête selon qu'on est connecté ou non (spec §4 et §7). Utilisé par le proxy.

/**
 * Pages ouvertes sans compte. Tout le reste est réservé aux comptes connectés : une page ajoutée plus tard
 * est protégée d'office. Le site public ajoute ses pages ici ; la racine (la landing) est traitée à part dans `routeFor`.
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
  // Catalogue et fiches des formations (lot 1, spec §2) : la même adresse pour le visiteur et l'étudiant.
  "/formations",
  // Le profil public d'un formateur (spec du 2 novembre 2026, §6). « /formateur » (son espace) reste fermé.
  "/formateurs",
  // La vérification d'un certificat, sans compte (lot 3, R23) : la page du formulaire et celle du QR Code.
  "/verifier",
  "/c",
];
/** En-tête de requête où le proxy note la page demandée (les pages n'ont pas d'autre moyen de la connaître). */
export const EN_TETE_CHEMIN = "x-etudium-chemin";

const ECRANS_DE_COMPTE = ["/connexion", "/inscription", "/verification-email", "/mot-de-passe-oublie"];

const dans = (pathname: string, chemins: string[]) => chemins.some((c) => pathname === c || pathname.startsWith(`${c}/`));

type Situation = { pathname: string; signedIn: boolean; hadSession: boolean };

/** Routes d'API : elles vérifient la session elles-mêmes et répondent 401 (une redirection rendrait une page HTML). */
const API = "/api";

export function routeFor({ pathname, signedIn, hadSession }: Situation): { redirect?: string } {
  if (dans(pathname, [API])) return {};
  // La racine : la landing pour tous, compte connecté compris (demande du 3 novembre 2026) ; son en-tête propose
  // alors « Accéder à l'espace membre ».
  if (pathname === "/") return {};
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
