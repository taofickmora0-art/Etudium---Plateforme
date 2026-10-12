"use client";

import { ArrowDown01Icon, Sorting01Icon } from "@hugeicons/core-free-icons";
import { DropdownMenu } from "radix-ui";
import { cn } from "@/lib/cn";
import { Button } from "./Button";
import { MenuRow, menuHeadingClasses, menuItemClasses, menuSurfaceClasses } from "./Menu";

type SortMenuProps = {
  options: { value: string; label: string }[];
  value: string;
  onValueChange: (value: string) => void;
  /** Intertitre du menu. */
  title?: string;
  /** Texte du bouton (« Trier : parcours ») ; par défaut, l'option choisie. */
  triggerLabel?: string;
  /** Hauteur du bouton : 48 px dans la barre d'outils du catalogue (NdCatalogue). */
  triggerClassName?: string;
};

/** Menu de tri : l'option choisie est cochée (planche « Menus », « Tri, option cochée »). */
export function SortMenu({ options, value, onValueChange, title = "Trier par", triggerLabel, triggerClassName }: SortMenuProps) {
  const current = options.find((o) => o.value === value);
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <Button variant="contour" iconLeft={Sorting01Icon} iconRight={triggerLabel ? ArrowDown01Icon : undefined} className={triggerClassName}>
          {triggerLabel ?? (current ? current.label : title)}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" sideOffset={8} className={cn(menuSurfaceClasses, "w-[230px]")}>
          <DropdownMenu.Label className={menuHeadingClasses}>{title}</DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={value} onValueChange={onValueChange}>
            {options.map((o) => (
              <DropdownMenu.RadioItem key={o.value} value={o.value} className={cn(menuItemClasses, "data-[state=checked]:bg-coque")}>
                <MenuRow label={o.label} checked={o.value === value} />
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
