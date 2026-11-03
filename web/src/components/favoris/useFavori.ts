"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import { ajouterFavori, retirerFavori } from "@/lib/favoris/actions";

/** Les actions qui ajoutent et retirent un favori : celles des formations, ou celles des livres (Bibliothèque). */
export type ActionsFavori = {
  ajouter: (id: string) => Promise<{ ok: true } | { ok: false; erreur: string }>;
  retirer: (id: string) => Promise<{ ok: true } | { ok: false; erreur: string }>;
};
const FORMATIONS: ActionsFavori = { ajouter: (id) => ajouterFavori(id), retirer: (id) => retirerFavori(id) };

/**
 * Le favori d'une formation (ou d'un livre, avec ses actions), côté navigateur (cœur du catalogue, bouton de la fiche) :
 * le changement s'affiche tout de suite, sans confirmation ; si la base le refuse, il est défait et un message le dit.
 * Les actions relisent la page (refresh) : la page Favoris le reflète.
 */
export function useFavori(id: string, favoriInitial: boolean, actions: ActionsFavori = FORMATIONS): { favori: boolean; basculer: () => void } {
  const [favori, setFavori] = useState(favoriInitial);
  const [, demarrer] = useTransition();
  const { toast } = useToast();

  const basculer = () => {
    const voulu = !favori;
    setFavori(voulu);
    demarrer(async () => {
      try {
        const reponse = voulu ? await actions.ajouter(id) : await actions.retirer(id);
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
