import { HeaderAccount } from "@/components/layout/AppHeader";
import { getShellUser } from "@/lib/auth/current-user";
import { redirectToSortie } from "@/lib/auth/sortie";
import { AuthUnavailableError } from "@/lib/auth/session-state";

/** La partie de l'en-tête propre au compte (compteurs, cloche, rond de profil), lue après la coque. */
export async function CompteDeLEntete() {
  let user;
  try {
    user = await getShellUser();
  } catch (erreur) {
    // Supabase injoignable : l'en-tête s'affiche sans le compte ; la page, elle, propose de réessayer (error.tsx).
    if (erreur instanceof AuthUnavailableError) return null;
    throw erreur;
  }
  // Le proxy a déjà renvoyé les visiteurs sans session. Ici, Supabase ne reconnaît plus la session (fermée sur un autre
  // appareil, compte supprimé) : /auth/sortie l'efface de l'appareil, sinon proxy et connexion se renverraient la balle.
  if (!user) return redirectToSortie();
  return <HeaderAccount user={user} />;
}
