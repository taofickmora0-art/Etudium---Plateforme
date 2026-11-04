import { Suspense } from "react";
import type { Metadata } from "next";
import { PageGroupe } from "@/components/groupes/PageGroupe";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireSpace } from "@/lib/auth/require-space";

export const metadata: Metadata = { title: "Groupe · Espace formateur · Étudium" };

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function Contenu({ params, searchParams }: Props) {
  await requireSpace("formateur");
  const [{ slug }, { message }] = await Promise.all([params, searchParams]);
  return <PageGroupe espace="formateur" slug={slug} message={typeof message === "string" ? message : null} />;
}

/** Un groupe de discussion, dans l'espace formateur : réservé à l'espace, rien n'est rendu avant la vérification. */
export default function Page(props: Props) {
  return (
    <Suspense fallback={<Skeleton className="m-4 flex-1 rounded-carte" />}>
      <Contenu {...props} />
    </Suspense>
  );
}
