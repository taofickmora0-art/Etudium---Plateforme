import { Suspense } from "react";
import type { Metadata } from "next";
import { ContenuCommunaute } from "@/components/communaute/ContenuCommunaute";
import { SessionGuard } from "@/components/layout/SessionGuard";
import { Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Communauté · Étudium" };

/** Communauté (NdCommunaute ; spec du fil « Actualités ») : les Actualités, l'espace général et un espace par parcours ; `?espace=…` choisit l'onglet. */
export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <>
      <Suspense fallback={<Skeleton className="h-96 rounded-panneau" />}>
        <ContenuCommunaute searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={null}>
        <SessionGuard />
      </Suspense>
    </>
  );
}
