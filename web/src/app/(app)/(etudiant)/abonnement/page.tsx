import { Suspense } from "react";
import type { Metadata } from "next";
import { ContenuAbonnement } from "@/components/abonnement/ContenuAbonnement";
import { SessionGuard } from "@/components/layout/SessionGuard";
import { Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Mon abonnement · Étudium" };

/** Mon abonnement (lot 2, spec §6) : l'état du compte, l'historique des paiements et leurs reçus. */
export default function Page() {
  return (
    <>
      <Suspense fallback={<Skeleton className="h-96 rounded-panneau" />}>
        <ContenuAbonnement />
      </Suspense>
      <Suspense fallback={null}>
        <SessionGuard />
      </Suspense>
    </>
  );
}
