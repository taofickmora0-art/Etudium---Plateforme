"use client";

import { FavouriteIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { useFavori } from "./useFavori";

/**
 * Cœur de la fiche formation (NdFormation §6.4) : « Ajouter aux favoris » / « Dans vos favoris ». Le changement est
 * affiché tout de suite, et défait avec un message si la base le refuse.
 */
export function BoutonFavori({ formationId, favoriInitial }: { formationId: string; favoriInitial: boolean }) {
  const { favori, basculer } = useFavori(formationId, favoriInitial);
  return (
    <Button variant="contour" iconLeft={FavouriteIcon} aria-pressed={favori} onClick={basculer} className="w-full">
      {favori ? "Dans vos favoris" : "Ajouter aux favoris"}
    </Button>
  );
}
