import { Suspense } from "react";
import type { Metadata } from "next";
import { ContenuFicheLivre } from "@/components/bibliotheque/ContenusBibliotheque";
import { Skeleton } from "@/components/ui/Skeleton";
import { lireFicheLivre } from "@/lib/bibliotheque/data";
import { metadonneesLivre } from "@/lib/bibliotheque/partage";

type Params = { params: Promise<{ slug: string }> };

/** Titre, description et couverture du lien partagé, comme pour la fiche d'une formation. */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  try {
    const fiche = await lireFicheLivre(slug);
    return metadonneesLivre(fiche === "absente" ? null : fiche);
  } catch {
    return metadonneesLivre(null);
  }
}

async function Fiche({ params }: Params) {
  return <ContenuFicheLivre slug={(await params).slug} />;
}

/** La fiche d'un livre (spec du 3 novembre 2026, §2) : ouverte à tous ; la lecture demande un compte qui a l'accès. */
export default function Page({ params }: Params) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-panneau" />}>
      <Fiche params={params} />
    </Suspense>
  );
}
