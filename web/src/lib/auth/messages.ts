// Traduction des erreurs de Supabase Auth en messages clairs, sans jargon et sans révéler si un compte existe.

const GENERIQUE = "Une erreur est survenue. Vérifiez votre connexion, puis réessayez.";
const TROP_DE_DEMANDES = "Trop de demandes. Patientez une minute, puis réessayez.";

const MESSAGES: Record<string, string> = {
  invalid_credentials: "E-mail ou mot de passe incorrect.",
  otp_expired: "Ce code est incorrect ou a expiré. Demandez-en un nouveau.",
  over_email_send_rate_limit: TROP_DE_DEMANDES,
  over_request_rate_limit: TROP_DE_DEMANDES,
  weak_password: "Choisissez un mot de passe d’au moins 8 caractères.",
  same_password: "Choisissez un mot de passe différent de l’ancien.",
  email_address_invalid: "Cette adresse e-mail n’est pas acceptée.",
  signup_disabled: "Les inscriptions sont fermées pour le moment.",
};

export function authErrorMessage(error: { code?: string; status?: number } | null | undefined): string {
  if (!error) return GENERIQUE;
  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code];
  if (error.status === 429) return TROP_DE_DEMANDES;
  return GENERIQUE;
}

/**
 * Page où aller après la connexion. N'accepte qu'un chemin du site (« /certificats ») :
 * jamais une adresse extérieure (« https://… », « //… », « /\… »), pour qu'un lien piégé ne fasse pas sortir du site.
 * L'adresse est lue comme un navigateur la lirait : il efface tabulations et retours à la ligne, si bien que
 * « /\t/pirate » deviendrait « //pirate ». Seul un chemin qui reste sur le site est accepté.
 */
export function safeNext(value: string | null | undefined, fallback = "/accueil"): string {
  if (!value || !value.startsWith("/")) return fallback;
  const ORIGINE = "http://etudium.invalid";
  try {
    const url = new URL(value, ORIGINE);
    if (url.origin !== ORIGINE) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
