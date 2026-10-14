import { Suspense } from "react";
import type { Metadata } from "next";
import { PageAnnonceCommunaute } from "@/components/admin/communaute/PageAnnonceCommunaute";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireSpace } from "@/lib/auth/require-space";

export const metadata: Metadata = { title: "Annonce de la communauté · Back-office · Étudium" };

async function AnnonceCommunaute() {
  await requireSpace("admin");
  return <PageAnnonceCommunaute />;
}

/** L'annonce épinglée de la communauté (spec du fil « Actualités », §2) : réservée à l'équipe, rien n'est rendu avant la vérification du rôle. */
export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-96 max-w-[1100px] rounded-carte" />}>
      <AnnonceCommunaute />
    </Suspense>
  );
}
