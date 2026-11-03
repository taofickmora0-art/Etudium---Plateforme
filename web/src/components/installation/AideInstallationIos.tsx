"use client";

import { AddSquareIcon, CheckmarkCircle02Icon, Share03Icon, SmartPhone01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogClose } from "@/components/ui/Dialog";
import { IconTile } from "@/components/ui/IconTile";
import { navigateurIos, surIpad } from "@/lib/pwa/installation";

/**
 * Sur iPhone et iPad, pas de fenêtre d'installation : on passe par Partager › Sur l'écran d'accueil. Trois gestes,
 * avec les icônes que l'on retrouve dans le navigateur. Le premier dépend du navigateur (Safari, Chrome ou un autre,
 * demande du 3 novembre 2026) : le bouton Partager n'y est pas au même endroit.
 */
function premiereEtape(navigateur: "safari" | "chrome" | "autre", appareil: "iPhone" | "iPad") {
  if (navigateur === "chrome") {
    // La barre d'adresse de Chrome est en haut ou en bas, selon les réglages de chacun (capture du 3 novembre 2026).
    return {
      texte: "Touchez le bouton Partager, dans la barre d’adresse de Chrome, à droite.",
      detail: "Un carré avec une flèche vers le haut. La barre d’adresse est en bas ou en haut de l’écran.",
    };
  }
  if (navigateur === "autre") {
    return { texte: "Ouvrez le menu de votre navigateur, puis touchez « Partager ».", detail: "Le menu est souvent « ··· » ou « ≡ »." };
  }
  return { texte: `Touchez le bouton Partager, en ${appareil === "iPad" ? "haut" : "bas"} de Safari.`, detail: "S’il n’apparaît pas, touchez d’abord « ··· »." };
}

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
  const navigateur = open ? navigateurIos() : "safari";
  const etapes = [
    { icon: Share03Icon, ...premiereEtape(navigateur, appareil) },
    // La feuille de partage de l'iPhone (captures du 3 novembre 2026) : l'option est derrière « En voir plus », et le
    // dernier écran a « Ouvrir comme app web », à laisser activé pour qu'Étudium s'ouvre comme une application.
    { icon: AddSquareIcon, texte: "Choisissez « Sur l’écran d’accueil ».", detail: "Si elle n’apparaît pas, touchez d’abord « En voir plus »." },
    { icon: CheckmarkCircle02Icon, texte: "Touchez « Ajouter », en haut à droite.", detail: "Laissez « Ouvrir comme app web » activé." },
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
        {navigateur === "safari"
          ? `Chrome et les autres navigateurs de l’${appareil} le permettent aussi, par leur bouton Partager.`
          : "Si « Sur l’écran d’accueil » n’apparaît pas, ouvrez etudium.online dans Safari et recommencez."}
      </p>
    </Dialog>
  );
}
