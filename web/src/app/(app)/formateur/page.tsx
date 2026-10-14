import { Suspense } from "react";
import type { Metadata } from "next";
import { TableauDeBordFormateur } from "@/components/formateur/TableauDeBordFormateur";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireSpace } from "@/lib/auth/require-space";

export const metadata: Metadata = { title: "Espace formateur · Étudium" };

async function Contenu() {
  await requireSpace("formateur");
  return <TableauDeBordFormateur />;
}

/** Tableau de bord du formateur (design NdFormateur) : réservé aux formateurs, rien n'est rendu avant la vérification. */
export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-60 max-w-[760px] rounded-carte" />}>
      <Contenu />
    </Suspense>
  );
}
