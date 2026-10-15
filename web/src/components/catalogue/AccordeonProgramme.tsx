"use client";

import { useState, type ComponentProps } from "react";
import Link from "next/link";
import { PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { Accordion } from "@/components/ui/Accordion";
import { Icon } from "@/components/ui/Icon";

type Items = ComponentProps<typeof Accordion>["items"];

const LIEN = "focus-etudium flex items-center gap-1.5 rounded-champ text-sm leading-[22px] font-medium text-bleu no-underline hover:underline";

/**
 * Le programme de la page du cours, pour un compte connecté (refonte des formations, spec §2, d'après izimentor) :
 * « Tout déplier / Tout replier » au-dessus des modules (le premier ouvert au départ) et, pour l'équipe et le formateur
 * de la formation, « Modifier les leçons ».
 */
export function AccordeonProgramme({ items, lienModifier }: { items: Items; lienModifier: string | null }) {
  const [ouvertes, setOuvertes] = useState<number[]>(items.length > 0 ? [0] : []);
  const toutOuvert = items.length > 0 && ouvertes.length === items.length;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        {lienModifier && (
          <Link href={lienModifier} className={LIEN}>
            <Icon icon={PencilEdit02Icon} size={16} />
            <span>Modifier les leçons</span>
          </Link>
        )}
        <button
          type="button"
          onClick={() => setOuvertes(toutOuvert ? [] : items.map((_, i) => i))}
          className="focus-etudium ml-auto cursor-pointer rounded-champ border-0 bg-transparent p-0 text-sm leading-[22px] font-medium text-bleu hover:underline"
        >
          {toutOuvert ? "Tout replier" : "Tout déplier"}
        </button>
      </div>
      <Accordion ouvertes={ouvertes} onOuvertesChange={setOuvertes} className="border-t border-bordure-carte" items={items} />
    </div>
  );
}
