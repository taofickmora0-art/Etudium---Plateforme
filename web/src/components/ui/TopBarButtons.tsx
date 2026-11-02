import type { ComponentPropsWithoutRef, ReactNode } from "react";
import Link from "next/link";
import { PlusSignIcon, Search01Icon } from "@hugeicons/core-free-icons";
import { LogoMark } from "@/components/brand/Logo";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";
import { BellIcon, PointsIcon, StreakIcon, UserSilhouetteIcon } from "./TopBarIcons";

// Planche « Boutons », « Boutons de la barre du haut » : pastilles de 49 px sur fond #E9EFFB.
// Sur téléphone (moins de 640 px), 40 px : l'en-tête laisse plus de place à la page.
const SURFACE =
  "flex h-[49px] flex-none items-center rounded-bouton bg-coque text-base font-medium text-texte whitespace-nowrap max-sm:h-10 max-sm:rounded-champ max-sm:text-[15px]";
const INTERACTIVE = "focus-etudium cursor-pointer transition-colors hover:bg-coque-survol";

type ButtonProps = ComponentPropsWithoutRef<"button">;
/** Avec `href`, le bouton devient un lien (la recherche et l'action mènent souvent à une page). */
type LinkableProps = ButtonProps & { href?: string };

/** Symbole Étudium qui ramène à l'accueil. */
export function LogoButton({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} aria-label="Étudium, accueil" className={cn(SURFACE, "focus-etudium w-12 justify-center max-sm:w-10 max-sm:[&_svg]:size-[26px]", className)}>
      <LogoMark />
    </Link>
  );
}

/** Ouvre la recherche. */
export function SearchButton({ children = "Rechercher", href, className, type, ...props }: LinkableProps) {
  const classes = cn(SURFACE, INTERACTIVE, "gap-2 px-4 no-underline", className);
  const content = (
    <>
      <Icon icon={Search01Icon} size={22} strokeWidth={1.9} />
      <span>{children}</span>
    </>
  );
  return href ? (
    <Link href={href} className={classes}>
      {content}
    </Link>
  ) : (
    <button type={type ?? "button"} className={classes} {...props}>
      {content}
    </button>
  );
}

/** Action principale de la page (« Ajouter une formation »). */
export function ActionButton({ children, href, className, type, ...props }: LinkableProps & { children: ReactNode }) {
  const classes = cn(SURFACE, INTERACTIVE, "gap-2 px-4 no-underline", className);
  const content = (
    <>
      <Icon icon={PlusSignIcon} size={18} strokeWidth={2.2} />
      <span>{children}</span>
    </>
  );
  return href ? (
    <Link href={href} className={classes}>
      {content}
    </Link>
  ) : (
    <button type={type ?? "button"} className={classes} {...props}>
      {content}
    </button>
  );
}

const COUNTERS = {
  serie: { Glyph: StreakIcon, spacing: "gap-[9px] pr-4 pl-[15px]" },
  points: { Glyph: PointsIcon, spacing: "gap-[7px] pr-[17px] pl-[15px]" },
} as const;

type CounterPillProps = {
  icon: keyof typeof COUNTERS;
  value: number | string;
  /** Ce que compte la pastille (« Série de jours », « Points ») : lu par les lecteurs d'écran seulement. */
  label: string;
  /** Avec une adresse, la pastille est un lien (vers le tableau de bord, lot 6 B). */
  href?: string;
  /** Nom du lien, valeur comprise (« Série d’apprentissage : 8 jours ») ; `label` sinon. */
  nomAccessible?: string;
  className?: string;
};

/** Pastille de compteur : série de jours (éclair) ou points (cadeau). */
export function CounterPill({ icon, value, label, href, nomAccessible, className }: CounterPillProps) {
  const { Glyph, spacing } = COUNTERS[icon];
  if (href) {
    return (
      <Link href={href} aria-label={nomAccessible ?? label} className={cn(SURFACE, INTERACTIVE, spacing, "no-underline", className)}>
        <Glyph />
        <span>{value}</span>
      </Link>
    );
  }
  return (
    <div className={cn(SURFACE, spacing, className)}>
      <Glyph />
      <span className="sr-only">{label}</span>
      <span>{value}</span>
    </div>
  );
}

/** Cloche des notifications. */
/**
 * La cloche. `nonLues` pose une pastille bleue : le design n'en dessine pas, mais sans elle rien ne signale une
 * nouvelle notification à qui ne lit pas l'écran ; le nombre exact est dans le nom du bouton.
 */
export function NotificationButton({ className, type, nonLues = false, ...props }: Omit<ButtonProps, "children"> & { nonLues?: boolean }) {
  return (
    <button
      type={type ?? "button"}
      aria-label="Notifications"
      className={cn(SURFACE, INTERACTIVE, "relative w-12 justify-center max-sm:w-10", className)}
      {...props}
    >
      <BellIcon />
      {nonLues && <span data-pastille aria-hidden="true" className="absolute top-3 right-3 size-2 rounded-full bg-bleu ring-2 ring-coque max-sm:top-2.5 max-sm:right-2.5" />}
    </button>
  );
}

/** Rond de profil de 52 px : silhouette tant qu'il n'y a pas de photo, sinon ce qu'on lui passe (Avatar, photo). */
export function ProfileButton({ children, className, type, ...props }: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      aria-label="Mon profil"
      className={cn(
        "focus-etudium flex size-[52px] flex-none cursor-pointer items-center justify-center overflow-hidden rounded-full bg-[#CCD6EA]",
        className,
      )}
      {...props}
    >
      {children ?? <UserSilhouetteIcon />}
    </button>
  );
}
