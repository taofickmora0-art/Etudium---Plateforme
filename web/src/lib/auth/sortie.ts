import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { EN_TETE_CHEMIN } from "./routing";

/**
 * Mène à /auth/sortie (session fermée ailleurs) en gardant la page demandée, posée par le proxy dans un en-tête :
 * après la reconnexion, on y revient au lieu de l'accueil.
 */
export async function redirectToSortie(): Promise<never> {
  const chemin = (await headers()).get(EN_TETE_CHEMIN);
  redirect(chemin ? `/auth/sortie?next=${encodeURIComponent(chemin)}` : "/auth/sortie");
}
