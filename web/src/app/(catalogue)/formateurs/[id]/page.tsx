import { Suspense } from "react";
import type { Metadata } from "next";
import { PageProfilFormateur } from "@/components/formateurs/PageProfilFormateur";
import { Skeleton } from "@/components/ui/Skeleton";
import { lireFormateurPublic } from "@/lib/formateurs/data";
import { metadonneesFormateur } from "@/lib/formateurs/partage";

type Params = { params: Promise<{ id: string }> };

/** « Koffi Mensah · Formateur · Étudium », et sa présentation en description. */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  try {
    return metadonneesFormateur(await lireFormateurPublic(id));
  } catch {
    return metadonneesFormateur(null);
  }
}

/** Profil public d'un formateur (spec du 2 novembre 2026, §6) : dans le cadre du catalogue, pour un visiteur ou un compte connecté. */
export default function Page({ params }: Params) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-panneau" />}>
      <PageProfilFormateur params={params} />
    </Suspense>
  );
}
