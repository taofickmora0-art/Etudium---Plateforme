import { Suspense } from "react";
import type { Metadata } from "next";
import { NouvelleFormationForm } from "@/components/admin/NouvelleFormationForm";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireDomaine } from "@/lib/auth/require-domaine";

export const metadata: Metadata = { title: "Nouvelle formation · Back-office · Étudium" };

async function NouvelleFormation() {
  await requireDomaine("contenus");
  return (
    <PageAdmin titre="Nouvelle formation" fil={[{ label: "Formations", href: "/admin/formations" }, { label: "Nouvelle formation" }]}>
      <NouvelleFormationForm />
    </PageAdmin>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-48 max-w-[680px] rounded-carte" />}>
      <NouvelleFormation />
    </Suspense>
  );
}
