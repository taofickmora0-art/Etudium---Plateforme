"use client";

import { useState, useTransition } from "react";
import { FavouriteIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { ajouterFavori, retirerFavori } from "@/lib/favoris/actions";

/**
 * Cœur de la fiche formation (NdFormation §6.4) : « Ajouter aux favoris » / « Dans vos favoris ». Le changement est
 * affiché tout de suite, et défait avec un message si la base le refuse.
 */
export function BoutonFavori({ formationId, favoriInitial }: { formationId: string; favoriInitial: boolean }) {
  const [favori, setFavori] = useState(favoriInitial);
  const [, demarrer] = useTransition();
  const { toast } = useToast();

  const basculer = () => {
    const voulu = !favori;
    setFavori(voulu);
    demarrer(async () => {
      try {
        const reponse = voulu ? await ajouterFavori(formationId) : await retirerFavori(formationId);
        if (!reponse.ok) {
          setFavori(!voulu);
          toast({ tone: "erreur", title: reponse.erreur });
        }
      } catch {
        setFavori(!voulu);
        toast({ tone: "erreur", title: voulu ? "Le favori n’a pas pu être enregistré. Réessayez." : "Le favori n’a pas pu être retiré. Réessayez." });
      }
    });
  };

  return (
    <Button variant="contour" iconLeft={FavouriteIcon} aria-pressed={favori} onClick={basculer} className="w-full">
      {favori ? "Dans vos favoris" : "Ajouter aux favoris"}
    </Button>
  );
}
