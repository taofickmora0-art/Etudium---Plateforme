import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { LogoMark } from "@/components/brand/Logo";
import { Icon, type IconSvgElement } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { AuthAside, type AuthAsideVariant } from "./AuthAside";

type AuthLayoutProps = {
  aside: AuthAsideVariant;
  /** Lien de retour en haut à droite (« Retour à la connexion », « Modifier mon adresse »). */
  back?: { href: string; label: string };
  children: ReactNode;
};

/**
 * Mise en page des écrans de compte (NdConnexion) : sur ordinateur, bannière bleue à gauche et formulaire
 * dans un panneau blanc ; sur téléphone (NdMobConnexion), en-tête compact et panneau blanc arrondi en haut.
 */
export function AuthLayout({ aside, back, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-page lg:px-5 lg:pb-5">
      <header className="flex flex-none items-center justify-between gap-3 px-4 py-3 lg:flex-wrap lg:py-5 lg:pr-1 lg:pl-0">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/"
            aria-label="Étudium, accueil"
            className="focus-etudium flex h-[49px] w-12 flex-none items-center justify-center gap-2.5 rounded-bouton bg-coque text-[17px] font-bold tracking-[-0.02em] text-bleu no-underline lg:w-auto lg:justify-start lg:pr-4 lg:pl-[9px]"
          >
            <LogoMark />
            <span className="hidden lg:inline">Étudium</span>
          </Link>
          <span aria-hidden="true" className="truncate text-lg leading-[26px] font-semibold text-encre lg:hidden">
            Étudium
          </span>
        </div>
        {back && (
          <Link
            href={back.href}
            className="focus-etudium cible-tactile relative flex h-[49px] flex-none items-center gap-2 rounded-bouton bg-coque px-4 text-base font-medium whitespace-nowrap text-texte no-underline transition-colors hover:bg-coque-survol max-lg:size-12 max-lg:justify-center max-lg:px-0"
          >
            <Icon icon={ArrowLeft02Icon} size={20} strokeWidth={1.9} />
            <span className="max-lg:sr-only">{back.label}</span>
          </Link>
        )}
      </header>
      <div className="flex flex-1 lg:flex-wrap lg:items-stretch lg:gap-5 lg:rounded-coque lg:bg-coque lg:p-5">
        <AuthAside variant={aside} />
        <main className="mx-2 box-border flex min-w-0 flex-[1_1_400px] justify-center rounded-t-panneau bg-panneau px-4 py-5 lg:mx-0 lg:items-center lg:rounded-panneau lg:p-[clamp(24px,4vw,56px)]">
          <div className="flex w-full max-w-[420px] min-w-0 flex-col gap-[18px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

const TILE_TONES = {
  information: "bg-bleu-pale text-bleu",
  reussite: "bg-reussite-fond text-reussite-texte",
} as const;

type AuthHeadingProps = {
  title: ReactNode;
  /** Texte sous le titre. */
  children?: ReactNode;
  /** Pastille de 56 px au-dessus du titre (cadenas, enveloppe). */
  icon?: IconSvgElement;
  iconTone?: keyof typeof TILE_TONES;
  /** À la place de la pastille : une illustration (téléphone, NdMobConnexion). */
  illustration?: ReactNode;
};

/** Haut d'un écran de compte : pastille facultative, titre 32/38, texte 15/24 discret. */
export function AuthHeading({ title, children, icon, iconTone = "information", illustration }: AuthHeadingProps) {
  return (
    <>
      {icon && (
        <span className={cn("flex size-14 flex-none items-center justify-center rounded-carte", TILE_TONES[iconTone])}>
          <Icon icon={icon} size={26} />
        </span>
      )}
      {illustration}
      <div>
        <h1 className="m-0 text-[32px] leading-[38px] font-medium tracking-[-0.025em] text-balance text-titre">{title}</h1>
        {children && <p className="mt-2.5 mb-0 text-[15px] leading-6 text-pretty text-discret">{children}</p>}
      </div>
    </>
  );
}
