"use client";

import type { ReactNode } from "react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { Accordion } from "radix-ui";
import { Icon } from "@/components/ui/Icon";

type Section = { cle: string; titre: string; contenu: ReactNode };

/**
 * Les modules du programme de la leçon, repliables (refonte des formations, spec §1.4, d'après izimentor) : le titre du
 * module en capitales, son filet, et une flèche. Les modules ouverts au départ : celui de la leçon en cours.
 */
export function ModulesRepliables({ sections, ouverts }: { sections: Section[]; ouverts: string[] }) {
  return (
    <Accordion.Root type="multiple" defaultValue={ouverts} className="flex flex-col gap-1">
      {sections.map((section) => (
        <Accordion.Item key={section.cle} value={section.cle} className="flex flex-col">
          <Accordion.Header className="m-0">
            <Accordion.Trigger className="group focus-etudium flex h-12 w-full cursor-pointer items-center gap-2.5 rounded-bouton border-0 bg-transparent pr-2 pl-3 text-left transition-colors hover:bg-white/55">
              <span className="min-w-0 truncate text-[13.5px] tracking-[0.04em] text-ardoise uppercase">{section.titre}</span>
              <span aria-hidden="true" className="h-px min-w-4 flex-1 bg-[#DAE0EE]" />
              <span className="flex flex-none text-ardoise transition-transform group-data-[state=open]:rotate-180">
                <Icon icon={ArrowDown01Icon} size={18} />
              </span>
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="pt-2 pb-2">{section.contenu}</Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
