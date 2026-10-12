import { Suspense, type ReactNode } from "react";
import { HeaderAccount } from "@/components/layout/AppHeader";
import { AppShell } from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/ui/Toast";
import { getShellUser } from "@/lib/auth/current-user";
import { redirectToSortie } from "@/lib/auth/sortie";
import { AuthUnavailableError } from "@/lib/auth/session-state";

async function CompteDeLEntete() {
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

/**
 * Espace connecté. La coque et la page s'affichent sans attendre la lecture du compte (guide « Authentication with
 * Cache Components ») : seule la partie de l'en-tête propre au compte arrive ensuite.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AppShell
        account={
          <Suspense fallback={null}>
            <CompteDeLEntete />
          </Suspense>
        }
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
