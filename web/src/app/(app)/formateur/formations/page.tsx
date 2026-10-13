import { Suspense } from "react";
import type { Metadata } from "next";
import { MesFormations } from "@/components/formateur/MesFormations";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireSpace } from "@/lib/auth/require-space";

export const metadata: Metadata = { title: "Mes formations · Espace formateur · Étudium" };

async function Contenu() {
  await requireSpace("formateur");
  return <MesFormations />;
}

/** Mes formations (spec de l'espace formateur, §3) : réservée aux formateurs, rien n'est rendu avant la vérification. */
export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-60 max-w-[680px] rounded-carte" />}>
      <Contenu />
    </Suspense>
  );
}
