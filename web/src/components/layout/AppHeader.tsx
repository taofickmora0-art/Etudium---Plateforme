import type { ReactNode } from "react";
import { ActionButton, CounterPill, LogoButton, SearchButton } from "@/components/ui/TopBarButtons";
import type { ShellUser } from "@/lib/demo-user";

/**
 * En-tête de l'espace connecté (NdAccueil). Sous 1024 px (NdMobAccueil), seuls le logo, la série
 * et la cloche restent : la recherche, l'action et le profil passent par la barre du bas.
 */
export function AppHeader({ user, actions }: { user: ShellUser; actions?: ReactNode }) {
  return (
    <header className="relative z-30 flex flex-none items-center justify-between gap-2 px-4 py-3 lg:flex-wrap lg:gap-3 lg:py-5 lg:pr-6 lg:pl-0">
      <div className="flex min-w-0 flex-wrap items-center gap-2 lg:gap-3">
        <LogoButton href="/accueil" />
        <SearchButton href="/recherche" className="hidden gap-1.5 pr-4 pl-3.5 lg:flex" />
        <ActionButton href="/formations" className="hidden lg:flex">
          Ajouter une formation
        </ActionButton>
      </div>
      <div className="relative flex flex-wrap items-center gap-2 lg:gap-3">
        <CounterPill icon="serie" value={user.serie} label="Série d’apprentissage" className="max-lg:h-12 max-lg:gap-[7px] max-lg:px-3.5" />
        <CounterPill icon="points" value={user.points} label="Points" className="hidden lg:flex" />
        {actions}
      </div>
    </header>
  );
}
