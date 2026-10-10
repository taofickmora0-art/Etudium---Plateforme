import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { choiceInputClasses, choiceRowClasses } from "./Checkbox";

type RadioGroupProps = {
  /** Question posée par le groupe, lue par les lecteurs d'écran (« Opérateur Mobile Money »). */
  label: string;
  /** Afficher la question au-dessus des choix ; sinon elle reste réservée aux lecteurs d'écran. */
  showLabel?: boolean;
  name: string;
  options: { value: string; label: ReactNode }[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

/** Boutons radio natifs empilés, 12 px d'écart. */
export function RadioGroup({ label, showLabel = false, name, options, value, defaultValue, onValueChange, disabled, className }: RadioGroupProps) {
  return (
    <fieldset disabled={disabled} className={cn("m-0 flex min-w-0 flex-col gap-3 border-0 p-0", className)}>
      <legend className={showLabel ? "mb-1 p-0 text-sm leading-5 font-medium text-encre" : "sr-only"}>{label}</legend>
      {options.map((option) => (
        <label key={option.value} className={choiceRowClasses}>
          <input
            type="radio"
            name={name}
            value={option.value}
            className={choiceInputClasses}
            {...(value !== undefined ? { checked: value === option.value } : { defaultChecked: defaultValue === option.value })}
            // Pas de fonction sans écouteur : le groupe reste utilisable dans une page rendue côté serveur.
            {...(onValueChange ? { onChange: () => onValueChange(option.value) } : {})}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
