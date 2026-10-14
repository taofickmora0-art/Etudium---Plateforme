import type { ReactNode } from "react";
import type { Espace } from "@/lib/auth/permissions";
import { AppHeader } from "./AppHeader";
import { MobileNav } from "./MobileNav";
import { SidebarNav } from "./SidebarNav";

/**
 * Coque de l'espace connecté. Elle s'affiche sans attendre le compte : `account` (compteurs, cloche, profil)
 * arrive ensuite dans l'en-tête.
 * - À partir de 1024 px (NdAccueil) : en-tête, cadre gris-bleu arrondi 32 px, barre latérale de 337 px, panneau blanc ; la page défile.
 * - En dessous (NdMobAccueil) : en-tête compact, panneau blanc arrondi en haut, barre du bas. C'est la page qui défile,
 *   l'en-tête et la barre du bas restent collés : chaque page s'ouvre en haut, le retour arrière retrouve la position,
 *   et les barres du navigateur peuvent se replier.
 */
export function AppShell({ account, espace, children }: { account?: ReactNode; /** Espace connu d'avance (menus du rendu préalable). */ espace?: Espace; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-page lg:px-5 lg:pb-5">
      <a
        href="#contenu"
        className="focus-etudium sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-champ focus:bg-panneau focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-bleu focus:shadow-menu"
      >
        Aller au contenu
      </a>
      <AppHeader account={account} />
      <div className="flex flex-1 lg:items-stretch lg:rounded-coque lg:bg-coque">
        <SidebarNav className="hidden lg:block" espace={espace} />
        <main
          id="contenu"
          tabIndex={-1}
          className="mx-2 min-w-0 flex-1 rounded-t-panneau bg-panneau px-4 py-5 outline-none lg:mt-[15px] lg:mr-5 lg:mb-5 lg:ml-0 lg:rounded-panneau lg:p-8"
        >
          {children}
        </main>
      </div>
      <div className="sticky bottom-0 z-30 bg-page px-2 pb-2 lg:hidden">
        <MobileNav espace={espace} />
      </div>
    </div>
  );
}
