"use client";

import { useId } from "react";
import { Switch as RadixSwitch } from "radix-ui";
import { cn } from "@/lib/cn";

type SwitchProps = {
  label: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  name?: string;
  className?: string;
};

/** Interrupteur 46 × 28 : piste bleue quand activé, grise sinon ; libellé à gauche. */
export function Switch({ label, className, ...props }: SwitchProps) {
  const id = useId();
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <label htmlFor={id} className="cursor-pointer text-[15px] leading-[22px] font-medium text-encre">
        {label}
      </label>
      <RadixSwitch.Root
        id={id}
        {...props}
        className="focus-etudium box-border inline-flex h-7 w-[46px] flex-none cursor-pointer items-center rounded-full bg-inactif p-[3px] transition-colors data-[state=checked]:bg-bleu disabled:cursor-not-allowed disabled:opacity-45"
      >
        <RadixSwitch.Thumb className="block size-[22px] rounded-full bg-panneau shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-transform data-[state=checked]:translate-x-[18px]" />
      </RadixSwitch.Root>
    </div>
  );
}
