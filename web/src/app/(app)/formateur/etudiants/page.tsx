import { Suspense } from "react";
import type { Metadata } from "next";
import { PageEtudiants } from "@/components/formateur/PageEtudiants";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireSpace } from "@/lib/auth/require-space";

export const metadata: Metadata = { title: "Étudiants · Espace formateur · Étudium" };

async function Contenu() {
  await requireSpace("formateur");
  return <PageEtudiants />;
}

/** Les étudiants du formateur (spec « Étudiants », §3) : réservée aux formateurs, rien n'est rendu avant la vérification. */
export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-60 max-w-[760px] rounded-carte" />}>
      <Contenu />
    </Suspense>
  );
}
