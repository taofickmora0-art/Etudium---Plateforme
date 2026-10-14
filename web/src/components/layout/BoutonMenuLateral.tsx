"use client";

import { useSyncExternalStore } from "react";
import { SidebarLeftIcon } from "@hugeicons/core-free-icons";
import { IconButton } from "@/components/ui/IconButton";
import { abonnerMenu, menuReduit, reduireMenu } from "@/lib/menu-lateral";

/**
 * Réduit la barre latérale à ses icônes, ou la rouvre (grand écran). Au premier affichage, le serveur ne connaît pas le
 * choix de l'appareil : le libellé suit dès que la page est prête, la barre, elle, est déjà à la bonne taille.
 */
export function BoutonMenuLateral({ className }: { className?: string }) {
  const reduit = useSyncExternalStore(abonnerMenu, menuReduit, () => false);
  return (
    <IconButton
      icon={SidebarLeftIcon}
      label={reduit ? "Ouvrir le menu" : "Réduire le menu"}
      aria-expanded={!reduit}
      aria-controls="menu-lateral"
      variant="discret"
      className={className}
      onClick={() => reduireMenu(!reduit)}
    />
  );
}
