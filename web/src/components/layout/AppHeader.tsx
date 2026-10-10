import type { ReactNode } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { ActionButton, CounterPill, LogoButton, SearchButton } from "@/components/ui/TopBarButtons";
import { LIENS_ENTETE_TELEPHONE } from "@/lib/navigation";
import type { ShellUser } from "@/lib/demo-user";

/**
 * En-tête de l'espace connecté (NdAccueil). Sous 1024 px (NdMobAccueil) : logo, loupe, série et cloche,
 * collés en haut de l'écran ; le profil passe par l'onglet « Profil » de la barre du bas, le catalogue par sa page.
 */
export function AppHeader({ user, actions }: { user: ShellUser; actions?: ReactNode }) {
  return (
    <header className="relative z-30 flex flex-none items-center justify-between gap-2 px-4 py-3 max-lg:sticky max-lg:top-0 max-lg:bg-page lg:flex-wrap lg:gap-3 lg:py-5 lg:pr-6 lg:pl-0">
      <div className="flex min-w-0 flex-wrap items-center gap-2 lg:gap-3">
        <LogoButton href="/accueil" />
        <SearchButton href="/recherche" className="hidden gap-1.5 pr-4 pl-3.5 lg:flex" />
        <ActionButton href="/formations" className="hidden lg:flex">
          Ajouter une formation
        </ActionButton>
      </div>
      <div className="relative flex flex-wrap items-center gap-2 lg:gap-3">
        {LIENS_ENTETE_TELEPHONE.map((e) => (
          <Link
            key={e.href}
            href={e.href}
            aria-label={e.label}
            className="focus-etudium flex size-12 flex-none items-center justify-center rounded-bouton bg-coque text-texte no-underline transition-colors hover:bg-coque-survol lg:hidden"
          >
            <Icon icon={e.icon} size={20} />
          </Link>
        ))}
        <CounterPill icon="serie" value={user.serie} label="Série d’apprentissage" className="max-lg:h-12 max-lg:gap-[7px] max-lg:px-3.5" />
        <CounterPill icon="points" value={user.points} label="Points" className="hidden lg:flex" />
        {actions}
      </div>
    </header>
  );
}
