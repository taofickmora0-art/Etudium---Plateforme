import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/cn";
import { controlClasses, isInvalid } from "./TextInput";

// La ref (React 19) passe au <textarea> avec le reste : le champ peut reprendre le focus.
type TextareaProps = ComponentPropsWithRef<"textarea"> & { invalid?: boolean };

/** Zone de texte : même habillage que les champs, hauteur libre, redimensionnable en hauteur. */
export function Textarea({ invalid, className, rows = 3, "aria-invalid": ariaInvalid, ...props }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      aria-invalid={isInvalid(invalid, ariaInvalid)}
      className={cn(controlClasses, "h-auto resize-y px-3.5 py-3 leading-[22px]", className)}
      {...props}
    />
  );
}
