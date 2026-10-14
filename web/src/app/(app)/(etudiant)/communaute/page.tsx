import { Suspense } from "react";
import type { Metadata } from "next";
import { ContenuCommunaute } from "@/components/communaute/ContenuCommunaute";
import { SessionGuard } from "@/components/layout/SessionGuard";
import { Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Communauté · Étudium" };

/** Communauté (NdCommunaute ; spec de la communauté, §3) : l'espace général et un espace par parcours. */
export default function Page() {
  return (
    <>
      <Suspense fallback={<Skeleton className="h-96 rounded-panneau" />}>
        <ContenuCommunaute />
      </Suspense>
      <Suspense fallback={null}>
        <SessionGuard />
      </Suspense>
    </>
  );
}
