"use client";

import { useState, type ReactNode } from "react";
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
  /**
   * Garde les panneaux inactifs montés (cachés) : ce qu'on y a saisi ou changé survit au changement d'onglet.
   * Sans cela, Radix démonte le panneau quitté.
   */
  keepMounted?: boolean;
  className?: string;
};

/** Onglets : piste grise, pastille blanche et texte bleu (planche « Boutons », « Filtres et onglets »). */
export function SegmentedTabs({ label, items, defaultValue, value, onValueChange, keepMounted = false, className }: SegmentedTabsProps) {
  const [interne, setInterne] = useState(defaultValue ?? items[0]?.value);
  const actif = value ?? interne;
  return (
    <Tabs.Root
      value={actif}
      onValueChange={(v) => {
        setInterne(v);
        onValueChange?.(v);
      }}
      className={cn("flex flex-col gap-6", className)}
    >
      <Tabs.List aria-label={label} className="inline-flex flex-wrap gap-1 self-start rounded-bouton bg-coque p-1">
        {items.map((item) => (
          <Tabs.Trigger
            key={item.value}
            value={item.value}
            className="focus-etudium cible-tactile relative flex h-10 cursor-pointer items-center rounded-puce px-4 text-sm font-medium text-texte transition-colors hover:text-bleu data-[state=active]:bg-panneau data-[state=active]:text-bleu data-[state=active]:shadow-pastille"
          >
            {item.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {items.map((item) => (
        <Tabs.Content
          key={item.value}
          value={item.value}
          forceMount={keepMounted || undefined}
          hidden={keepMounted ? item.value !== actif : undefined}
          className="focus-etudium rounded-carte"
        >
          {item.content}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
