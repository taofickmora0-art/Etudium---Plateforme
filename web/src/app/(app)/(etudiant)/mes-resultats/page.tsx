import { Suspense } from "react";
import type { Metadata } from "next";
import { SessionGuard } from "@/components/layout/SessionGuard";
import { ListeParcours } from "@/components/resultats/ListeParcours";
import { PorteResultats } from "@/components/resultats/PorteResultats";
import { Skeleton } from "@/components/ui/Skeleton";
import { Heading, Lead } from "@/components/ui/Text";
import { lireParcoursComplets } from "@/lib/resultats/data";

export const metadata: Metadata = { title: "Mes résultats · Étudium" };

type Adresse = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function Liste({ pin }: { pin: boolean }) {
  return <ListeParcours parcours={await lireParcoursComplets()} pin={pin} />;
}

async function Contenu({ searchParams }: Adresse) {
  const { oubli } = await searchParams;
  return <PorteResultats oubli={oubli === "1"}>{(etat) => <Liste pin={etat.pin} />}</PorteResultats>;
}

/** « Mes résultats » (spec du 5 novembre 2026) : les parcours scolaires de l'étudiant, derrière son code s'il en a un. */
export default function Page({ searchParams }: Adresse) {
  return (
    <div className="flex max-w-[960px] min-w-0 flex-col gap-6">
      <div className="min-w-0">
        <Heading level="page">Mes résultats</Heading>
        <Lead className="mt-2.5">Tes notes, tes moyennes et tes crédits.</Lead>
      </div>
      <Suspense fallback={<Skeleton className="h-60 rounded-carte" />}>
        <Contenu searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={null}>
        <SessionGuard />
      </Suspense>
    </div>
  );
}
