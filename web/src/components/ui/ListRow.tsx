import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

/** Liste à séparateurs fins (planche « Cartes », « Liste »). */
export function List({ label, className, children }: { label?: string; className?: string; children: ReactNode }) {
  return (
    <ul aria-label={label} className={cn("m-0 flex list-none flex-col p-0 [&>li+li]:border-t [&>li+li]:border-bordure-carte", className)}>
      {children}
    </ul>
  );
}

type ListRowProps = {
  /** Pastille d'icône (IconTile, 44 px) ou avatar. */
  leading: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** À droite : étiquette, bouton… */
  trailing?: ReactNode;
  /** Ligne cliquable : toute la ligne devient un lien, avec une flèche. */
  href?: string;
};

const ROW = "flex min-h-[76px] items-center gap-3.5 px-1 py-3.5";

/** Une ligne de liste : à placer dans `List`. */
export function ListRow({ leading, title, subtitle, trailing, href }: ListRowProps) {
  const body = (
    <>
      {leading}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] leading-[22px] font-medium text-encre">{title}</span>
        {subtitle && <span className="truncate text-[13px] leading-5 text-discret">{subtitle}</span>}
      </span>
      {trailing}
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className={cn(ROW, "focus-etudium text-inherit no-underline transition-colors hover:bg-page")}>
          {body}
          <Icon icon={ArrowRight01Icon} size={18} className="text-discret" />
        </Link>
      ) : (
        <div className={ROW}>{body}</div>
      )}
    </li>
  );
}
