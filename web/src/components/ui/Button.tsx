import type { ComponentPropsWithRef } from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
import { Icon, type IconSvgElement } from "./Icon";
import { Spinner } from "./Spinner";

// Planche « Boutons, filtres et étiquettes » : variantes et tailles.
export const buttonVariants = cva(
  "focus-etudium cible-tactile relative inline-flex items-center justify-center gap-2 font-medium leading-none whitespace-nowrap no-underline transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-45",
  {
    variants: {
      variant: {
        principal: "bg-bleu text-white enabled:hover:bg-bleu-survol [a&]:hover:bg-bleu-survol",
        // Bleu doux : fond bleu clair, texte bleu (bas des cartes du catalogue, spec du 2 novembre 2026, §4).
        doux: "bg-bleu-clair text-bleu enabled:hover:bg-bleu-pale [a&]:hover:bg-bleu-pale",
        gris: "bg-coque text-texte enabled:hover:bg-coque-survol [a&]:hover:bg-coque-survol",
        contour: "border border-bordure bg-panneau text-texte enabled:hover:bg-page [a&]:hover:bg-page",
        discret: "bg-transparent text-texte enabled:hover:bg-coque [a&]:hover:bg-coque",
        danger: "bg-erreur-vif text-white enabled:hover:bg-erreur-texte [a&]:hover:bg-erreur-texte",
        dangerDoux: "bg-erreur-fond text-erreur-texte enabled:hover:bg-erreur-survol [a&]:hover:bg-erreur-survol",
      },
      size: {
        lg: "h-12 rounded-bouton px-[18px] text-base",
        md: "h-[42px] rounded-champ px-[15px] text-sm",
        sm: "h-[34px] rounded-puce px-3 text-[13px]",
      },
    },
    defaultVariants: { variant: "principal", size: "md" },
  },
);

const ICON_SIZE = { lg: 20, md: 18, sm: 16 } as const;

// La ref (React 19) passe au <button> avec le reste : un bouton peut recevoir le focus (quiz).
type ButtonProps = ComponentPropsWithRef<"button"> &
  VariantProps<typeof buttonVariants> & {
    iconLeft?: IconSvgElement;
    iconRight?: IconSvgElement;
    /** Bouton occupé : désactivé, annoncé (aria-busy) et précédé d'un indicateur d'attente. */
    loading?: boolean;
    /** Applique le style à l'enfant (par exemple un lien) au lieu de rendre un <button>. */
    asChild?: boolean;
  };

export function Button({
  variant,
  size,
  iconLeft,
  iconRight,
  loading = false,
  asChild = false,
  className,
  disabled,
  children,
  type,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);
  if (asChild) {
    return (
      <Slot.Root className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }
  const iconSize = ICON_SIZE[size ?? "md"];
  return (
    <button
      type={type ?? "button"}
      className={cn(classes, loading && "disabled:cursor-progress disabled:opacity-100")}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner size={iconSize} /> : iconLeft && <Icon icon={iconLeft} size={iconSize} />}
      <span>{children}</span>
      {!loading && iconRight && <Icon icon={iconRight} size={iconSize} />}
    </button>
  );
}
