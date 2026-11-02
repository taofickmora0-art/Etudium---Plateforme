import { Suspense } from "react";
import type { Metadata } from "next";
import { PageMessages } from "@/components/messages/PageMessages";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireDomaine } from "@/lib/auth/require-domaine";

export const metadata: Metadata = { title: "Messages · Back-office · Étudium" };

type Recherche = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function Contenu({ searchParams }: Recherche) {
  await requireDomaine("communaute");
  const { c } = await searchParams;
  return <PageMessages espace="equipe" base="/admin/messages" c={typeof c === "string" ? c : null} />;
}

/** L'assistance (lot 5, étape A) : les demandes des étudiants, auxquelles l'équipe répond au nom d'« Équipe Étudium ». */
export default function Page(props: Recherche) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-carte" />}>
      <Contenu {...props} />
    </Suspense>
  );
}
