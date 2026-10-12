import { cookies } from "next/headers";
import { REMEMBER_COOKIE } from "./session-cookies";

/**
 * Efface la session de cet appareil : cookies de Supabase (« sb-<projet>-auth-token », parfois découpés en morceaux)
 * et choix « Se souvenir de moi ». Utilisé par la déconnexion, la sortie d'une session fermée ailleurs et la suppression du compte.
 */
export async function clearLocalSession(): Promise<void> {
  const magasin = await cookies();
  magasin
    .getAll()
    .filter(({ name }) => name.startsWith("sb-"))
    .forEach(({ name }) => magasin.delete(name));
  magasin.delete(REMEMBER_COOKIE);
}
