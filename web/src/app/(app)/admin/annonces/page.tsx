import { Suspense } from "react";
import type { Metadata } from "next";
import { PageAnnonces } from "@/components/admin/annonces/PageAnnonces";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireDomaine } from "@/lib/auth/require-domaine";

export const metadata: Metadata = { title: "Annonces · Back-office · Étudium" };

async function Annonces() {
  await requireDomaine("utilisateurs");
  return <PageAnnonces />;
}

/** Annonces (spec des notifications, §3) : réservée à l'équipe, rien n'est rendu avant la vérification du rôle. */
export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-60 max-w-[960px] rounded-carte" />}>
      <Annonces />
    </Suspense>
  );
}
