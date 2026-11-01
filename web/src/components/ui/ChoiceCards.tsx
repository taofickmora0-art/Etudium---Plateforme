"use client";

import { RadioGroup } from "radix-ui";
import { cn } from "@/lib/cn";
import { Tag } from "./Tag";

type ChoiceOption = {
  value: string;
  title: string;
  subtitle?: string;
  price?: string;
  /** Pastille à côté du titre (« Recommandé »). */
  badge?: string;
  /** Option visible mais pas choisissable (abonnement sans prix). */
  disabled?: boolean;
};

type ChoiceCardsProps = {
  /** Question posée, lue par les lecteurs d'écran (« Choisissez une formule »). */
  label: string;
  options: ChoiceOption[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
};

/** Choix d'une formule en cartes (planche « Formulaires », « Choix en cartes ») : un seul choix, flèches du clavier. */
export function ChoiceCards({ label, options, value, onValueChange, className }: ChoiceCardsProps) {
  return (
    <RadioGroup.Root
      aria-label={label}
      value={value}
      onValueChange={onValueChange}
      className={cn("grid grid-cols-1 items-start gap-4 sm:grid-cols-3", className)}
    >
      {options.map((option) => (
        <RadioGroup.Item
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          className="group focus-etudium box-border flex w-full cursor-pointer items-center gap-3.5 rounded-bouton border border-bordure bg-panneau px-4 py-3.5 text-left text-texte transition-colors hover:bg-page data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60 data-[disabled]:hover:bg-panneau data-[state=checked]:border-bleu data-[state=checked]:shadow-[inset_0_0_0_1px_var(--color-bleu)]"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] leading-[22px] font-semibold text-encre">{option.title}</span>
              {option.badge && <Tag tone="nouveau">{option.badge}</Tag>}
            </span>
            {option.subtitle && <span className="text-[13px] leading-5 text-discret">{option.subtitle}</span>}
          </span>
          {option.price && <span className="text-right text-sm font-semibold text-encre">{option.price}</span>}
          <span
            aria-hidden="true"
            className="flex size-5 flex-none items-center justify-center rounded-full border-[1.5px] border-inactif bg-panneau group-data-[state=checked]:border-bleu group-data-[state=checked]:bg-bleu"
          >
            <RadioGroup.Indicator className="size-2 rounded-full bg-panneau" />
          </span>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
