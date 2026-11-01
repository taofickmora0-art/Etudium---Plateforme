import { Suspense } from "react";
import type { Metadata } from "next";
import { BandeauAbonnement } from "@/components/abonnement/BandeauAbonnement";
import { ContenuCommunaute } from "@/components/communaute/ContenuCommunaute";
import { SessionGuard } from "@/components/layout/SessionGuard";
import { Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Accueil · Étudium" };

/**
 * L'Accueil (spec du nouvel Accueil) : le fil des dernières nouvelles de la communauté, les nouvelles formations et les
 * sessions live, puis « Formations disponibles » ; `?espace=…` choisit l'onglet.
 */
export default function AccueilPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <>
      {/* « Renouveler » (lot 2) : 7 jours avant la fin de l'abonnement, et après son expiration. */}
      <Suspense fallback={null}>
        <BandeauAbonnement />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-96 rounded-panneau" />}>
        <ContenuCommunaute searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={null}>
        <SessionGuard />
      </Suspense>
    </>
  );
}
