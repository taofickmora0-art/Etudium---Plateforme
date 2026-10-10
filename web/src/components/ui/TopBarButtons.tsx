import type { ComponentPropsWithoutRef, ReactNode } from "react";
import Link from "next/link";
import { PlusSignIcon, Search01Icon } from "@hugeicons/core-free-icons";
import { LogoMark } from "@/components/brand/Logo";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";
import { BellIcon, PointsIcon, StreakIcon, UserSilhouetteIcon } from "./TopBarIcons";

// Planche « Boutons », « Boutons de la barre du haut » : pastilles de 49 px sur fond #E9EFFB.
const SURFACE = "flex h-[49px] flex-none items-center rounded-bouton bg-coque text-base font-medium text-texte whitespace-nowrap";
const INTERACTIVE = "focus-etudium cursor-pointer transition-colors hover:bg-coque-survol";

type ButtonProps = ComponentPropsWithoutRef<"button">;

/** Symbole Étudium qui ramène à l'accueil. */
export function LogoButton({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} aria-label="Étudium, accueil" className={cn(SURFACE, "focus-etudium w-12 justify-center", className)}>
      <LogoMark />
    </Link>
  );
}

/** Ouvre la recherche. */
export function SearchButton({ children = "Rechercher", className, type, ...props }: ButtonProps) {
  return (
    <button type={type ?? "button"} className={cn(SURFACE, INTERACTIVE, "gap-2 px-4", className)} {...props}>
      <Icon icon={Search01Icon} size={22} strokeWidth={1.9} />
      <span>{children}</span>
    </button>
  );
}

/** Action principale de la page (« Ajouter une formation »). */
export function ActionButton({ children, className, type, ...props }: ButtonProps & { children: ReactNode }) {
  return (
    <button type={type ?? "button"} className={cn(SURFACE, INTERACTIVE, "gap-2 px-4", className)} {...props}>
      <Icon icon={PlusSignIcon} size={18} strokeWidth={2.2} />
      <span>{children}</span>
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
  className?: string;
};

/** Pastille de compteur : série de jours (éclair) ou points (cadeau). */
export function CounterPill({ icon, value, label, className }: CounterPillProps) {
  const { Glyph, spacing } = COUNTERS[icon];
  return (
    <div className={cn(SURFACE, spacing, className)}>
      <Glyph />
      <span className="sr-only">{label}</span>
      <span>{value}</span>
    </div>
  );
}

/** Cloche des notifications. */
export function NotificationButton({ className, type, ...props }: Omit<ButtonProps, "children">) {
  return (
    <button
      type={type ?? "button"}
      aria-label="Notifications"
      className={cn(SURFACE, INTERACTIVE, "w-12 justify-center", className)}
      {...props}
    >
      <BellIcon />
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
