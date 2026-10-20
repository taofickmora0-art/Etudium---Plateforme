import { Suspense } from "react";
import type { Metadata } from "next";
import { ContenuNotifications } from "@/components/notifications/ContenuNotifications";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireSpace } from "@/lib/auth/require-space";

export const metadata: Metadata = { title: "Notifications · Espace formateur · Étudium" };

async function Contenu() {
  await requireSpace("formateur");
  return <ContenuNotifications />;
}

/** Les notifications du formateur, dans son espace (restructuration R1). Le même écran que l'étudiant. */
export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-panneau" />}>
      <Contenu />
    </Suspense>
  );
}
