import { Suspense } from "react";
import type { Metadata } from "next";
import { PageCorrection } from "@/components/corrections/PagesCorrections";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireSpace } from "@/lib/auth/require-space";

export const metadata: Metadata = { title: "Correction · Espace formateur · Étudium" };

type Params = { params: Promise<{ renduId: string }> };

async function Contenu({ params }: Params) {
  await requireSpace("formateur");
  const { renduId } = await params;
  return <PageCorrection espace="formateur" renduId={renduId} />;
}

/** La correction d'un travail (NdCorrection) : réservée à l'espace ; la base ne livre le travail qu'à ses correcteurs. */
export default function Page({ params }: Params) {
  return (
    <Suspense fallback={<Skeleton className="h-96 max-w-[960px] rounded-carte" />}>
      <Contenu params={params} />
    </Suspense>
  );
}
