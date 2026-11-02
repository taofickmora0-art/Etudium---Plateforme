import { Suspense } from "react";
import type { Metadata } from "next";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { ParcoursForm } from "@/components/admin/ParcoursForm";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireDomaine } from "@/lib/auth/require-domaine";

export const metadata: Metadata = { title: "Nouveau parcours · Back-office · Étudium" };

async function NouveauParcours() {
  await requireDomaine("contenus");
  return (
    <PageAdmin titre="Nouveau parcours" fil={[{ label: "Parcours", href: "/admin/parcours" }, { label: "Nouveau parcours" }]}>
      <ParcoursForm />
    </PageAdmin>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-96 max-w-[680px] rounded-carte" />}>
      <NouveauParcours />
    </Suspense>
  );
}
