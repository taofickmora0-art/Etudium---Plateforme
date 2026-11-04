import { Suspense } from "react";
import type { Metadata } from "next";
import { UserGroupIcon } from "@hugeicons/core-free-icons";
import { SessionGuard } from "@/components/layout/SessionGuard";
import { VoletVide } from "@/components/ui/DeuxVolets";

export const metadata: Metadata = { title: "Groupes · Étudium" };

/** Les groupes de discussion (spec du 3 novembre 2026) : la liste est à gauche (mise en page commune) ; ici, le volet vide. */
export default function Page() {
  return (
    <>
      <VoletVide icon={UserGroupIcon} titre="Choisissez un groupe" description="Ouvrez un groupe à gauche pour lire la discussion et y écrire." />
      <Suspense fallback={null}>
        <SessionGuard />
      </Suspense>
    </>
  );
}
