import { Suspense } from "react";
import type { Metadata } from "next";
import { ContenuBibliotheque } from "@/components/bibliotheque/ContenusBibliotheque";
import { Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = {
  title: "Bibliothèque · Étudium",
  description: "Guides, manuels et méthodes pour aller plus loin que les formations, à lire dans le site.",
  alternates: { canonical: "/bibliotheque" },
};

type Recherche = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function Contenu({ searchParams }: Recherche) {
  return <ContenuBibliotheque params={await searchParams} />;
}

/** La Bibliothèque (spec du 3 novembre 2026, §2) : ouverte à tous, dans le cadre public ou dans la coque de l'appli. */
export default function Page({ searchParams }: Recherche) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-panneau" />}>
      <Contenu searchParams={searchParams} />
    </Suspense>
  );
}
