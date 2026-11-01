import { Suspense } from "react";
import type { Metadata } from "next";
import { SessionGuard } from "@/components/layout/SessionGuard";
import { PageMesParcours } from "@/components/parcours/PageMesParcours";
import { Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Parcours · Étudium" };

/** Parcours (NdParcours) : chaque parcours, son état et ses formations ; `?parcours=…` choisit l'onglet ouvert. */
export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <>
      <Suspense fallback={<Skeleton className="h-96 rounded-panneau" />}>
        <PageMesParcours searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={null}>
        <SessionGuard />
      </Suspense>
    </>
  );
}
