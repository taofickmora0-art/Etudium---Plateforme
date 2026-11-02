"use client";

import { FavouriteIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/Icon";
import { iconButtonVariants } from "@/components/ui/IconButton";
import { cn } from "@/lib/cn";
import { useFavori } from "./useFavori";

/**
 * Le cœur favori d'une carte du catalogue (spec du 2 novembre 2026, §4) : contour gris, ou plein et rouge comme les
 * « J'aime » de la communauté. Un vrai bouton, hors du lien de la carte : le clic n'ouvre pas la fiche.
 */
export function CoeurFavori({ formationId, titre, favoriInitial, className }: { formationId: string; titre: string; favoriInitial: boolean; className?: string }) {
  const { favori, basculer } = useFavori(formationId, favoriInitial);
  return (
    <button
      type="button"
      aria-pressed={favori}
      aria-label={favori ? `Retirer ${titre} des favoris` : `Ajouter ${titre} aux favoris`}
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
