import { Suspense } from "react";
import type { Metadata } from "next";
import { PageFormulaireSession } from "@/components/sessions/PageSessionsEdition";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireSpace } from "@/lib/auth/require-space";

export const metadata: Metadata = { title: "Modifier la session · Espace formateur · Étudium" };

type Params = { params: Promise<{ id: string }> };

async function Modifier({ params }: Params) {
  await requireSpace("formateur");
  const { id } = await params;
  return <PageFormulaireSession espace="formateur" id={id} />;
}

/** Modifier une session du formateur. Rien n'est rendu avant la vérification du rôle. */
export default function Page({ params }: Params) {
  return (
    <Suspense fallback={<Skeleton className="h-60 max-w-[760px] rounded-carte" />}>
      <Modifier params={params} />
    </Suspense>
  );
}
