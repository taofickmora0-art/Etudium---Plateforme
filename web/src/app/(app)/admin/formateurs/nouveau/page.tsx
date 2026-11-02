import { Suspense } from "react";
import type { Metadata } from "next";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { FormateurForm } from "@/components/admin/FormateurForm";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireDomaine } from "@/lib/auth/require-domaine";

export const metadata: Metadata = { title: "Nouvelle fiche formateur · Back-office · Étudium" };

async function NouveauFormateur() {
  await requireDomaine("contenus");
  return (
    <PageAdmin titre="Nouvelle fiche formateur" fil={[{ label: "Formateurs", href: "/admin/formateurs" }, { label: "Nouvelle fiche formateur" }]}>
      <FormateurForm />
    </PageAdmin>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-96 max-w-[680px] rounded-carte" />}>
      <NouveauFormateur />
    </Suspense>
  );
}
