import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { ParcoursForm } from "@/components/admin/ParcoursForm";
import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { Skeleton } from "@/components/ui/Skeleton";
import { getParcours } from "@/lib/admin/data";
import type { ParcoursAdmin } from "@/lib/admin/types";
import { requireDomaine } from "@/lib/auth/require-domaine";

export const metadata: Metadata = { title: "Parcours · Back-office · Étudium" };

type Params = { params: Promise<{ id: string }> };

async function FicheParcours({ params }: Params) {
  await requireDomaine("contenus");
  const { id } = await params;
  let parcours: ParcoursAdmin | null;
  try {
    parcours = await getParcours(id);
  } catch (erreur) {
    return siTablesAbsentes(erreur);
  }
  if (!parcours) notFound();
  return (
    <PageAdmin titre={parcours.nom} fil={[{ label: "Parcours", href: "/admin/parcours" }, { label: parcours.nom }]}>
      <ParcoursForm parcours={parcours} />
    </PageAdmin>
  );
}

export default function Page({ params }: Params) {
  return (
    <Suspense fallback={<Skeleton className="h-96 max-w-[680px] rounded-carte" />}>
      <FicheParcours params={params} />
    </Suspense>
  );
}
