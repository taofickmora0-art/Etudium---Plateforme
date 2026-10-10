import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";

export type { IconSvgElement };

type IconProps = {
  icon: IconSvgElement;
  size?: number;
  /** Épaisseur du trait : 1,5 px dans tout le design (1,9 px pour les flèches de la barre du haut). */
  strokeWidth?: number;
  className?: string;
  /** Sans libellé, l'icône est décorative ; avec, elle est annoncée aux lecteurs d'écran. */
  label?: string;
};

export function Icon({ icon, size = 20, strokeWidth = 1.5, className, label }: IconProps) {
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true as const };
  return (
    <HugeiconsIcon
      icon={icon}
      size={size}
      strokeWidth={strokeWidth}
      className={["block shrink-0", className].filter(Boolean).join(" ")}
      {...a11y}
    />
  );
}
