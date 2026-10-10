import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { IconSvgElement } from "./Icon";
import { IconTile, type IconTileTone } from "./IconTile";

type StatCardProps = {
  label: string;
  value: ReactNode;
  /** Ligne sous le chiffre (« +12 % ce mois »). */
  hint?: ReactNode;
  icon?: IconSvgElement;
  /** Couleur de la pastille d'icône : neutre, réussite (certificats), attention (série). */
  tone?: Exclude<IconTileTone, "blanc">;
  className?: string;
};

/** Indicateur du tableau de bord (planche « Cartes », « Carte de catalogue et indicateurs »). */
export function StatCard({ label, value, hint, icon, tone = "neutre", className }: StatCardProps) {
  return (
    <div className={cn("box-border flex min-w-0 flex-col rounded-carte border border-bordure-carte bg-panneau px-[19px] pt-[18px] pb-4", className)}>
      <div className="flex items-center gap-3">
        {icon && <IconTile icon={icon} tone={tone} />}
        <span className="text-sm leading-5 text-discret">{label}</span>
      </div>
      <div className="mt-3.5 text-[28px] leading-9 font-medium tracking-[-0.01em] text-titre">{value}</div>
      {hint && <div className="mt-0.5 text-xs leading-[18px] text-discret">{hint}</div>}
    </div>
  );
}
