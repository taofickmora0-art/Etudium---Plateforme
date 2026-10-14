import { Suspense } from "react";
import type { Metadata } from "next";
import { ContenuModeration } from "@/components/admin/moderation/ContenuModeration";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireSpace } from "@/lib/auth/require-space";

export const metadata: Metadata = { title: "Modération · Back-office · Étudium" };

async function Moderation() {
  await requireSpace("admin");
  return (
    <PageAdmin titre="Modération" description="Examinez les publications signalées par l’analyse automatique ou par les membres." fil={[{ label: "Modération" }]}>
      <ContenuModeration />
    </PageAdmin>
  );
}

/** La file de modération (spec de la modération, §5) : réservée à l'équipe, rien n'est rendu avant la vérification du rôle. */
export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-60 max-w-[760px] rounded-carte" />}>
      <Moderation />
    </Suspense>
  );
}
