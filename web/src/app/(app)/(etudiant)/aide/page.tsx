import { Suspense } from "react";
import type { Metadata } from "next";
import { PageAide } from "@/components/aide/PageAide";
import { SessionGuard } from "@/components/layout/SessionGuard";

export const metadata: Metadata = { title: "Aide · Étudium" };

/** Aide (lot 1) : les questions fréquentes, les mêmes que sur la landing. */
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
