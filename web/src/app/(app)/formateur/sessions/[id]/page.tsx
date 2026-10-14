import { Suspense } from "react";
import type { Metadata } from "next";
import { FicheSession } from "@/components/sessions/FicheSession";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireSpace } from "@/lib/auth/require-space";

export const metadata: Metadata = { title: "Session live · Espace formateur · Étudium" };

type Params = { params: Promise<{ id: string }> };

async function Fiche({ params }: Params) {
  await requireSpace("formateur");
  const { id } = await params;
  return <FicheSession espace="formateur" id={id} />;
}

/** La fiche d'une session du formateur : son lien et ses inscriptions. Rien n'est rendu avant la vérification du rôle. */
export default function Page({ params }: Params) {
  return (
    <Suspense fallback={<Skeleton className="h-60 max-w-[760px] rounded-carte" />}>
      <Fiche params={params} />
    </Suspense>
  );
}
