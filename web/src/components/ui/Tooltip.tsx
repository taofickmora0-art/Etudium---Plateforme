"use client";

import type { ReactNode } from "react";
import { Tooltip as RadixTooltip } from "radix-ui";

type TooltipProps = {
  content: ReactNode;
  /** Un seul élément focalisable (bouton icône…). */
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
};

/**
 * Infobulle au survol et au focus clavier (planche « Messages », « Chargement et aides ») : fond encre, texte blanc 12 px.
 * Elle complète un libellé, elle ne le remplace pas : le bouton garde son `aria-label`.
 */
export function Tooltip({ content, children, side = "top" }: TooltipProps) {
  return (
    <RadixTooltip.Provider delayDuration={300}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            sideOffset={8}
            className="z-50 rounded-lg bg-encre px-2.5 py-1.5 text-xs leading-[18px] font-medium text-white motion-safe:animate-apparition"
          >
            {content}
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
