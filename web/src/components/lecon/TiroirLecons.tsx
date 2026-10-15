"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import { Cancel01Icon, LeftToRightListBulletIcon } from "@hugeicons/core-free-icons";
import { Dialog } from "radix-ui";
import { buttonVariants } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/lib/cn";

/**
 * « Leçons », dans la barre du haut du téléphone (refonte des formations, spec §1.4) : le programme dans un tiroir qui
 * glisse depuis la gauche, à la place de l'onglet « Programme » ; la progression du cours en bas. Choisir une leçon le
 * referme, Échap aussi.
 */
export function TiroirLecons({ children, pied }: { children: ReactNode; pied?: ReactNode }) {
  const [ouvert, setOuvert] = useState(false);

  // Une leçon choisie : le tiroir se ferme pendant que la page change.
  const fermerSurLien = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("a")) setOuvert(false);
  };

  return (
    <Dialog.Root open={ouvert} onOpenChange={setOuvert}>
      <Dialog.Trigger asChild>
        <button type="button" className={cn(buttonVariants({ variant: "gris" }), "h-12 flex-none rounded-bouton px-3.5 max-sm:h-10 max-sm:rounded-champ max-sm:px-3 max-sm:text-[13px]")}>
          <Icon icon={LeftToRightListBulletIcon} size={18} />
          <span>Leçons</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-encre/40 motion-safe:animate-apparition" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-50 flex w-[min(400px,90vw)] flex-col bg-panneau shadow-menu outline-none motion-safe:animate-apparition"
        >
          <div className="flex flex-none items-center justify-between gap-2 pt-3 pr-3 pb-1 pl-4">
            <Dialog.Title className="m-0 text-base leading-6 font-semibold text-encre">Leçons</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton icon={Cancel01Icon} label="Fermer les leçons" variant="discret" />
            </Dialog.Close>
          </div>
          <div onClick={fermerSurLien} className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
            {children}
          </div>
          {pied && <div className="flex-none border-t border-bordure-carte px-4 pt-3 pb-4">{pied}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
