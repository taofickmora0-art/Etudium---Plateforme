"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive02Icon,
  ArrowTurnBackwardIcon,
  Delete02Icon,
  MoreVerticalIcon,
  PencilEdit02Icon,
  RefreshIcon,
  UnavailableIcon,
  Upload04Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { Menu, type MenuEntry } from "@/components/ui/Menu";
import type { FormationResume } from "@/lib/admin/types";
import { actionsFormation, dejaPubliee, FenetresFormation, LIBELLES_ACTIONS, type ActionFormation, type FenetreFormation } from "./ActionsFormation";

const ICONES: Record<ActionFormation, IconSvgElement> = {
  publier: Upload04Icon,
  renvoyer: ArrowTurnBackwardIcon,
  archiver: Archive02Icon,
  desactiver: UnavailableIcon,
  reactiver: RefreshIcon,
  republier: Upload04Icon,
  supprimer: Delete02Icon,
};

type Props = {
  formation: Pick<FormationResume, "id" | "slug" | "titre" | "statut" | "etat" | "publieeLe">;
  /** Ses apprenants, pour la fenêtre « Désactiver » ; null sans les chiffres des cartes (0068). */
  suiveurs: number | null;
};

/**
 * Le menu ⋮ d'une carte de la page Formations du back-office (demande du 2 novembre 2026) : modifier, voir dans le
 * catalogue, les actions d'état de l'onglet « Publication » avec leurs fenêtres, et « Supprimer ». Une formation déjà
 * publiée ne se supprime pas : la fenêtre l'explique et propose de l'archiver. Après une action, la liste se relit sur
 * place (l'étiquette de la carte et les chiffres du haut suivent) ; elle ne suit pas la redirection de la suppression.
 */
export function MenuFormation({ formation: f, suiveurs }: Props) {
  const router = useRouter();
  const [fenetre, setFenetre] = useState<FenetreFormation>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  // Une entrée du menu ouvre une fenêtre : le menu, en se fermant, ne doit pas lui reprendre le focus.
  const fenetreDemandee = useRef(false);
  const ouvrir = (quoi: Exclude<FenetreFormation, null>) => () => {
    fenetreDemandee.current = true;
    setFenetre(quoi);
  };
  const etats = actionsFormation(f).filter((a) => a !== "supprimer");
  const nom = `Actions pour « ${f.titre} »`;
  const items: MenuEntry[] = [
    { label: "Modifier", icon: PencilEdit02Icon, href: `/admin/formations/${f.id}` },
    ...(f.statut === "publiee" ? [{ label: "Voir dans le catalogue", icon: ViewIcon, href: `/formations/${f.slug}` }] : []),
    ...(etats.length > 0 ? [{ separator: true as const }, ...etats.map((a) => ({ label: LIBELLES_ACTIONS[a], icon: ICONES[a], onSelect: ouvrir(a) }))] : []),
    { separator: true },
    { label: "Supprimer", icon: Delete02Icon, danger: true, onSelect: ouvrir(dejaPubliee(f) ? "suppressionImpossible" : "supprimer") },
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
      <FenetresFormation
        id={f.id}
        statut={f.statut}
        suiveurs={suiveurs}
        fenetre={fenetre}
        onFenetreChange={setFenetre}
        apresReussite={() => router.refresh()}
        retourFocus={() => bouton.current}
      />
    </>
  );
}
