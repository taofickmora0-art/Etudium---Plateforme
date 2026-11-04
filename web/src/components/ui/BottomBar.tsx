import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Icon, type IconSvgElement } from "./Icon";

type BottomBarProps = {
  items: { href: string; icon: IconSvgElement; label: string; active?: boolean }[];
  /** Un bouton glissé au milieu, après les deux premiers onglets (« Discussions » de l'étudiant). */
  milieu?: ReactNode;
  className?: string;
};

/**
 * Barre du bas du téléphone (NdMobAccueil) : cinq entrées, l'active en pastille blanche, texte et icône bleus. Chaque
 * entrée prend la largeur de son libellé, plus une part égale du reste : « Communauté » tient sans déborder de sa
 * pastille, même quand le téléphone grossit le texte (jusqu'à 130 % à 360 px). Libellés de 10 px, icônes de 19 px.
 */
export function BottomBar({ items, milieu, className }: BottomBarProps) {
  return (
    <nav aria-label="Navigation" className={cn("flex gap-0.5 rounded-panneau bg-coque p-1.5", className)}>
      {items.map((item, i) => (
        <Fragment key={item.href}>
          {i === 2 && milieu}
          <Link
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={cn(
              "focus-etudium flex h-12 min-w-0 flex-auto flex-col items-center justify-center gap-[3px] rounded-carte px-1 text-[10px] leading-3 font-medium tracking-[-0.01em] text-texte no-underline transition-colors",
              item.active ? "bg-panneau text-bleu shadow-pastille" : "hover:bg-white/55",
            )}
          >
            <Icon icon={item.icon} size={19} />
            <span className="max-w-full truncate">{item.label}</span>
          </Link>
        </Fragment>
      ))}
    </nav>
  );
}
