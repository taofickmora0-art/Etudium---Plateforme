import { Suspense } from "react";
import type { Metadata } from "next";
import { PagePublication } from "@/components/communaute/PagePublication";
import { SessionGuard } from "@/components/layout/SessionGuard";
import { Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Publication · Communauté · Étudium" };

type Params = { params: Promise<{ id: string }> };

async function Publication({ params }: Params) {
  const { id } = await params;
  return <PagePublication id={id} />;
}

/** Une publication de la communauté et toutes ses réponses (spec de la communauté, §3). */
export default function Page({ params }: Params) {
  return (
    <>
      <Suspense fallback={<Skeleton className="h-60 max-w-[760px] rounded-carte" />}>
        <Publication params={params} />
      </Suspense>
      <Suspense fallback={null}>
        <SessionGuard />
      </Suspense>
    </>
  );
}
