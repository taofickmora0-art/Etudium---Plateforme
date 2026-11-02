import { Suspense } from "react";
import type { Metadata } from "next";
import { PageFormulaireSession } from "@/components/sessions/PageSessionsEdition";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireDomaine } from "@/lib/auth/require-domaine";

export const metadata: Metadata = { title: "Modifier la session · Back-office · Étudium" };

type Params = { params: Promise<{ id: string }> };

async function Modifier({ params }: Params) {
  await requireDomaine("communaute");
  const { id } = await params;
  return <PageFormulaireSession espace="admin" id={id} />;
}

/** Modifier une session live (équipe). Rien n'est rendu avant la vérification du rôle. */
export default function Page({ params }: Params) {
  return (
    <Suspense fallback={<Skeleton className="h-60 max-w-[760px] rounded-carte" />}>
      <Modifier params={params} />
    </Suspense>
  );
}
