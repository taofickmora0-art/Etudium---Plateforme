import { Suspense } from "react";
import type { Metadata } from "next";
import { PageGroupe } from "@/components/groupes/PageGroupe";
import { SessionGuard } from "@/components/layout/SessionGuard";
import { Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Groupe · Étudium" };

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function Contenu({ params, searchParams }: Props) {
  const [{ slug }, { message }] = await Promise.all([params, searchParams]);
  return <PageGroupe espace="etudiant" slug={slug} message={typeof message === "string" ? message : null} />;
}

/** Un groupe de discussion, en direct ; `?message=…` (une notification de réponse) : la page s'y place. */
export default function Page(props: Props) {
  return (
    <>
      <Suspense fallback={<Skeleton className="m-4 flex-1 rounded-carte" />}>
        <Contenu {...props} />
      </Suspense>
      <Suspense fallback={null}>
        <SessionGuard />
      </Suspense>
    </>
  );
}
