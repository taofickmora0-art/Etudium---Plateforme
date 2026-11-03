"use client";

import { AddSquareIcon, CheckmarkCircle02Icon, Share03Icon, SmartPhone01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogClose } from "@/components/ui/Dialog";
import { IconTile } from "@/components/ui/IconTile";
import { surIpad } from "@/lib/pwa/installation";

/**
 * Sur iPhone et iPad, pas de fenêtre d'installation : Safari passe par Partager › Sur l'écran d'accueil. Trois gestes,
 * avec les icônes que l'on retrouve dans Safari.
 */
export function AideInstallationIos({
  open,
  onOpenChange,
  returnFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Élément qui reprend le focus à la fermeture (le rond de profil, quand la fenêtre s'ouvre depuis son menu). */
  returnFocus?: () => HTMLElement | null | undefined;
}) {
  // Lu à l'ouverture seulement (après un clic), jamais au rendu du serveur.
  const appareil = open && surIpad() ? "iPad" : "iPhone";
  const etapes = [
    {
      icon: Share03Icon,
      texte: `Touchez le bouton Partager, en ${appareil === "iPad" ? "haut" : "bas"} de Safari.`,
      detail: "S’il n’apparaît pas, touchez d’abord « ··· ».",
    },
    { icon: AddSquareIcon, texte: "Choisissez « Sur l’écran d’accueil ».", detail: "Faites défiler la liste si besoin." },
    { icon: CheckmarkCircle02Icon, texte: "Touchez « Ajouter ».", detail: "En haut à droite." },
  ];
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      returnFocus={returnFocus}
      icon={SmartPhone01Icon}
      iconTone="information"
      title={`Installer Étudium sur votre ${appareil}`}
      description="Étudium s’ouvrira depuis l’écran d’accueil, comme une application."
      footer={
        <DialogClose asChild>
          <Button>J’ai compris</Button>
        </DialogClose>
      }
    >
      <ol className="m-0 flex list-none flex-col gap-3.5 p-0">
        {etapes.map((etape, i) => (
          <li key={etape.texte} className="flex items-start gap-3">
            <IconTile icon={etape.icon} tone="information" />
            <span className="flex min-w-0 flex-col pt-0.5">
              <span className="text-[15px] leading-[22px] font-medium text-encre">
                {i + 1}. {etape.texte}
              </span>
              <span className="text-[13px] leading-5 text-discret">{etape.detail}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-4 mb-0 text-sm leading-[22px] text-pretty text-discret">
        Sur {appareil}, l’installation passe par Safari. Dans Chrome sur {appareil}, c’est le même bouton Partager, en haut à droite.
      </p>
    </Dialog>
  );
}
