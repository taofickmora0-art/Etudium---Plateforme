"use client";

import { cn } from "@/lib/cn";
import { Icon, type IconSvgElement } from "./Icon";

type Option = {
  value: string;
  label: string;
  /** Icône avant le libellé (cadenas d'un espace fermé). */
  icon?: IconSvgElement;
  /** Nom annoncé quand l'icône porte un sens (« Business, espace verrouillé »). */
  ariaLabel?: string;
};

type FilterChipsProps = {
  /** Nom du groupe pour les lecteurs d'écran (« Filtrer mes formations »). */
  label: string;
  options: Option[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
};

/** Filtres de liste : le filtre actif passe en bleu clair, texte bleu (planche « Boutons »). */
export function FilterChips({ label, options, value, onValueChange, className }: FilterChipsProps) {
  return (
    <div role="group" aria-label={label} className={cn("flex flex-wrap items-center gap-2 max-sm:gap-1.5", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            aria-label={option.ariaLabel}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "focus-etudium cible-tactile relative h-[42px] cursor-pointer rounded-champ border px-[15px] pb-px text-sm font-medium tracking-[-0.1px] whitespace-nowrap transition-colors max-sm:h-9 max-sm:px-3 max-sm:text-[13px]",
              active ? "border-bleu-bord bg-bleu-clair text-bleu" : "border-bordure bg-panneau text-texte hover:bg-page",
            )}
          >
            {option.icon ? (
              <span className="inline-flex items-center gap-1.5">
                <Icon icon={option.icon} size={16} />
                {option.label}
              </span>
            ) : (
              option.label
            )}
          </button>
        );
      })}
    </div>
  );
}
