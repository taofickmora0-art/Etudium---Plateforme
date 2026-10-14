import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Icon, type IconSvgElement } from "./Icon";
import { PastilleNombre } from "./PastilleNombre";

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
  /** Pastille rouge sur l'icône (visible aussi barre réduite) ; `libelle` complète le nom du lien (« 2 nouvelles sessions »). */
  pastille?: { nombre: number; libelle: string };
};

/** Entrée de la barre latérale (planche « Navigation ») : 48 px, rayon 14, icône 20, libellé 16. */
export function SidebarItem({ href, icon, label, active = false, tag, fin, pastille }: SidebarItemProps) {
  const avecPastille = pastille !== undefined && pastille.nombre > 0;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={avecPastille ? `${label}, ${pastille.libelle}` : undefined}
      className={cn(
        // menu-lateral-* : la barre réduite n'en garde qu'un carré d'icône (globals.css).
        "menu-lateral-entree focus-etudium flex h-12 items-center gap-2.5 rounded-bouton px-3 text-base font-medium no-underline transition-colors",
        active ? "bg-panneau text-bleu shadow-pastille" : "text-texte hover:bg-white/55",
      )}
    >
      <span className="relative flex flex-none">
        <Icon icon={icon} size={20} />
        {avecPastille && <PastilleNombre nombre={pastille.nombre} className="absolute -top-2 -right-2.5 h-4 min-w-4 px-1 text-[10px] ring-2 ring-coque" />}
      </span>
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
