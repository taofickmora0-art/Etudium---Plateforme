"use client";

import { useId } from "react";
import { ArrowDown01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Select } from "radix-ui";
import { cn } from "@/lib/cn";
import { Icon, type IconSvgElement } from "./Icon";
import { menuItemClasses, menuSurfaceClasses } from "./Menu";

type SelectMenuProps = {
  label: string;
  options: { value: string; label: string; icon?: IconSvgElement }[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  /** Nom du champ dans un formulaire envoyé. */
  name?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Liste de choix dessinée (planche « Menus », « Liste de choix ouverte ») : options avec icône, option choisie cochée.
 * Pour une longue liste (pays…), préférer `Select`, la liste du système.
 */
export function SelectMenu({ label, options, value, defaultValue, onValueChange, placeholder = "Choisir…", name, disabled, className }: SelectMenuProps) {
  const id = useId();
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm leading-5 font-medium text-encre">
        {label}
      </label>
      <Select.Root value={value} defaultValue={defaultValue} onValueChange={onValueChange} name={name} disabled={disabled}>
        <Select.Trigger
          id={id}
          className="group box-border flex h-12 w-full cursor-pointer items-center justify-between gap-2 rounded-champ border border-bordure-champ bg-panneau px-3.5 text-left text-[15px] text-texte outline-none transition-[border-color,box-shadow] focus-visible:border-bleu focus-visible:shadow-focus disabled:cursor-not-allowed disabled:bg-page disabled:text-discret data-[state=open]:border-bleu data-[state=open]:shadow-focus"
        >
          <span className="truncate">
            <Select.Value placeholder={placeholder} />
          </span>
          <Select.Icon className="flex text-discret transition-transform group-data-[state=open]:rotate-180">
            <Icon icon={ArrowDown01Icon} size={18} />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content position="popper" sideOffset={2} className={cn(menuSurfaceClasses, "w-[var(--radix-select-trigger-width)]")}>
            <Select.Viewport>
              {options.map((o) => (
                <Select.Item key={o.value} value={o.value} className={cn(menuItemClasses, "data-[state=checked]:bg-coque")}>
                  {o.icon && <Icon icon={o.icon} size={20} />}
                  <span className="flex min-w-0 flex-1">
                    <Select.ItemText>
                      <span className="text-[15px] leading-[22px] font-medium">{o.label}</span>
                    </Select.ItemText>
                  </span>
                  <Select.ItemIndicator className="flex">
                    <Icon icon={Tick02Icon} size={18} />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
