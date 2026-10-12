import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { CompteDeLEntete } from "@/components/layout/CompteDeLEntete";
import { ToastProvider } from "@/components/ui/Toast";

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
