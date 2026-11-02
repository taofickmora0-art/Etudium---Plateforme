import { CoeurFavori } from "@/components/favoris/CoeurFavori";
import { CatalogCard } from "@/components/ui/CatalogCard";
import type { TagTone } from "@/components/ui/Tag";
import { actionDeCarte, badgeDeCarte, dureeLisible, nombreDApprenants, parcoursPrincipal, programmeDeCarte } from "@/lib/catalogue/regles";
import type { CarteCatalogue } from "@/lib/catalogue/types";
import { libelleNiveau } from "@/lib/contenus/libelles";
import { urlCouverture } from "@/lib/couvertures/adresse";

/**
 * Carte d'une formation du catalogue, avec la puce de son parcours (NdCataloguePublic ; pour tous depuis la liste du 31
 * octobre 2026, tâche 15). Spec du 2 novembre 2026, §4 : programme et apprenants sous le titre, et en bas
 * « N % terminé » (compte inscrit) ou « Voir le cours », avec le cœur favori d'un compte connecté.
 * `sansEtiquette` : pas de badge, un bouton occupe le coin (cœur de la page Favoris).
 */
export function CarteFormation({
  carte,
  sansEtiquette = false,
  titleAs = "h2",
  apprenants,
  progression,
  favori,
}: {
  carte: CarteCatalogue;
  sansEtiquette?: boolean;
  /** h3 sous le titre d'une section (« Formations disponibles » de l'Accueil). */
  titleAs?: "h2" | "h3";
  /** Le nombre d'inscrits ; absent (sans la 0069) : non affiché. */
  apprenants?: number;
  /** Le pourcentage terminé si le compte est inscrit (même 0) ; absent : « Voir le cours ». */
  progression?: number;
  /** Favori ou non ; absent (visiteur, ou page qui a son propre cœur) : pas de cœur. */
  favori?: boolean;
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
      parcoursTag={parcours && !sansEtiquette ? { tone: couleur as TagTone, label: parcours.nomCourt } : undefined}
      titleAs={titleAs}
      programme={programmeDeCarte(carte)}
      apprenants={apprenants === undefined ? undefined : nombreDApprenants(apprenants)}
      action={actionDeCarte(progression)}
      coeur={favori === undefined ? undefined : <CoeurFavori formationId={carte.id} titre={carte.titre} favoriInitial={favori} />}
    />
  );
}
