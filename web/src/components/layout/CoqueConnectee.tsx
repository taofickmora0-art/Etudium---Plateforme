import { Suspense, type ReactNode } from "react";
import type { Espace } from "@/lib/auth/permissions";
import { AppShell } from "./AppShell";
import { CompteDeLEntete } from "./CompteDeLEntete";

/**
 * La coque d'un espace connecté (étudiant, formateur, back-office), avec son menu. La coque et la page s'affichent
 * sans attendre la lecture du compte (guide « Authentication with Cache Components ») : seule la partie de l'en-tête
 * propre au compte arrive ensuite.
 */
export function CoqueConnectee({ espace, children }: { espace: Espace; children: ReactNode }) {
  return (
    <AppShell
      espace={espace}
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
