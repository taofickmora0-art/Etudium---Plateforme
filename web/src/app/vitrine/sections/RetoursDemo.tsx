"use client";

import { FavouriteIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { ToastProvider, ToastView, useToast, type ToastOptions } from "@/components/ui/Toast";
import { Tooltip } from "@/components/ui/Tooltip";

const EXEMPLES: { legende: string; options: ToastOptions }[] = [
  { legende: "Réussite", options: { tone: "reussite", title: "Modifications enregistrées" } },
  {
    legende: "Information",
    options: { tone: "information", title: "Lien copié", description: "Collez-le où vous voulez pour partager votre certificat." },
  },
  {
    legende: "Erreur, avec action",
    options: {
      tone: "erreur",
      title: "Envoi impossible",
      description: "Vérifiez votre connexion puis réessayez.",
      action: { label: "Réessayer", onClick: () => {} },
    },
  },
];

function Exemples() {
  const { toast } = useToast();
  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
      {EXEMPLES.map(({ legende, options }) => (
        <div key={legende} className="flex min-w-0 flex-col items-start">
          <ToastView {...options} />
          <span className="mt-2 text-xs leading-[18px] text-ardoise">{legende}</span>
          <Button variant="contour" size="sm" className="mt-3" onClick={() => toast(options)}>
            Afficher pour de vrai
          </Button>
        </div>
      ))}
    </div>
  );
}

/** Les notifications de la planche, et des boutons pour les voir apparaître en bas de l'écran. */
export function ToastsDemo() {
  return (
    <ToastProvider>
      <Exemples />
    </ToastProvider>
  );
}

export function TooltipDemo() {
  return (
    <Tooltip content="Ajouter aux favoris">
      <IconButton icon={FavouriteIcon} label="Ajouter aux favoris" variant="contour" />
    </Tooltip>
  );
}
