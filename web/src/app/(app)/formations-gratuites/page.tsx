import { Suspense } from "react";
import type { Metadata } from "next";
import { PageCatalogue } from "@/components/catalogue/PageCatalogue";
import { SessionGuard } from "@/components/layout/SessionGuard";
import { Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Formations gratuites · Étudium" };

type Recherche = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function Contenu({ searchParams }: Recherche) {
  return <PageCatalogue params={await searchParams} variante="connecte" chemin="/formations-gratuites" imposer={{ acces: "gratuites", parcours: "tous" }} />;
}

/** « Formations gratuites » du menu : le catalogue connecté, filtré sur les formations gratuites (spec du lot 1, §2). */
export default function Page({ searchParams }: Recherche) {
  return (
    <>
      <Suspense fallback={<Skeleton className="h-96 rounded-panneau" />}>
        <Contenu searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={null}>
        <SessionGuard />
      </Suspense>
    </>
  );
}
