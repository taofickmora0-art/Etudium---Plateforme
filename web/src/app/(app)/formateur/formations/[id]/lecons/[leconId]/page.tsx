import { Suspense } from "react";
import type { Metadata } from "next";
import { LeconFormateur } from "@/components/formateur/LeconFormateur";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireSpace } from "@/lib/auth/require-space";

export const metadata: Metadata = { title: "Leçon · Espace formateur · Étudium" };

type Params = { params: Promise<{ id: string; leconId: string }> };

async function Contenu({ params }: Params) {
  await requireSpace("formateur");
  return <LeconFormateur params={params} />;
}

/** Une leçon d'une de ses formations : réservée aux formateurs, rien n'est rendu avant la vérification. */
export default function Page({ params }: Params) {
  return (
    <Suspense fallback={<Skeleton className="h-96 max-w-[680px] rounded-carte" />}>
      <Contenu params={params} />
    </Suspense>
  );
}
