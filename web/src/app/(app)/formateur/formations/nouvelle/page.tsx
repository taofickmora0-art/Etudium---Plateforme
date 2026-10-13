import { Suspense } from "react";
import type { Metadata } from "next";
import { NouvelleFormationFormateur } from "@/components/formateur/NouvelleFormationFormateur";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireSpace } from "@/lib/auth/require-space";

export const metadata: Metadata = { title: "Nouvelle formation · Espace formateur · Étudium" };

async function Contenu() {
  await requireSpace("formateur");
  return <NouvelleFormationFormateur />;
}

/** Nouvelle formation dans l'espace formateur : réservée aux formateurs, rien n'est rendu avant la vérification. */
export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-40 max-w-[680px] rounded-carte" />}>
      <Contenu />
    </Suspense>
  );
}
