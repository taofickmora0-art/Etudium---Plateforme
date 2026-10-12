import { CatalogCard } from "@/components/ui/CatalogCard";
import type { TagTone } from "@/components/ui/Tag";
import { badgeDeCarte, dureeLisible, parcoursPrincipal } from "@/lib/catalogue/regles";
import type { CarteCatalogue } from "@/lib/catalogue/types";
import { libelleNiveau } from "@/lib/contenus/libelles";

/** Carte d'une formation du catalogue : la variante publique porte aussi la puce du parcours (NdCataloguePublic). */
export function CarteFormation({ carte, variante }: { carte: CarteCatalogue; variante: "public" | "connecte" }) {
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
      tag={badgeDeCarte(carte)}
      parcoursTag={variante === "public" && parcours ? { tone: couleur as TagTone, label: parcours.nomCourt } : undefined}
      titleAs="h2"
    />
  );
}
