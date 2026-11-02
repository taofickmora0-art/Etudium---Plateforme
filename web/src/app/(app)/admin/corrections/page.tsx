import { Suspense } from "react";
import type { Metadata } from "next";
import { PageCorrections } from "@/components/corrections/PagesCorrections";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireDomaine } from "@/lib/auth/require-domaine";

export const metadata: Metadata = { title: "Corrections · Back-office · Étudium" };

async function Contenu() {
  await requireDomaine("contenus");
  return <PageCorrections espace="admin" />;
}

/** Les travaux à corriger (lot 3, étape B) : réservée à l'espace, rien n'est rendu avant la vérification. */
export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-60 rounded-carte" />}>
      <Contenu />
    </Suspense>
  );
}
