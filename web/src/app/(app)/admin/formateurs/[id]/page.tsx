import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { FormateurForm } from "@/components/admin/FormateurForm";
import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { Skeleton } from "@/components/ui/Skeleton";
import { getFormateur } from "@/lib/admin/data";
import type { FormateurAdmin } from "@/lib/admin/types";
import { requireSpace } from "@/lib/auth/require-space";

export const metadata: Metadata = { title: "Formateur · Back-office · Étudium" };

type Params = { params: Promise<{ id: string }> };

async function FicheFormateur({ params }: Params) {
  await requireSpace("admin");
  const { id } = await params;
  let formateur: FormateurAdmin | null;
  try {
    formateur = await getFormateur(id);
  } catch (erreur) {
    return siTablesAbsentes(erreur);
  }
  if (!formateur) notFound();
  return (
    <PageAdmin titre={formateur.nom} fil={[{ label: "Formateurs", href: "/admin/formateurs" }, { label: formateur.nom }]}>
      <FormateurForm formateur={formateur} />
    </PageAdmin>
  );
}

export default function Page({ params }: Params) {
  return (
    <Suspense fallback={<Skeleton className="h-96 max-w-[680px] rounded-carte" />}>
      <FicheFormateur params={params} />
    </Suspense>
  );
}
