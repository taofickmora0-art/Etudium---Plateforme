"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft01Icon, BookOpen01Icon } from "@hugeicons/core-free-icons";
import { buttonVariants } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { BoutonFin } from "./BoutonFin";

// « Mode lecture » : un attribut sur <html> (globals.css masque le programme), gardé d'une leçon à l'autre.
const abonnes = new Set<() => void>();
const enLecture = () => document.documentElement.dataset.lecture === "1";
function basculerLecture() {
  const racine = document.documentElement;
  if (enLecture()) delete racine.dataset.lecture;
  else racine.dataset.lecture = "1";
  for (const prevenir of abonnes) prevenir();
}
function abonner(prevenir: () => void) {
  abonnes.add(prevenir);
  return () => {
    abonnes.delete(prevenir);
  };
}

type Props = {
  titreFormation: string;
  /** La page du cours. */
  adresseFormation: string;
  leconId: string;
  suivante?: string;
};

/**
 * La barre du haut de la leçon, sur ordinateur (refonte des formations, spec §1.1, d'après izimentor) : « ‹ Titre de la
 * formation » à gauche ; « Mode lecture » et « Terminer la leçon › » à droite. Elle reste en haut du panneau qui défile
 * (-top-8 : le collage compte à partir du rembourrage du panneau).
 */
export function BarreHautLecon({ titreFormation, adresseFormation, leconId, suivante }: Props) {
  const lecture = useSyncExternalStore(abonner, enLecture, () => false);
  return (
    <div className="sticky -top-8 z-10 -mx-8 -mt-8 mb-6 flex items-start justify-between gap-4 border-b border-separateur bg-panneau px-8 pt-5 pb-4 max-lg:hidden">
      <Link
        href={adresseFormation}
        className="focus-etudium flex min-h-10 min-w-0 items-center gap-1.5 rounded-champ text-sm leading-[22px] font-medium text-texte no-underline hover:text-bleu"
      >
        <Icon icon={ArrowLeft01Icon} size={18} className="flex-none" />
        <span className="truncate">{titreFormation}</span>
      </Link>
      <div className="flex flex-none items-start gap-2">
        <button type="button" aria-pressed={lecture} onClick={basculerLecture} className={buttonVariants({ variant: lecture ? "gris" : "contour" })}>
          <Icon icon={BookOpen01Icon} size={18} />
          <span>Mode lecture</span>
        </button>
        <BoutonFin leconId={leconId} variante="ordinateur" suivante={suivante} formation={adresseFormation} />
      </div>
    </div>
  );
}
