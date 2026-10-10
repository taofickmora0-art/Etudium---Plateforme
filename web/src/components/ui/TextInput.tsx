import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

/**
 * Habillage commun des champs (planche « Formulaires ») : 48 px, bordure #D2D9E8, rayon 12, texte 15 px.
 * Au focus : bordure bleue et halo ; en erreur (aria-invalid) : bordure rouge ; désactivé : fond de page, texte discret.
 */
export const controlClasses =
  "box-border h-12 w-full rounded-champ border border-bordure-champ bg-panneau px-3.5 text-[15px] text-texte outline-none transition-[border-color,box-shadow] focus:border-bleu focus:shadow-focus aria-[invalid=true]:border-erreur-vif disabled:cursor-not-allowed disabled:bg-page disabled:text-discret";

export type TextInputProps = ComponentPropsWithoutRef<"input"> & {
  /** Champ en erreur : bordure rouge et `aria-invalid`. `Field` le règle tout seul quand il a un `error`. */
  invalid?: boolean;
};

/** Vrai si le champ doit s'afficher en erreur, que ce soit par `invalid` ou par `aria-invalid` (posé par `Field`). */
export function isInvalid(invalid?: boolean, ariaInvalid?: ComponentPropsWithoutRef<"input">["aria-invalid"]) {
  return invalid || ariaInvalid === true || ariaInvalid === "true" || undefined;
}

export function TextInput({ invalid, className, type, "aria-invalid": ariaInvalid, ...props }: TextInputProps) {
  return (
    <input
      type={type ?? "text"}
      aria-invalid={isInvalid(invalid, ariaInvalid)}
      className={cn(controlClasses, className)}
      {...props}
    />
  );
}
