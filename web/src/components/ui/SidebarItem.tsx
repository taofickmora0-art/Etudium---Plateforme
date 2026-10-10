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
};

/** Entrée de la barre latérale (planche « Navigation ») : 48 px, rayon 14, icône 20, libellé 16. */
export function SidebarItem({ href, icon, label, active = false, tag }: SidebarItemProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "focus-etudium flex h-12 items-center gap-2.5 rounded-bouton px-3 text-base font-medium no-underline transition-colors",
        active ? "bg-panneau text-bleu shadow-pastille" : "text-texte hover:bg-white/55",
      )}
    >
      <Icon icon={icon} size={20} />
      <span className="truncate">{label}</span>
      {tag && (
        <span className="rounded-etiquette bg-bleu-pale pt-[3px] pr-[7px] pb-[5px] pl-[9px] text-xs leading-[17px] font-medium whitespace-nowrap text-bleu">
          {tag}
        </span>
      )}
    </Link>
  );
}
