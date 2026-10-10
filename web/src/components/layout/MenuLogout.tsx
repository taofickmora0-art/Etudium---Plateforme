"use client";

import { useRef, useState } from "react";
import { Logout03Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/Icon";
import { LogoutDialog } from "./LogoutDialog";

/** Dernière ligne de la page « Profil » du téléphone (NdMobMenu) : déconnexion, en rouge, après confirmation. */
export function MenuLogout() {
  const [open, setOpen] = useState(false);
  const bouton = useRef<HTMLButtonElement>(null);
  return (
    <li>
      <button
        ref={bouton}
        type="button"
        onClick={() => setOpen(true)}
        className="focus-etudium box-border flex min-h-[76px] w-full cursor-pointer items-center gap-3.5 border-0 bg-transparent px-1 py-3.5 text-left text-erreur-texte transition-colors hover:bg-page"
      >
        <Icon icon={Logout03Icon} size={22} />
        <span className="min-w-0 flex-1 text-[15px] leading-[22px] font-medium">Se déconnecter</span>
      </button>
      <LogoutDialog open={open} onOpenChange={setOpen} returnFocus={() => bouton.current} />
    </li>
  );
}
