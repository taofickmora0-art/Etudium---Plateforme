import { Suspense } from "react";
import type { Metadata } from "next";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { FormateurForm } from "@/components/admin/FormateurForm";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireSpace } from "@/lib/auth/require-space";

export const metadata: Metadata = { title: "Nouvelle fiche formateur · Back-office · Étudium" };

async function NouveauFormateur() {
  await requireSpace("admin");
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
