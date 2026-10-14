import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconSvgElement } from "./Icon";

type EmptyStateProps = {
  /** Icône dans une pastille de 56 px (cœur, loupe…). */
  icon?: IconSvgElement;
  /** À la place de l'icône : une illustration (l'illustration d'une formation, en 64 px). */
  illustration?: ReactNode;
  title: string;
  description: string;
  /** Un ou deux boutons. */
  action?: ReactNode;
  /** Sans cadre (page Favoris vide) : ni bordure ni fond, plus d'espace autour. */
  sansCadre?: boolean;
  className?: string;
};

/** État vide (planche « Messages », « États vides ») : dit pourquoi c'est vide et quoi faire. */
export function EmptyState({ icon, illustration, title, description, action, sansCadre = false, className }: EmptyStateProps) {
  return (
    <div className={cn("box-border flex min-w-0 flex-col", !sansCadre && "rounded-carte border border-bordure-carte bg-panneau", className)}>
      <div className={cn("flex flex-col items-center gap-1.5 px-6 text-center max-sm:px-4", sansCadre ? "py-[72px] max-sm:py-12" : "py-12 max-sm:py-8")}>
        {illustration ??
          (icon && (
            <span className="flex size-14 flex-none items-center justify-center rounded-carte bg-coque text-texte max-sm:size-12 max-sm:[&_svg]:size-[22px]">
              <Icon icon={icon} size={26} />
            </span>
          ))}
        {/* Un titre peut reprendre une saisie (recherche) : un mot très long passe à la ligne. */}
        <h3 className="mt-2.5 mb-0 text-lg leading-[26px] font-semibold text-encre wrap-anywhere max-sm:text-base max-sm:leading-6">{title}</h3>
        <p className="m-0 max-w-[420px] text-sm leading-[22px] text-pretty text-discret max-sm:text-[13px] max-sm:leading-5">{description}</p>
        {action && <div className="mt-3.5 flex flex-wrap justify-center gap-2">{action}</div>}
      </div>
    </div>
  );
}
