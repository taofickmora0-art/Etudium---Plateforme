import type { ReactNode } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { CounterPill, LogoButton, SearchButton } from "@/components/ui/TopBarButtons";
import type { ShellUser } from "@/lib/auth/current-user";
import { canAccess, type Espace } from "@/lib/auth/permissions";
import { LIENS_ENTETE_TELEPHONE } from "@/lib/navigation";
import { BoutonAjouterFormation } from "./BoutonAjouterFormation";
import { BoutonMenuLateral } from "./BoutonMenuLateral";
import { MenuTiroir } from "./MenuTiroir";
import { MesureEntete } from "./MesureEntete";
import { HeaderActions } from "./HeaderActions";

/**
 * En-tête de l'espace connecté (NdAccueil). Sous 1024 px (NdMobAccueil) : logo, loupe, série et cloche,
 * collés en haut de l'écran ; le profil passe par l'onglet « Profil » de la barre du bas, le catalogue par sa page.
 * `account` reçoit la partie qui dépend du compte (voir HeaderAccount) : elle arrive après le reste de la page.
 * Dans l'espace formateur (restructuration R1) : le logo mène au tableau de bord, et pas de recherche de formations.
 */
export function AppHeader({ account, espace }: { account?: ReactNode; espace?: Espace }) {
  const formateur = espace === "formateur";
  return (
    // Collé en haut quand la page défile, sur téléphone comme sur ordinateur (demande du 31 octobre 2026).
    <header
      data-entete-app=""
      className="sticky top-0 z-30 flex flex-none items-center justify-between gap-2 bg-page px-4 py-3 max-sm:gap-1.5 max-sm:px-3 max-sm:py-2.5 lg:flex-wrap lg:gap-3 lg:py-5 lg:pr-6 lg:pl-0"
    >
      <MesureEntete />
      <div className="flex min-w-0 flex-wrap items-center gap-2 lg:gap-3">
        {/* Grand écran : réduire la barre latérale à ses icônes, ou la rouvrir. */}
        <BoutonMenuLateral className="hidden lg:inline-flex" />
        {/* Téléphone : le menu ≡, toutes les entrées de l'espace sans passer par le profil. */}
        <MenuTiroir className="lg:hidden" />
        <LogoButton href={formateur ? "/formateur" : "/accueil"} />
        {!formateur && <SearchButton href="/recherche" className="hidden gap-1.5 pr-4 pl-3.5 lg:flex" />}
        <BoutonAjouterFormation className="hidden lg:flex" />
      </div>
      <div className="relative flex flex-wrap items-center gap-2 lg:gap-3">
        {(formateur ? [] : LIENS_ENTETE_TELEPHONE).map((e) => (
          <Link
            key={e.href}
            href={e.href}
            aria-label={e.label}
            className="focus-etudium flex size-12 flex-none items-center justify-center rounded-bouton bg-coque text-texte no-underline transition-colors hover:bg-coque-survol max-sm:size-10 max-sm:rounded-champ max-sm:[&_svg]:size-[18px] lg:hidden"
          >
            <Icon icon={e.icon} size={20} />
          </Link>
        ))}
        {account}
      </div>
    </header>
  );
}

/**
 * Partie de l'en-tête propre au compte : série, points, cloche et rond de profil. Ni série ni points pour un formateur,
 * qui ne suit pas de formation (restructuration R1).
 */
export function HeaderAccount({ user }: { user: ShellUser }) {
  const apprenant = canAccess("etudiant", user.roles);
  return (
    <>
      {apprenant && (
        <CounterPill icon="serie" value={user.serie} label="Série d’apprentissage" className="max-lg:h-12 max-lg:gap-[7px] max-lg:px-3.5 max-sm:h-10 max-sm:gap-1.5 max-sm:px-3" />
      )}
      {apprenant && <CounterPill icon="points" value={user.points} label="Points" className="hidden lg:flex" />}
      <HeaderActions user={user} />
    </>
  );
}
