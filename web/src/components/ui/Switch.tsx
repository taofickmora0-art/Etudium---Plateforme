"use client";

import { useId } from "react";
import { Switch as RadixSwitch } from "radix-ui";
import { cn } from "@/lib/cn";

type SwitchProps = {
  label: string;
  /** Précision sous le libellé (« Programmation et rappels 1 h avant »), annoncée avec l'interrupteur. */
  description?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  name?: string;
  className?: string;
};

/** Interrupteur 46 × 28 : piste bleue quand activé, grise sinon ; libellé à gauche. */
export function Switch({ label, description, className, ...props }: SwitchProps) {
  const id = useId();
  const libelle = (
    <label htmlFor={id} className="cursor-pointer text-[15px] leading-[22px] font-medium text-encre">
      {label}
    </label>
  );
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      {description ? (
        <span className="flex min-w-0 flex-col gap-0.5">
          {libelle}
          <span id={`${id}-description`} className="text-[13px] leading-5 text-discret">
            {description}
          </span>
        </span>
      ) : (
        libelle
      )}
      <RadixSwitch.Root
        id={id}
        aria-describedby={description ? `${id}-description` : undefined}
        {...props}
        className="focus-etudium cible-tactile relative box-border inline-flex h-7 w-[46px] flex-none cursor-pointer items-center rounded-full bg-inactif p-[3px] transition-colors data-[state=checked]:bg-bleu disabled:cursor-not-allowed disabled:opacity-45"
      >
        <RadixSwitch.Thumb className="block size-[22px] rounded-full bg-panneau shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-transform data-[state=checked]:translate-x-[18px]" />
      </RadixSwitch.Root>
    </div>
  );
}
