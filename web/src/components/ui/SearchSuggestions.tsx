"use client";

import { useId, useRef, type KeyboardEvent } from "react";
import Link from "next/link";
import { Search01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/cn";
import type { IconSvgElement } from "./Icon";
import { MenuRow, menuHeadingClasses, menuItemClasses, menuSeparatorClasses, menuSurfaceClasses } from "./Menu";
import { SearchInput } from "./SearchInput";

export type SuggestionGroup = {
  title: string;
  /** Icône des lignes du groupe (formation, parcours…). */
  icon?: IconSvgElement;
  items: { label: string; meta?: string; href: string }[];
};

type SearchSuggestionsProps = {
  query: string;
  onQueryChange: (query: string) => void;
  groups: SuggestionGroup[];
  /** Page de tous les résultats ; Entrée dans le champ y mène. */
  resultsHref: (query: string) => string;
  onNavigate?: (href: string) => void;
  className?: string;
};

/**
 * Panneau de recherche de la barre du haut (planche « Menus », « Suggestions de recherche ») :
 * champ, suggestions groupées, « Voir tous les résultats ». Flèches haut et bas pour passer d'une ligne à l'autre.
 */
export function SearchSuggestions({ query, onQueryChange, groups, resultsHref, onNavigate, className }: SearchSuggestionsProps) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);

  const move = (event: KeyboardEvent, step: 1 | -1) => {
    const links = Array.from(panel.current?.querySelectorAll<HTMLElement>("[data-suggestion]") ?? []);
    const input = panel.current?.querySelector<HTMLInputElement>("input");
    const stops = [input, ...links].filter(Boolean) as HTMLElement[];
    const index = stops.indexOf(document.activeElement as HTMLElement);
    const next = stops[Math.max(0, Math.min(stops.length - 1, index + step))];
    if (next) {
      event.preventDefault();
      next.focus();
    }
  };

  return (
    <div
      ref={panel}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown") move(event, 1);
        if (event.key === "ArrowUp") move(event, -1);
      }}
      className={cn(menuSurfaceClasses, "w-[360px]", className)}
    >
      <form
        role="search"
        className="px-1 pt-1 pb-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (query.trim()) onNavigate?.(resultsHref(query.trim()));
        }}
      >
        <label htmlFor={id} className="sr-only">
          Rechercher
        </label>
        <SearchInput id={id} value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Rechercher…" autoComplete="off" />
      </form>
      {groups
        .filter((g) => g.items.length > 0)
        .map((group) => (
          <section key={group.title} aria-label={group.title}>
            <h3 className={cn(menuHeadingClasses, "m-0")}>{group.title}</h3>
            <ul className="m-0 list-none p-0">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} data-suggestion="" className={cn(menuItemClasses, "focus-visible:bg-coque")} onClick={() => onNavigate?.(item.href)}>
                    <MenuRow icon={group.icon} label={item.label} description={item.meta} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      <div className={menuSeparatorClasses} />
      <Link href={resultsHref(query.trim())} data-suggestion="" className={cn(menuItemClasses, "focus-visible:bg-coque")} onClick={() => onNavigate?.(resultsHref(query.trim()))}>
        <MenuRow icon={Search01Icon} label="Voir tous les résultats" />
        <kbd className="rounded-md bg-coque px-1.5 py-0.5 font-sans text-xs leading-4 font-medium text-ardoise">Entrée</kbd>
      </Link>
    </div>
  );
}
