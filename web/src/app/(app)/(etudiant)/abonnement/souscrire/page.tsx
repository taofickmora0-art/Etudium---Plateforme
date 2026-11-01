import { Suspense } from "react";
import type { Metadata } from "next";
import { Souscription } from "@/components/abonnement/Souscription";
import { SessionGuard } from "@/components/layout/SessionGuard";
import { Skeleton } from "@/components/ui/Skeleton";
import { lireAbonnement, lireFormules, paiementsOuverts } from "@/lib/abonnement/data";
import type { CodeFormule } from "@/lib/abonnement/types";

export const metadata: Metadata = { title: "S’abonner · Étudium" };

type Parametres = Promise<Record<string, string | string[] | undefined>>;

const CODES: CodeFormule[] = ["basique", "standard", "premium"];

async function Contenu({ searchParams }: { searchParams: Parametres }) {
  const [parametres, formules, abonnement, ouverts] = await Promise.all([searchParams, lireFormules(), lireAbonnement(), paiementsOuverts()]);
  const initiale = CODES.find((c) => c === parametres.formule) ?? null;
  return <Souscription formules={formules} abonnement={abonnement} ouverts={ouverts} initiale={initiale} maintenant={new Date().toISOString()} />;
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
