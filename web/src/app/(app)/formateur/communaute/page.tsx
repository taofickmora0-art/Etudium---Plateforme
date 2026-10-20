import { Suspense } from "react";
import type { Metadata } from "next";
import { ContenuCommunaute } from "@/components/communaute/ContenuCommunaute";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireSpace } from "@/lib/auth/require-space";

export const metadata: Metadata = { title: "Communauté · Espace formateur · Étudium" };

type Recherche = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function Contenu({ searchParams }: Recherche) {
  await requireSpace("formateur");
  return <ContenuCommunaute searchParams={searchParams} espace="formateur" />;
}

/**
 * La communauté dans l'espace formateur (restructuration R1 : il n'a plus l'espace étudiant) : le fil et ses espaces,
 * sans les formations ; `?espace=…` choisit l'onglet.
 */
export default function Page(props: Recherche) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-panneau" />}>
      <Contenu {...props} />
    </Suspense>
  );
}
