import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { AppHeader } from "@/components/layout/AppHeader";
import { CompteDeLEntete } from "@/components/layout/CompteDeLEntete";
import { EnTetePublic } from "@/components/site/EnTetePublic";
import { Icon } from "@/components/ui/Icon";
import { ToastProvider } from "@/components/ui/Toast";

type Props = {
  connecte: boolean;
  titreFormation: string;
  /** Bouton « Retour » du téléphone : Mes formations (compte connecté) ou la fiche (visiteur). */
  retour: string;
  /** Panneau « Programme de la formation », à la place de la barre latérale sur ordinateur. */
  programme: ReactNode;
  /** Barre d'action collée en bas, sur téléphone. */
  barre?: ReactNode;
  children: ReactNode;
};

/**
 * Cadre de la page leçon.
 * - Ordinateur (NdLecon §1.1) : l'en-tête de l'appli (ou l'en-tête public pour un visiteur), le cadre gris-bleu arrondi,
 *   le programme de la formation à la place du menu, puis le panneau blanc.
 * - Téléphone (NdMobLecon §1.2) : en-tête « détail » (retour et titre de la formation), sans barre du bas ; le panneau
 *   blanc descend jusqu'en bas, avec la barre d'action collée en bas de l'écran.
 */
export function CadreLecon({ connecte, titreFormation, retour, programme, barre, children }: Props) {
  const cadre = (
    <div className="flex min-h-dvh flex-col bg-page lg:px-5 lg:pb-5">
      <a
        href="#contenu"
        className="focus-etudium sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-champ focus:bg-panneau focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-bleu focus:shadow-menu"
      >
        Aller au contenu
      </a>
      <div className="hidden lg:block">
        {connecte ? (
          <AppHeader
            account={
              <Suspense fallback={null}>
                <CompteDeLEntete />
              </Suspense>
            }
          />
        ) : (
          <EnTetePublic />
        )}
      </div>
      <header className="sticky top-0 z-30 flex flex-none items-center gap-2 bg-page px-4 py-3 lg:hidden">
        <Link
          href={retour}
          aria-label="Retour"
          className="focus-etudium flex size-12 flex-none items-center justify-center rounded-bouton bg-coque text-texte no-underline transition-colors hover:bg-coque-survol"
        >
          <Icon icon={ArrowLeft02Icon} size={20} />
        </Link>
        <span className="min-w-0 truncate text-lg leading-[26px] font-semibold text-encre">{titreFormation}</span>
      </header>
      <div className="flex flex-1 lg:items-stretch lg:rounded-coque lg:bg-coque">
        <nav aria-label="Programme de la formation" className="box-border hidden min-w-0 flex-[0_1_337px] flex-col gap-3 pt-5 pr-[18px] pb-5 pl-5 lg:flex">
          {programme}
        </nav>
        <main
          id="contenu"
          tabIndex={-1}
          className="mx-2 flex min-w-0 flex-1 flex-col rounded-t-panneau bg-panneau px-4 pt-5 outline-none lg:mt-[15px] lg:mr-5 lg:mb-5 lg:ml-0 lg:rounded-panneau lg:p-8"
        >
          <div className="flex-1 pb-5 lg:pb-0">{children}</div>
          {barre && <div className="sticky bottom-0 z-20 -mx-4 border-t border-bordure-carte bg-panneau px-4 py-3 lg:hidden">{barre}</div>}
        </main>
      </div>
    </div>
  );
  return connecte ? <ToastProvider>{cadre}</ToastProvider> : cadre;
}
