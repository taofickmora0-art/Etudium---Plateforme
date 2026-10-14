import { Suspense } from "react";
import type { Metadata } from "next";
import { PageCatalogue } from "@/components/catalogue/PageCatalogue";
import { Skeleton } from "@/components/ui/Skeleton";
import { compteConnecte } from "@/lib/catalogue/visiteur";

export const metadata: Metadata = {
  title: "Toutes les formations · Étudium",
  description: "Réussite académique, compétences digitales et business en ligne. Chaque fiche propose un aperçu gratuit.",
};

type Recherche = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function Contenu({ searchParams }: Recherche) {
  const [compte, params] = await Promise.all([compteConnecte(), searchParams]);
  // Compte connecté : la page Formations, avec « Mes formations » au-dessus du catalogue (spec Formations et Événements, §2).
  return <PageCatalogue params={params} variante={compte ? "connecte" : "public"} chemin="/formations" avecMesFormations={compte !== null} />;
}

/** Catalogue (spec du lot 1, §2) : NdCataloguePublic pour un visiteur ; pour un compte connecté, la page Formations. */
export default function Page({ searchParams }: Recherche) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-panneau" />}>
      <Contenu searchParams={searchParams} />
    </Suspense>
  );
}
