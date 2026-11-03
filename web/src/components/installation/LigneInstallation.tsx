"use client";

import { useRef } from "react";
import { Download01Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/Icon";
import { AideInstallationIos } from "./AideInstallationIos";
import { useProposerInstallation } from "./useProposerInstallation";

/** Ligne « Installer l'application » de la page « Profil » du téléphone, juste avant la déconnexion. */
export function LigneInstallation() {
  const { proposee, ios, lancer, aideIos, setAideIos } = useProposerInstallation();
  const bouton = useRef<HTMLButtonElement>(null);
  if (!proposee && !aideIos) return null;
  return (
    <li>
      {proposee && (
        <button
          ref={bouton}
          type="button"
          onClick={lancer}
          aria-haspopup={ios ? "dialog" : undefined}
          className="focus-etudium box-border flex min-h-[76px] w-full cursor-pointer items-center gap-3.5 border-0 bg-transparent px-1 py-3.5 text-left transition-colors hover:bg-page"
        >
          <Icon icon={Download01Icon} size={22} />
          <span className="min-w-0 flex-1 text-[15px] leading-[22px] font-medium text-encre">Installer l’application</span>
        </button>
      )}
      <AideInstallationIos open={aideIos} onOpenChange={setAideIos} returnFocus={() => bouton.current} />
    </li>
  );
}
