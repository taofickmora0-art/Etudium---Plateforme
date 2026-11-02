"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import { ajouterFavori, retirerFavori } from "@/lib/favoris/actions";

/**
 * Le favori d'une formation, côté navigateur (cœur du catalogue, bouton de la fiche) : le changement s'affiche tout de
 * suite, sans confirmation ; si la base le refuse, il est défait et un message le dit. Les actions relisent la page
 * (refresh) : la page Favoris le reflète.
 */
export function useFavori(formationId: string, favoriInitial: boolean): { favori: boolean; basculer: () => void } {
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

  return { favori, basculer };
}
