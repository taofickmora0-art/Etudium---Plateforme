import { getShellUser, type ShellUser } from "@/lib/auth/current-user";
import { AuthUnavailableError } from "@/lib/auth/session-state";

/**
 * Le compte connecté qui regarde le catalogue, ou null pour un visiteur. Si Supabase est injoignable, on montre le
 * catalogue public plutôt qu'un écran d'erreur : ces pages sont ouvertes à tous.
 */
export async function compteConnecte(): Promise<ShellUser | null> {
  try {
    return await getShellUser();
  } catch (erreur) {
    if (erreur instanceof AuthUnavailableError) return null;
    throw erreur;
  }
}
