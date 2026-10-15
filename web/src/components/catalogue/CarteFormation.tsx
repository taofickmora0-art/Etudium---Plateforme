import { CatalogCard } from "@/components/ui/CatalogCard";
import type { TagTone } from "@/components/ui/Tag";
import { badgeDeCarte, dureeLisible, parcoursPrincipal } from "@/lib/catalogue/regles";
import type { CarteCatalogue } from "@/lib/catalogue/types";
import { libelleNiveau } from "@/lib/contenus/libelles";
import { urlCouverture } from "@/lib/couvertures/adresse";

/**
 * Carte d'une formation du catalogue : la variante publique porte aussi la puce du parcours (NdCataloguePublic).
 * `sansEtiquette` : pas de badge, un bouton occupe le coin (cœur de la page Favoris).
 */
export function CarteFormation({
  carte,
  variante,
  sansEtiquette = false,
  titleAs = "h2",
}: {
  carte: CarteCatalogue;
  variante: "public" | "connecte";
  sansEtiquette?: boolean;
  /** h3 sous le titre d'une section (« Formations disponibles » de l'Accueil). */
  titleAs?: "h2" | "h3";
}) {
  const couleur = parcoursPrincipal(carte);
  const parcours = [...carte.parcours].sort((a, b) => a.ordre - b.ordre)[0];
  return (
    <CatalogCard
      href={`/formations/${carte.slug}`}
      title={carte.titre}
      description={carte.resume}
      parcours={couleur}
      duration={dureeLisible(carte.dureeSecondes) || undefined}
      level={libelleNiveau(carte.niveau)}
      couverture={urlCouverture(carte.couverture)}
      rating={carte.note ?? undefined}
      reviews={carte.nbAvis}
      tag={sansEtiquette ? undefined : badgeDeCarte(carte)}
      parcoursTag={variante === "public" && parcours && !sansEtiquette ? { tone: couleur as TagTone, label: parcours.nomCourt } : undefined}
      titleAs={titleAs}
    />
  );
}
