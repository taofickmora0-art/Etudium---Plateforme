/**
 * Une erreur de Supabase Auth dit-elle que la session est vraiment fermée (déconnexion ailleurs, compte supprimé,
 * jeton invalide) ? Sinon, c'est un incident passager (réseau coupé, Supabase indisponible) : on ne déconnecte
 * personne pour autant, la session de 30 jours reste sur l'appareil.
 */
export function isSessionClosed(error: { name?: string; status?: number } | null | undefined): boolean {
  if (!error) return false;
  if (error.name === "AuthRetryableFetchError") return false;
  const status = error.status;
  if (status === undefined || status === 0 || status >= 500) return false;
  return true;
}

/** Supabase Auth ne répond pas : la page affiche « Réessayer » (error.tsx) au lieu de déconnecter. */
export class AuthUnavailableError extends Error {
  constructor() {
    super("Supabase Auth injoignable");
    this.name = "AuthUnavailableError";
  }
}
