import { Suspense } from "react";
import type { Metadata } from "next";
import { PageCorrections } from "@/components/corrections/PagesCorrections";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireSpace } from "@/lib/auth/require-space";

export const metadata: Metadata = { title: "Corrections · Espace formateur · Étudium" };

async function Contenu() {
  await requireSpace("formateur");
  return <PageCorrections espace="formateur" />;
}

/** Les travaux à corriger (lot 3, étape B) : réservée à l'espace, rien n'est rendu avant la vérification. */
export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-60 max-w-[960px] rounded-carte" />}>
      <Contenu />
    </Suspense>
  );
}
