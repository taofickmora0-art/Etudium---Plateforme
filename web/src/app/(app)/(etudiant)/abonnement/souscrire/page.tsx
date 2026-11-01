import { Suspense } from "react";
import type { Metadata } from "next";
import { ContenuSouscription } from "@/components/abonnement/ContenuSouscription";
import { SessionGuard } from "@/components/layout/SessionGuard";
import { Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "S’abonner · Étudium" };

type Parametres = Promise<Record<string, string | string[] | undefined>>;

async function Contenu({ searchParams }: { searchParams: Parametres }) {
  const { formule } = await searchParams;
  return <ContenuSouscription formule={formule} />;
}

/** S'abonner ou prolonger (lot 2, spec §6) : `?formule=standard` choisit l'abonnement d'avance (page d'accueil, verrous). */
export default function Page({ searchParams }: { searchParams: Parametres }) {
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
