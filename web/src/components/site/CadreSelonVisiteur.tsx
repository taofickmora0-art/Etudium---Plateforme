import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { CompteDeLEntete } from "@/components/layout/CompteDeLEntete";
import { ToastProvider } from "@/components/ui/Toast";
import { compteConnecte } from "@/lib/catalogue/visiteur";
import { CadrePublic } from "./CadrePublic";

/**
 * Le catalogue et les fiches ont une seule adresse (spec du lot 1, §2) : un visiteur les voit dans le cadre public,
 * un compte connecté dans la coque de l'appli (barre latérale, menu du bas).
 */
export async function CadreSelonVisiteur({ children }: { children: ReactNode }) {
  const compte = await compteConnecte();
  if (!compte) return <CadrePublic>{children}</CadrePublic>;
  return (
    <ToastProvider>
      <AppShell
        espace="etudiant"
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
