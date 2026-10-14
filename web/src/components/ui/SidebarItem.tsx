import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Icon, type IconSvgElement } from "./Icon";

type SidebarItemProps = {
  href: string;
  icon: IconSvgElement;
  label: string;
  /** Page courante : pastille blanche, texte et icône bleus, `aria-current="page"`. */
  active?: boolean;
  /** Étiquette bleue après le libellé (« Nouveau », « 1 à corriger »). */
  tag?: string;
  /** Après le libellé, poussé à droite (le cadenas d'un espace fermé). */
  fin?: ReactNode;
};

/** Entrée de la barre latérale (planche « Navigation ») : 48 px, rayon 14, icône 20, libellé 16. */
export function SidebarItem({ href, icon, label, active = false, tag, fin }: SidebarItemProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        // menu-lateral-* : la barre réduite n'en garde qu'un carré d'icône (globals.css).
        "menu-lateral-entree focus-etudium flex h-12 items-center gap-2.5 rounded-bouton px-3 text-base font-medium no-underline transition-colors",
        active ? "bg-panneau text-bleu shadow-pastille" : "text-texte hover:bg-white/55",
      )}
    >
      <Icon icon={icon} size={20} />
      <span className="menu-lateral-libelle truncate">{label}</span>
      {tag && (
        <span className="menu-lateral-etiquette rounded-etiquette bg-bleu-pale pt-[3px] pr-[7px] pb-[5px] pl-[9px] text-xs leading-[17px] font-medium whitespace-nowrap text-bleu">
          {tag}
        </span>
      )}
      {fin && <span className="ml-auto flex items-center">{fin}</span>}
    </Link>
  );
}
