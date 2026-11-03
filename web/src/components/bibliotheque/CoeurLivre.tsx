"use client";

import { FavouriteIcon } from "@hugeicons/core-free-icons";
import { useFavori, type ActionsFavori } from "@/components/favoris/useFavori";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { iconButtonVariants } from "@/components/ui/IconButton";
import { ajouterFavoriLivre, retirerFavoriLivre } from "@/lib/bibliotheque/actions";
import { cn } from "@/lib/cn";

// Le favori d'un livre (favoris_livres, 0074) : les mêmes cœurs que ceux des formations (CoeurFavori, BoutonFavori), avec
// les actions des livres. Le changement s'affiche tout de suite ; un refus de la base le défait, avec un message.

const LIVRES: ActionsFavori = { ajouter: (id) => ajouterFavoriLivre(id), retirer: (id) => retirerFavoriLivre(id) };

/** Le cœur d'une carte : un bouton à bascule hors du lien de la carte (son nom ne change pas, son état est dans aria-pressed). */
export function CoeurLivre({ livreId, titre, favoriInitial, className }: { livreId: string; titre: string; favoriInitial: boolean; className?: string }) {
  const { favori, basculer } = useFavori(livreId, favoriInitial, LIVRES);
  return (
    <button
      type="button"
      aria-pressed={favori}
      aria-label={`Ajouter « ${titre} » aux favoris`}
      onClick={basculer}
      className={cn(
        iconButtonVariants({ variant: "contour" }),
        "size-10 max-sm:size-9",
        favori ? "text-erreur-vif enabled:hover:text-erreur-texte [&_path]:fill-current" : "text-discret enabled:hover:text-texte",
        className,
      )}
    >
      <Icon icon={FavouriteIcon} size={20} className="max-sm:size-[18px]" />
    </button>
  );
}

/** Le bouton de la fiche d'un livre : « Ajouter aux favoris » / « Dans vos favoris ». */
export function BoutonFavoriLivre({ livreId, favoriInitial, className }: { livreId: string; favoriInitial: boolean; className?: string }) {
  const { favori, basculer } = useFavori(livreId, favoriInitial, LIVRES);
  return (
    <Button variant="contour" iconLeft={FavouriteIcon} aria-pressed={favori} onClick={basculer} className={cn("w-full", className)}>
      {favori ? "Dans vos favoris" : "Ajouter aux favoris"}
    </Button>
  );
}
