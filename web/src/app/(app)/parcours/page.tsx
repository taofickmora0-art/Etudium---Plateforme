import { Suspense } from "react";
import type { Metadata } from "next";
import { SessionGuard } from "@/components/layout/SessionGuard";
import { PageMesParcours } from "@/components/parcours/PageMesParcours";
import { Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Mes parcours · Étudium" };

/** Mes parcours (NdParcours) : chaque parcours, son état et ses formations. */
export default function Page() {
  return (
    <>
      <Suspense fallback={<Skeleton className="h-96 rounded-panneau" />}>
        <PageMesParcours />
      </Suspense>
      <Suspense fallback={null}>
        <SessionGuard />
      </Suspense>
    </>
  );
}
