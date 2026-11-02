import { Suspense } from "react";
import type { Metadata } from "next";
import { FicheSession } from "@/components/sessions/FicheSession";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireDomaine } from "@/lib/auth/require-domaine";

export const metadata: Metadata = { title: "Session live · Back-office · Étudium" };

type Params = { params: Promise<{ id: string }> };

async function Fiche({ params }: Params) {
  await requireDomaine("communaute");
  const { id } = await params;
  return <FicheSession espace="admin" id={id} />;
}

/** La fiche d'une session : son lien et ses inscriptions. Rien n'est rendu avant la vérification du rôle. */
export default function Page({ params }: Params) {
  return (
    <Suspense fallback={<Skeleton className="h-60 max-w-[760px] rounded-carte" />}>
      <Fiche params={params} />
    </Suspense>
  );
}
