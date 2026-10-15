import { Suspense } from "react";
import type { Metadata } from "next";
import { PageAide } from "@/components/aide/PageAide";
import { SessionGuard } from "@/components/layout/SessionGuard";

export const metadata: Metadata = { title: "Aide · Étudium" };

/** Aide (NdAide, lot 5 étape A) : les questions fréquentes et celles sur les formules, une recherche, « Contacter l’équipe ». */
export default function Page() {
  return (
    <>
      <PageAide />
      <Suspense fallback={null}>
        <SessionGuard />
      </Suspense>
    </>
  );
}
