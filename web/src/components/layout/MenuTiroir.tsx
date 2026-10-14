"use client";

import { Suspense, useState, type MouseEvent } from "react";
import { usePathname } from "next/navigation";
import { Cancel01Icon, Menu01Icon } from "@hugeicons/core-free-icons";
import { Dialog } from "radix-ui";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/lib/cn";
import { EspacesCommunaute } from "./EspacesCommunaute";
import { SidebarNavLinks } from "./SidebarNav";

function EntreesActives() {
  const pathname = usePathname();
  // Sur les pages de la communauté, ses espaces (spec du fil « Actualités », §1).
  const communaute = pathname === "/communaute" || pathname.startsWith("/communaute/");
  return <SidebarNavLinks pathname={pathname} repliable={false} apresPremierGroupe={communaute ? <EspacesCommunaute pathname={pathname} /> : null} />;
}

/**
 * Le menu ≡ du téléphone (demande du 14 octobre 2026) : les mêmes entrées que la barre latérale de l'ordinateur, dans un
 * tiroir qui glisse depuis la gauche ; sur la Communauté, ses espaces en plus. Choisir une entrée le referme.
 */
export function MenuTiroir({ className }: { className?: string }) {
  const [ouvert, setOuvert] = useState(false);

  // Un lien choisi : le tiroir se ferme pendant que la page change.
  const fermerSurLien = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("a")) setOuvert(false);
  };

  return (
    <Dialog.Root open={ouvert} onOpenChange={setOuvert}>
      <Dialog.Trigger asChild>
        <IconButton icon={Menu01Icon} label="Menu" variant="plein" className={cn("size-12 rounded-bouton", className)} />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-encre/40 motion-safe:animate-apparition" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-50 flex w-[min(337px,86vw)] flex-col overflow-y-auto bg-coque shadow-menu outline-none motion-safe:animate-apparition"
        >
          <div className="flex items-center justify-between gap-2 pt-3 pr-3 pb-1 pl-5">
            <Dialog.Title className="m-0 text-base leading-6 font-semibold text-encre">Menu</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton icon={Cancel01Icon} label="Fermer le menu" variant="discret" />
            </Dialog.Close>
          </div>
          <div onClick={fermerSurLien}>
            <Suspense fallback={<SidebarNavLinks pathname={null} repliable={false} />}>
              <EntreesActives />
            </Suspense>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
