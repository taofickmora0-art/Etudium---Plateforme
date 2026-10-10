"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Tick02Icon } from "@hugeicons/core-free-icons";
import { DropdownMenu } from "radix-ui";
import { cn } from "@/lib/cn";
import { Icon, type IconSvgElement } from "./Icon";

// Planche « Menus déroulants » : surface blanche, rayon 18, ombre portée, lignes d'au moins 44 px.
export const menuSurfaceClasses =
  "z-50 box-border max-w-[calc(100vw-32px)] rounded-menu border border-bordure-carte bg-panneau p-2 shadow-menu motion-safe:animate-apparition";
// L'élément survolé se repère à son fond gris-bleu (data-highlighted), comme sur la planche ; au clavier,
// le contour bleu s'y ajoute (:focus-visible ne s'allume pas à la souris).
export const menuItemClasses =
  "focus-etudium box-border flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-puce border-0 bg-transparent px-3 py-1.5 text-left text-texte no-underline select-none data-[highlighted]:bg-coque hover:bg-coque";
export const menuHeadingClasses = "px-3 pt-2 pb-1 text-xs leading-[18px] font-medium tracking-[0.04em] text-discret uppercase";
export const menuSeparatorClasses = "mx-1 my-1.5 h-px bg-bordure-carte";

/** Contenu d'une ligne : icône, libellé (et détail), coche pour l'élément courant. */
export function MenuRow({ icon, label, description, checked }: { icon?: IconSvgElement; label: ReactNode; description?: ReactNode; checked?: boolean }) {
  return (
    <>
      {icon && <Icon icon={icon} size={20} />}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] leading-[22px] font-medium">{label}</span>
        {description && <span className="truncate text-xs leading-[18px] text-discret">{description}</span>}
      </span>
      {checked && <Icon icon={Tick02Icon} size={18} />}
    </>
  );
}

export type MenuEntry =
  | {
      label: string;
      icon?: IconSvgElement;
      description?: string;
      onSelect?: () => void;
      href?: string;
      /** Action irréversible (supprimer, se déconnecter) : texte rouge, survol rouge clair. */
      danger?: boolean;
      /** Élément courant (espace actif…) : fond gris-bleu et coche. */
      current?: boolean;
    }
  | { separator: true }
  | { heading: string };

/** Les lignes d'un menu, réutilisées par le menu du profil. */
export function MenuEntries({ items }: { items: MenuEntry[] }) {
  return items.map((item, index) => {
    if ("separator" in item) return <DropdownMenu.Separator key={`sep-${index}`} className={menuSeparatorClasses} />;
    if ("heading" in item)
      return (
        <DropdownMenu.Label key={`titre-${item.heading}`} className={menuHeadingClasses}>
          {item.heading}
        </DropdownMenu.Label>
      );
    const classes = cn(
      menuItemClasses,
      item.current && "bg-coque",
      item.danger && "text-erreur-texte hover:bg-erreur-fond data-[highlighted]:bg-erreur-fond",
    );
    const row = <MenuRow icon={item.icon} label={item.label} description={item.description} checked={item.current} />;
    return item.href ? (
      <DropdownMenu.Item key={item.label} asChild onSelect={item.onSelect}>
        <Link href={item.href} aria-current={item.current ? "page" : undefined} className={classes}>
          {row}
        </Link>
      </DropdownMenu.Item>
    ) : (
      <DropdownMenu.Item key={item.label} onSelect={item.onSelect} className={classes}>
        {row}
      </DropdownMenu.Item>
    );
  });
}

type MenuProps = {
  /** Un seul élément cliquable (bouton icône « Plus d’actions »…). */
  trigger: ReactNode;
  items: MenuEntry[];
  /** Nom du menu pour les lecteurs d'écran. */
  label?: string;
  align?: "start" | "center" | "end";
  /** Largeur de la surface (220 px par défaut). */
  className?: string;
};

/** Menu d'actions déroulant : s'ouvre au clic ou au clavier (Entrée, flèches), se ferme avec Échap. */
export function Menu({ trigger, items, label, align = "end", className }: MenuProps) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content aria-label={label} align={align} sideOffset={8} className={cn(menuSurfaceClasses, "w-[220px]", className)}>
          <MenuEntries items={items} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
