import { Suspense } from "react";
import type { Metadata } from "next";
import { EditeurFormateur } from "@/components/formateur/EditeurFormateur";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireSpace } from "@/lib/auth/require-space";

export const metadata: Metadata = { title: "Formation · Espace formateur · Étudium" };

type Params = { params: Promise<{ id: string }>; searchParams: Promise<{ onglet?: string }> };

async function Contenu({ params, searchParams }: Params) {
  await requireSpace("formateur");
  return <EditeurFormateur params={params} searchParams={searchParams} />;
}

/** L'éditeur d'une de ses formations (spec de l'espace formateur, §3) : réservé aux formateurs. */
export default function Page({ params, searchParams }: Params) {
  return (
    <Suspense fallback={<Skeleton className="h-96 max-w-[680px] rounded-carte" />}>
      <Contenu params={params} searchParams={searchParams} />
    </Suspense>
  );
}
