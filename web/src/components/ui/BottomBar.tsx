import Link from "next/link";
import { cn } from "@/lib/cn";
import { Icon, type IconSvgElement } from "./Icon";

type BottomBarProps = {
  items: { href: string; icon: IconSvgElement; label: string; active?: boolean }[];
  className?: string;
};

/**
 * Barre du bas du téléphone (NdMobAccueil) : cinq entrées, l'active en pastille blanche, texte et icône bleus. Chaque
 * entrée prend la largeur de son libellé, plus une part égale du reste : « Communauté » tient sans déborder de sa
 * pastille, même quand le téléphone grossit le texte (jusqu'à 115 % à 360 px).
 */
export function BottomBar({ items, className }: BottomBarProps) {
  return (
    <nav aria-label="Navigation" className={cn("flex gap-0.5 rounded-panneau bg-coque p-1.5", className)}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "focus-etudium flex h-[50px] min-w-0 flex-auto flex-col items-center justify-center gap-[3px] rounded-carte px-1 text-[10.5px] leading-[13px] font-medium tracking-[-0.01em] text-texte no-underline transition-colors",
            item.active ? "bg-panneau text-bleu shadow-pastille" : "hover:bg-white/55",
          )}
        >
          <Icon icon={item.icon} size={20} />
          <span className="max-w-full truncate">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
