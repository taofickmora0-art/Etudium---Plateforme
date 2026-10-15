import { Suspense } from "react";
import type { Metadata } from "next";
import { SessionGuard } from "@/components/layout/SessionGuard";
import { PageMessages } from "@/components/messages/PageMessages";
import { Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Messages · Étudium" };

type Recherche = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function Contenu({ searchParams }: Recherche) {
  const { c } = await searchParams;
  return <PageMessages espace="etudiant" base="/messages" c={typeof c === "string" ? c : null} />;
}

/** Messages (lot 5, étape A ; NdMessages) : les formateurs des formations suivies et l'Équipe Étudium. */
export default function Page(props: Recherche) {
  return (
    <>
      <Suspense fallback={<Skeleton className="h-96 rounded-carte" />}>
        <Contenu {...props} />
      </Suspense>
      <Suspense fallback={null}>
        <SessionGuard />
      </Suspense>
    </>
  );
}
