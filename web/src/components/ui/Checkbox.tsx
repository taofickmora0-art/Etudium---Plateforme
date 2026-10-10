import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Ligne case + texte, partagée avec les boutons radio (planche « Formulaires », « Cases, boutons radio… »). */
export const choiceRowClasses = "cible-tactile relative flex min-h-6 cursor-pointer items-start gap-2.5 text-sm leading-[22px] text-texte has-disabled:cursor-not-allowed has-disabled:opacity-60";
/** Case native de 18 px teintée en bleu Étudium, comme sur la planche. */
export const choiceInputClasses = "focus-etudium mt-0.5 size-[18px] flex-none cursor-pointer accent-bleu disabled:cursor-not-allowed";

type CheckboxProps = Omit<ComponentPropsWithoutRef<"input">, "type"> & { label: ReactNode };

export function Checkbox({ label, className, ...props }: CheckboxProps) {
  return (
    <label className={cn(choiceRowClasses, className)}>
      <input type="checkbox" className={choiceInputClasses} {...props} />
      <span>{label}</span>
    </label>
  );
}
