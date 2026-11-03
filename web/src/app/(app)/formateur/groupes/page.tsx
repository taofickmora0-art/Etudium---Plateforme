import { Suspense } from "react";
import type { Metadata } from "next";
import { PageGroupes } from "@/components/groupes/PageGroupes";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireSpace } from "@/lib/auth/require-space";

export const metadata: Metadata = { title: "Groupes · Espace formateur · Étudium" };

async function Contenu() {
  await requireSpace("formateur");
  return <PageGroupes espace="formateur" />;
}

/** Les groupes de discussion du formateur (restructuration R1 : il n'a plus l'espace étudiant) : ses parcours et ses formations. */
export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-96 max-w-[760px] rounded-carte" />}>
      <Contenu />
    </Suspense>
  );
}
