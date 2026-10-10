"use client";

import type { ReactNode } from "react";
import { Tabs } from "radix-ui";
import { cn } from "@/lib/cn";

export type TabItem = { value: string; label: string; content: ReactNode };

type SegmentedTabsProps = {
  /** Nom de la liste d'onglets pour les lecteurs d'écran. */
  label: string;
  items: TabItem[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
};

/** Onglets : piste grise, pastille blanche et texte bleu (planche « Boutons », « Filtres et onglets »). */
export function SegmentedTabs({ label, items, defaultValue, value, onValueChange, className }: SegmentedTabsProps) {
  return (
    <Tabs.Root
      defaultValue={defaultValue ?? items[0]?.value}
      value={value}
      onValueChange={onValueChange}
      className={cn("flex flex-col gap-6", className)}
    >
      <Tabs.List aria-label={label} className="inline-flex flex-wrap gap-1 self-start rounded-bouton bg-coque p-1">
        {items.map((item) => (
          <Tabs.Trigger
            key={item.value}
            value={item.value}
            className="focus-etudium flex h-10 cursor-pointer items-center rounded-puce px-4 text-sm font-medium text-texte transition-colors hover:text-bleu data-[state=active]:bg-panneau data-[state=active]:text-bleu data-[state=active]:shadow-pastille"
          >
            {item.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {items.map((item) => (
        <Tabs.Content key={item.value} value={item.value} className="focus-etudium rounded-carte">
          {item.content}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
