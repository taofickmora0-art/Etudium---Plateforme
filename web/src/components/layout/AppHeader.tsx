import type { ReactNode } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { CounterPill, LogoButton, SearchButton } from "@/components/ui/TopBarButtons";
import type { ShellUser } from "@/lib/auth/current-user";
import { LIENS_ENTETE_TELEPHONE } from "@/lib/navigation";
import { BoutonAjouterFormation } from "./BoutonAjouterFormation";
import { HeaderActions } from "./HeaderActions";

/**
 * En-tête de l'espace connecté (NdAccueil). Sous 1024 px (NdMobAccueil) : logo, loupe, série et cloche,
 * collés en haut de l'écran ; le profil passe par l'onglet « Profil » de la barre du bas, le catalogue par sa page.
 * `account` reçoit la partie qui dépend du compte (voir HeaderAccount) : elle arrive après le reste de la page.
 */
export function AppHeader({ account }: { account?: ReactNode }) {
  return (
    <header className="relative z-30 flex flex-none items-center justify-between gap-2 px-4 py-3 max-lg:sticky max-lg:top-0 max-lg:bg-page lg:flex-wrap lg:gap-3 lg:py-5 lg:pr-6 lg:pl-0">
      <div className="flex min-w-0 flex-wrap items-center gap-2 lg:gap-3">
        <LogoButton href="/accueil" />
        <SearchButton href="/recherche" className="hidden gap-1.5 pr-4 pl-3.5 lg:flex" />
        <BoutonAjouterFormation className="hidden lg:flex" />
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
        {account}
      </div>
    </header>
  );
}

/** Partie de l'en-tête propre au compte : série, points, cloche et rond de profil. */
export function HeaderAccount({ user }: { user: ShellUser }) {
  return (
    <>
      <CounterPill icon="serie" value={user.serie} label="Série d’apprentissage" className="max-lg:h-12 max-lg:gap-[7px] max-lg:px-3.5" />
      <CounterPill icon="points" value={user.points} label="Points" className="hidden lg:flex" />
      <HeaderActions user={user} />
    </>
  );
}
