import type { ReactNode } from "react";
import type { ShellUser } from "@/lib/demo-user";
import { AppHeader } from "./AppHeader";
import { MobileNav } from "./MobileNav";
import { SidebarNav } from "./SidebarNav";

/**
 * Coque de l'espace connecté.
 * - À partir de 1024 px (NdAccueil) : en-tête, cadre gris-bleu arrondi 32 px, barre latérale de 337 px, panneau blanc ; la page défile.
 * - En dessous (NdMobAccueil) : en-tête compact, panneau blanc arrondi en haut qui défile seul, barre du bas collée dessous.
 */
export function AppShell({ user, actions, children }: { user: ShellUser; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-dvh flex-col bg-page lg:h-auto lg:min-h-dvh lg:px-5 lg:pb-5">
      <a
        href="#contenu"
        className="focus-etudium sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-champ focus:bg-panneau focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-bleu focus:shadow-menu"
      >
        Aller au contenu
      </a>
      <AppHeader user={user} actions={actions} />
      <div className="flex min-h-0 flex-1 lg:items-stretch lg:rounded-coque lg:bg-coque">
        <SidebarNav className="hidden lg:flex" />
        <main
          id="contenu"
          tabIndex={-1}
          className="mx-2 min-h-0 min-w-0 flex-1 overflow-y-auto rounded-t-panneau bg-panneau px-4 py-5 outline-none lg:mt-[15px] lg:mr-5 lg:mb-5 lg:ml-0 lg:overflow-visible lg:rounded-panneau lg:p-8"
        >
          {children}
        </main>
      </div>
      <MobileNav className="lg:hidden" />
    </div>
  );
}
