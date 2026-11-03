"use client";

import { Suspense, useId, useState, type MouseEvent } from "react";
import { usePathname } from "next/navigation";
import { Cancel01Icon, Menu01Icon } from "@hugeicons/core-free-icons";
import { Dialog } from "radix-ui";
import { useGroupesNonLus } from "@/components/groupes/useGroupesNonLus";
import { useMessagesNonLus } from "@/components/messages/useMessagesNonLus";
import { IconButton } from "@/components/ui/IconButton";
import { PastilleNombre } from "@/components/ui/PastilleNombre";
import { spaceOf } from "@/lib/auth/permissions";
import { cn } from "@/lib/cn";
import { EspacesCommunaute } from "./EspacesCommunaute";
import { SidebarNavLinks } from "./SidebarNav";

function EntreesActives() {
  const pathname = usePathname();
  // Sur l'Accueil (la communauté) et la page d'une publication, ses espaces (spec du nouvel Accueil, §4).
  // Et, pour le formateur, sa communauté et ses publications (restructuration R1).
  const communaute =
    pathname === "/accueil" || pathname.startsWith("/communaute/") || pathname === "/formateur/communaute" || pathname.startsWith("/formateur/communaute/");
  return <SidebarNavLinks pathname={pathname} repliable={false} apresPremierGroupe={communaute ? <EspacesCommunaute pathname={pathname} /> : null} />;
}

/**
 * Sur le bouton ≡ : les conversations non lues et les messages non lus des groupes (les entrées « Messages » et
 * « Groupes » sont dans le tiroir), décrits par `id`.
 */
function PastilleMessages({ id }: { id: string }) {
  const actuel = spaceOf(usePathname());
  const nonLus = useMessagesNonLus(actuel === "admin" ? "equipe" : actuel);
  const nonLusGroupes = useGroupesNonLus(actuel !== "admin");
  const total = nonLus + nonLusGroupes;
  const description = [
    nonLus > 0 ? `${nonLus} conversation${nonLus > 1 ? "s" : ""} non lue${nonLus > 1 ? "s" : ""}` : "",
    nonLusGroupes > 0 ? `${nonLusGroupes} message${nonLusGroupes > 1 ? "s" : ""} non lu${nonLusGroupes > 1 ? "s" : ""} dans les groupes` : "",
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <>
      {total > 0 && <PastilleNombre nombre={total} className="pointer-events-none absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] ring-2 ring-page" />}
      <span id={id} className="sr-only">
        {description}
      </span>
    </>
  );
}

/**
 * Le menu ≡ du téléphone (demande du 14 octobre 2026) : les mêmes entrées que la barre latérale de l'ordinateur, dans un
 * tiroir qui glisse depuis la gauche ; sur l'Accueil, les espaces de la communauté en plus. Choisir une entrée le referme.
 */
export function MenuTiroir({ className }: { className?: string }) {
  const [ouvert, setOuvert] = useState(false);
  const idPastille = useId();

  // Un lien choisi : le tiroir se ferme pendant que la page change.
  const fermerSurLien = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("a")) setOuvert(false);
  };

  return (
    <Dialog.Root open={ouvert} onOpenChange={setOuvert}>
      <span className={cn("relative inline-flex flex-none", className)}>
        <Dialog.Trigger asChild>
          <IconButton
            icon={Menu01Icon}
            label="Menu"
            variant="plein"
            aria-describedby={idPastille}
            className="size-12 rounded-bouton max-sm:size-10 max-sm:rounded-champ max-sm:[&_svg]:size-[18px]"
          />
        </Dialog.Trigger>
        <Suspense fallback={<span id={idPastille} className="sr-only" />}>
          <PastilleMessages id={idPastille} />
        </Suspense>
      </span>
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
