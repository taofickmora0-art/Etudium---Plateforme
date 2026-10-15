import type { ComponentPropsWithRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
import { Icon, type IconSvgElement } from "./Icon";

// Planche « Boutons » : « Icône seule », « Icône, contour » et « Fermer ».
export const iconButtonVariants = cva(
  "focus-etudium cible-tactile relative inline-flex flex-none items-center justify-center p-0 text-texte transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-45",
  {
    variants: {
      variant: {
        plein: "bg-coque enabled:hover:bg-coque-survol",
        contour: "border border-bordure bg-panneau enabled:hover:bg-page",
        discret: "bg-transparent enabled:hover:bg-coque",
      },
      size: {
        md: "size-[42px] rounded-champ",
        sm: "size-[34px] rounded-puce",
      },
    },
    defaultVariants: { variant: "plein", size: "md" },
  },
);

type IconButtonProps = Omit<ComponentPropsWithRef<"button">, "children"> &
  VariantProps<typeof iconButtonVariants> & {
    icon: IconSvgElement;
    /** Obligatoire : c'est le nom annoncé du bouton (« Fermer », « Plus d’actions »). */
    label: string;
  };

export function IconButton({ icon, label, variant, size, className, type, ...props }: IconButtonProps) {
  return (
    <button
      type={type ?? "button"}
      aria-label={label}
      className={cn(iconButtonVariants({ variant, size }), className)}
      {...props}
    >
      <Icon icon={icon} size={size === "sm" ? 16 : 20} />
    </button>
  );
}
