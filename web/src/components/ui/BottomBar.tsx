import Link from "next/link";
import { cn } from "@/lib/cn";
import { Icon, type IconSvgElement } from "./Icon";

type BottomBarProps = {
  items: { href: string; icon: IconSvgElement; label: string; active?: boolean }[];
  className?: string;
};

/** Barre du bas du téléphone (NdMobAccueil) : cinq entrées de 56 px, l'active en pastille blanche, texte et icône bleus. */
export function BottomBar({ items, className }: BottomBarProps) {
  return (
    <nav aria-label="Navigation" className={cn("flex gap-1 rounded-panneau bg-coque p-1.5", className)}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "focus-etudium flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-carte text-[11px] leading-[14px] font-medium text-texte no-underline transition-colors",
            item.active ? "bg-panneau text-bleu shadow-pastille" : "hover:bg-white/55",
          )}
        >
          <Icon icon={item.icon} size={22} />
          {/* Le libellé peut mordre de 4 px de chaque côté sur l’espace entre les onglets : « Communauté » tient à 360 px. */}
          <span className="max-w-[calc(100%+8px)] truncate">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
