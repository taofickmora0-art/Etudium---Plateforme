import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { HeaderAccount } from "@/components/layout/AppHeader";
import { AppShell } from "@/components/layout/AppShell";
import { getShellUser } from "@/lib/auth/current-user";

async function CompteDeLEntete() {
  const user = await getShellUser();
  // Le proxy a déjà renvoyé les visiteurs sans session. Ici, Supabase ne reconnaît plus la session (fermée sur un autre
  // appareil, compte supprimé) : /auth/sortie l'efface de l'appareil, sinon proxy et connexion se renverraient la balle.
  if (!user) redirect("/auth/sortie");
  return <HeaderAccount user={user} />;
}

/**
 * Espace connecté. La coque et la page s'affichent sans attendre la lecture du compte (guide « Authentication with
 * Cache Components ») : seule la partie de l'en-tête propre au compte arrive ensuite.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell
      account={
        <Suspense fallback={null}>
          <CompteDeLEntete />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}
