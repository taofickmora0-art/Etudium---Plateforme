"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive02Icon, Delete02Icon, MoreVerticalIcon, PencilEdit02Icon, Upload04Icon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { Menu, type MenuEntry } from "@/components/ui/Menu";
import { actionsLivre, type ActionLivre } from "@/lib/bibliotheque/regles";
import type { StatutLivre } from "@/lib/bibliotheque/types";
import { FenetresLivre, LIBELLES_ACTIONS_LIVRE } from "./ActionsLivre";

const ICONES: Record<ActionLivre, IconSvgElement> = { publier: Upload04Icon, archiver: Archive02Icon, republier: Upload04Icon, supprimer: Delete02Icon };

/**
 * Le menu ⋮ d'une carte de la Bibliothèque du back-office, comme celui des formations : Modifier, l'action d'état
 * (Publier, Archiver ou Republier) et, pour un brouillon, « Supprimer le brouillon », chacune avec sa fenêtre. Après une
 * action, la liste se relit sur place.
 */
export function MenuLivre({ livre }: { livre: { id: string; titre: string; statut: StatutLivre } }) {
  const router = useRouter();
  const [fenetre, setFenetre] = useState<ActionLivre | null>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  // Une entrée du menu ouvre une fenêtre : le menu, en se fermant, ne doit pas lui reprendre le focus.
  const fenetreDemandee = useRef(false);
  const ouvrir = (quoi: ActionLivre) => () => {
    fenetreDemandee.current = true;
    setFenetre(quoi);
  };
  const actions = actionsLivre(livre.statut);
  const etats = actions.filter((a) => a !== "supprimer");
  const nom = `Actions pour « ${livre.titre} »`;
  const items: MenuEntry[] = [
    { label: "Modifier", icon: PencilEdit02Icon, href: `/admin/bibliotheque/${livre.id}` },
    { separator: true },
    ...etats.map((a) => ({ label: LIBELLES_ACTIONS_LIVRE[a], icon: ICONES[a], onSelect: ouvrir(a) })),
    ...(actions.includes("supprimer")
      ? [{ separator: true as const }, { label: LIBELLES_ACTIONS_LIVRE.supprimer, icon: Delete02Icon, danger: true, onSelect: ouvrir("supprimer") }]
      : []),
  ];

  return (
    <>
      <Menu
        label={nom}
        align="start"
        className="w-[250px]"
        trigger={<IconButton ref={bouton} icon={MoreVerticalIcon} label={nom} variant="contour" size="sm" className="max-sm:size-9" />}
        items={items}
        rendreLeFocus={() => {
          const rendre = !fenetreDemandee.current;
          fenetreDemandee.current = false;
          return rendre;
        }}
      />
      <FenetresLivre id={livre.id} fenetre={fenetre} onFenetreChange={setFenetre} apresReussite={() => router.refresh()} retourFocus={() => bouton.current} />
    </>
  );
}
