import { Suspense } from "react";
import type { Metadata } from "next";
import { PageGroupes } from "@/components/groupes/PageGroupes";
import { SessionGuard } from "@/components/layout/SessionGuard";
import { Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Groupes · Étudium" };

/** Les groupes de discussion (spec du 3 novembre 2026) : le Général, ceux de mes parcours et de mes formations. */
export default function Page() {
  return (
    <>
      <Suspense fallback={<Skeleton className="h-96 max-w-[760px] rounded-carte" />}>
        <PageGroupes espace="etudiant" />
      </Suspense>
      <Suspense fallback={null}>
        <SessionGuard />
      </Suspense>
    </>
  );
}
