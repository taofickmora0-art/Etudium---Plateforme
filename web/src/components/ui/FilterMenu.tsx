"use client";

import { useState } from "react";
import { FilterIcon } from "@hugeicons/core-free-icons";
import { Popover } from "radix-ui";
import { cn } from "@/lib/cn";
import { Button } from "./Button";
import { Checkbox } from "./Checkbox";
import { menuHeadingClasses, menuSeparatorClasses, menuSurfaceClasses } from "./Menu";

type FilterMenuProps = {
  /** Intertitre (« Parcours »). */
  title: string;
  options: { value: string; label: string }[];
  /** Filtres appliqués. */
  values: string[];
  onApply: (values: string[]) => void;
  /** Texte du bouton d'ouverture. */
  label?: string;
};

/** Filtre à cases : on coche, puis « Appliquer » ; « Réinitialiser » décoche tout (planche « Menus », « Filtre à cases »). */
export function FilterMenu({ title, options, values, onApply, label = "Filtrer" }: FilterMenuProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(values);

  const toggle = (value: string, checked: boolean) =>
    setDraft((list) => (checked ? [...list, value] : list.filter((v) => v !== value)));

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        // À chaque ouverture, on repart des filtres réellement appliqués.
        if (next) setDraft(values);
        setOpen(next);
      }}
    >
      <Popover.Trigger asChild>
        <Button variant="contour" iconLeft={FilterIcon}>
          {values.length ? `${label} (${values.length})` : label}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content aria-label={title} align="start" sideOffset={8} className={cn(menuSurfaceClasses, "w-[240px]")}>
          <fieldset className="m-0 border-0 p-0">
            <legend className={cn(menuHeadingClasses, "w-full")}>{title}</legend>
            <div className="flex flex-col gap-3 px-3 pt-2 pb-2.5">
              {options.map((o) => (
                <Checkbox
                  key={o.value}
                  label={o.label}
                  checked={draft.includes(o.value)}
                  onChange={(event) => toggle(o.value, event.target.checked)}
                />
              ))}
            </div>
          </fieldset>
          <div className={menuSeparatorClasses} />
          <div className="flex justify-between gap-2 p-1">
            <Button variant="discret" size="sm" onClick={() => setDraft([])}>
              Réinitialiser
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onApply(options.map((o) => o.value).filter((v) => draft.includes(v)));
                setOpen(false);
              }}
            >
              Appliquer
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
