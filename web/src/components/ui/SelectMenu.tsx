"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";
import { Select, type SelectProps } from "./Select";

type SelectMenuProps = Pick<SelectProps, "options" | "value" | "defaultValue" | "onValueChange" | "placeholder" | "name" | "disabled"> & {
  label: string;
  className?: string;
};

/** Liste de choix avec son libellé (planche « Menus », « Liste de choix ouverte ») : options avec icône, option choisie cochée. */
export function SelectMenu({ label, placeholder = "Choisir…", className, ...props }: SelectMenuProps) {
  const id = useId();
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm leading-5 font-medium text-encre">
        {label}
      </label>
      <Select id={id} placeholder={placeholder} {...props} />
    </div>
  );
}
