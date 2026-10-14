import { Suspense } from "react";
import type { Metadata } from "next";
import { PageSessionsEdition } from "@/components/sessions/PageSessionsEdition";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireSpace } from "@/lib/auth/require-space";

export const metadata: Metadata = { title: "Sessions live · Back-office · Étudium" };

async function Sessions() {
  await requireSpace("admin");
  return <PageSessionsEdition espace="admin" />;
}

/** Sessions live du back-office (spec des sessions live, §4) : toutes les sessions, réservées à l'équipe. Rien n'est rendu avant la vérification du rôle. */
export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-60 max-w-[760px] rounded-carte" />}>
      <Sessions />
    </Suspense>
  );
}
