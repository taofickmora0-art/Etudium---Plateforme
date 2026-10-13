import { Suspense } from "react";
import type { Metadata } from "next";
import { FicheEtudiant } from "@/components/formateur/FicheEtudiant";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireSpace } from "@/lib/auth/require-space";

export const metadata: Metadata = { title: "Étudiant · Espace formateur · Étudium" };

type Params = { params: Promise<{ id: string }> };

async function Contenu({ params }: Params) {
  await requireSpace("formateur");
  const { id } = await params;
  return <FicheEtudiant id={id} />;
}

/** La fiche d'un étudiant (spec « Étudiants », §3) : réservée aux formateurs, rien n'est rendu avant la vérification. */
export default function Page({ params }: Params) {
  return (
    <Suspense fallback={<Skeleton className="h-96 max-w-[760px] rounded-carte" />}>
      <Contenu params={params} />
    </Suspense>
  );
}
