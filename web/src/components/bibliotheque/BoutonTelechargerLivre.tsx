"use client";

import { useState } from "react";
import { Download04Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { lienTelechargementLivre } from "@/lib/bibliotheque/lecteur";
import { cn } from "@/lib/cn";

const ECHEC = "Le téléchargement n’a pas pu démarrer. Réessayez.";

/**
 * « Télécharger » d'un livre téléchargeable (fiche, lecteur) : la base note le téléchargement et vérifie l'accès
 * (noter_telechargement), puis le navigateur suit un lien signé de deux minutes, avec le titre comme nom du fichier.
 * Un refus (débit, accès) est annoncé sous le bouton.
 */
export function BoutonTelechargerLivre({
  livreId,
  titre,
  variant = "contour",
  className,
  ouvrir = (url: string) => window.location.assign(url),
}: {
  livreId: string;
  titre: string;
  variant?: "contour" | "discret";
  className?: string;
  /** Suit le lien du fichier (remplacé dans les tests). */
  ouvrir?: (url: string) => void;
}) {
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const telecharger = async () => {
    setOccupe(true);
    setErreur(null);
    try {
      const lien = await lienTelechargementLivre(livreId, titre);
      if ("erreur" in lien) setErreur(lien.erreur);
      else ouvrir(lien.url);
    } catch {
      setErreur(ECHEC);
    } finally {
      setOccupe(false);
    }
  };

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Button variant={variant} iconLeft={Download04Icon} loading={occupe} onClick={telecharger} className="w-full">
        Télécharger
      </Button>
      {erreur && (
        <p role="alert" className="m-0 text-center text-[13px] leading-5 text-erreur-texte">
          {erreur}
        </p>
      )}
    </div>
  );
}
