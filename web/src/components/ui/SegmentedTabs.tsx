"use client";

import { useState, type ReactNode } from "react";
import { Tabs } from "radix-ui";
import { cn } from "@/lib/cn";
import { Icon, type IconSvgElement } from "./Icon";
import { PastilleNombre } from "./PastilleNombre";

/**
 * `icon` : petite icône avant le libellé (cadenas d'un parcours non inclus, NdParcours). `pastille` : un nombre en haut
 * à droite de l'onglet (les publications programmées), dont `libelle` complète le nom (« 2 publications programmées »).
 */
export type TabItem = { value: string; label: string; content: ReactNode; icon?: IconSvgElement; pastille?: { nombre: number; libelle: string } };

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
  /** Onglets qui se partagent toute la largeur, en 44 px (téléphone, NdMobLecon). */
  pleineLargeur?: boolean;
  /** Un élément sur la ligne des onglets, à droite (« Trier par : » de la communauté). */
  aCote?: ReactNode;
  className?: string;
};

/** Onglets : piste grise, pastille blanche et texte bleu (planche « Boutons », « Filtres et onglets »). */
export function SegmentedTabs({ label, items, defaultValue, value, onValueChange, keepMounted = false, pleineLargeur = false, aCote, className }: SegmentedTabsProps) {
  const [interne, setInterne] = useState(defaultValue ?? items[0]?.value);
  const actif = value ?? interne;
  const liste = (
    <Tabs.List
      aria-label={label}
      className={cn("gap-1 rounded-bouton bg-coque p-1", pleineLargeur ? "flex flex-nowrap self-stretch" : "inline-flex flex-wrap self-start")}
    >
      {items.map((item) => (
        <Tabs.Trigger
          key={item.value}
          value={item.value}
          className={cn(
            "focus-etudium cible-tactile relative flex cursor-pointer items-center rounded-puce text-sm font-medium text-texte transition-colors hover:text-bleu data-[state=active]:bg-panneau data-[state=active]:text-bleu data-[state=active]:shadow-pastille",
            pleineLargeur ? "h-11 min-w-0 flex-1 justify-center px-1.5" : "h-10 px-4",
          )}
        >
          {/* Masquée sur téléphone : les onglets tiennent sur une ligne (l'icône est décorative). */}
          {item.icon && <Icon icon={item.icon} size={16} className="mr-1.5 max-sm:hidden" />}
          {item.label}
          {item.pastille && item.pastille.nombre > 0 && (
            <>
              <PastilleNombre nombre={item.pastille.nombre} className="pointer-events-none absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 text-[10px] ring-2 ring-coque" />
              <span className="sr-only">, {item.pastille.libelle}</span>
            </>
          )}
        </Tabs.Trigger>
      ))}
    </Tabs.List>
  );
  return (
    <Tabs.Root
      value={actif}
      onValueChange={(v) => {
        setInterne(v);
        onValueChange?.(v);
      }}
      className={cn("flex flex-col gap-6", className)}
    >
      {aCote ? (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
          {liste}
          {aCote}
        </div>
      ) : (
        liste
      )}
      {items.map((item) => (
        <Tabs.Content
          key={item.value}
          value={item.value}
          // Sans keepMounted, ne rien passer : un « hidden={undefined} » écraserait celui que Radix pose sur les panneaux inactifs.
          {...(keepMounted ? { forceMount: true as const, hidden: item.value !== actif } : {})}
          className="focus-etudium rounded-carte"
        >
          {item.content}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
