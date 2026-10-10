import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";
import { controlClasses, isInvalid } from "./TextInput";

type TextareaProps = ComponentPropsWithoutRef<"textarea"> & { invalid?: boolean };

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
