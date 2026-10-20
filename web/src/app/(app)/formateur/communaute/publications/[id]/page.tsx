import { Suspense } from "react";
import type { Metadata } from "next";
import { PagePublication } from "@/components/communaute/PagePublication";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireSpace } from "@/lib/auth/require-space";

export const metadata: Metadata = { title: "Publication · Communauté · Espace formateur · Étudium" };

type Params = { params: Promise<{ id: string }> };

async function Publication({ params }: Params) {
  await requireSpace("formateur");
  const { id } = await params;
  return <PagePublication id={id} espace="formateur" />;
}

/** Une publication de la communauté, dans l'espace formateur (restructuration R1). */
export default function Page({ params }: Params) {
  return (
    <Suspense fallback={<Skeleton className="h-60 max-w-[760px] rounded-carte" />}>
      <Publication params={params} />
    </Suspense>
  );
}
