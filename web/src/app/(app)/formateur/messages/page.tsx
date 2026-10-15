import { Suspense } from "react";
import type { Metadata } from "next";
import { PageMessages } from "@/components/messages/PageMessages";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireSpace } from "@/lib/auth/require-space";

export const metadata: Metadata = { title: "Messages · Espace formateur · Étudium" };

type Recherche = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function Contenu({ searchParams }: Recherche) {
  await requireSpace("formateur");
  const { c } = await searchParams;
  return <PageMessages espace="formateur" base="/formateur/messages" c={typeof c === "string" ? c : null} />;
}

/** Les messages des étudiants (lot 5, étape A) : réservée à l'espace, rien n'est rendu avant la vérification. */
export default function Page(props: Recherche) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-carte" />}>
      <Contenu {...props} />
    </Suspense>
  );
}
