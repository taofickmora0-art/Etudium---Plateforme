import { Suspense } from "react";
import type { Metadata } from "next";
import { SessionGuard } from "@/components/layout/SessionGuard";
import { ContenuEvenements } from "@/components/sessions/ContenuEvenements";
import { Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Événements · Étudium" };

/** Événements (NdEvenements ; spec des sessions live, §4) : les sessions live, ouvertes à tout compte connecté. */
export default function Page() {
  return (
    <>
      <Suspense fallback={<Skeleton className="h-96 rounded-panneau" />}>
        <ContenuEvenements />
      </Suspense>
      <Suspense fallback={null}>
        <SessionGuard />
      </Suspense>
    </>
  );
}
