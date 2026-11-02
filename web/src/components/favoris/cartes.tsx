import { CarteFormation } from "@/components/catalogue/CarteFormation";
import { CarteSuivie, versVueCarte } from "@/components/mes-formations/CarteSuivie";
import type { Inscription } from "@/lib/inscriptions/types";
import { formationsSuivies, type FicheSuivie } from "@/lib/mes-formations/regles";
import type { LigneProgression } from "@/lib/progression/types";
import type { Favori } from "./PageFavoris";

/**
 * Les cartes de la page Favoris, dans l'ordre des favoris (le plus récent d'abord), sans badge : le cœur occupe ce coin.
 * Une formation commencée, ou inscrite (0069), montre sa progression ; une formation archivée jamais commencée n'est plus
 * visible (règles de la base) et disparaît de la liste.
 */
export function cartesFavorites(ids: string[], fiches: FicheSuivie[], lignes: LigneProgression[], inscriptions: readonly Inscription[] = []): Favori[] {
  const suivies = formationsSuivies(fiches, lignes, new Set(ids), inscriptions);
  return ids.flatMap((id): Favori[] => {
    const fiche = fiches.find((f) => f.id === id);
    if (!fiche) return [];
    const suivie = suivies.find((s) => s.fiche.id === id);
    if (suivie) return [{ id, titre: fiche.titre, carte: <CarteSuivie vue={versVueCarte(suivie)} sansEtiquette /> }];
    if (fiche.statut !== "publiee") return [];
    return [{ id, titre: fiche.titre, carte: <CarteFormation carte={fiche} sansEtiquette /> }];
  });
}
