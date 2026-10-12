"use client";

import type { ReactNode } from "react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { Accordion as RadixAccordion } from "radix-ui";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

type AccordionProps = {
  /** `question` : un texte, ou un titre composé (titre et méta d'un module) avec sa `cle`. */
  items: { question: ReactNode; answer: ReactNode; cle?: string }[];
  /** Questions ouvertes au départ (indices). */
  defaultOpen?: number[];
  className?: string;
};

/** Questions dépliables (planche « Navigation ») : plusieurs peuvent être ouvertes, filet sous chacune. */
export function Accordion({ items, defaultOpen = [], className }: AccordionProps) {
  return (
    <RadixAccordion.Root type="multiple" defaultValue={defaultOpen.map(String)} className={cn("flex min-w-0 flex-col", className)}>
      {items.map((item, index) => (
        <RadixAccordion.Item key={item.cle ?? (typeof item.question === "string" ? item.question : index)} value={String(index)} className="border-b border-bordure-carte">
          <RadixAccordion.Header className="m-0">
            <RadixAccordion.Trigger className="group focus-etudium flex min-h-14 w-full cursor-pointer items-center justify-between gap-4 border-0 bg-transparent py-2 text-left text-base leading-6 font-medium text-encre">
              <span className="min-w-0">{item.question}</span>
              <span className="flex flex-none transition-transform group-data-[state=open]:rotate-180">
                <Icon icon={ArrowDown01Icon} size={20} />
              </span>
            </RadixAccordion.Trigger>
          </RadixAccordion.Header>
          <RadixAccordion.Content className="pr-10 pb-[18px] text-sm leading-[22px] text-pretty text-discret">{item.answer}</RadixAccordion.Content>
        </RadixAccordion.Item>
      ))}
    </RadixAccordion.Root>
  );
}
