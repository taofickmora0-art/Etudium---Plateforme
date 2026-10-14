import { Suspense } from "react";
import type { Metadata } from "next";
import { PageSessionsEdition } from "@/components/sessions/PageSessionsEdition";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireSpace } from "@/lib/auth/require-space";

export const metadata: Metadata = { title: "Sessions live · Espace formateur · Étudium" };

async function Sessions() {
  await requireSpace("formateur");
  return <PageSessionsEdition espace="formateur" />;
}

/** Sessions live de l'espace formateur (spec des sessions live, §4) : ses sessions, à venir et passées. Rien n'est rendu avant la vérification du rôle. */
export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-60 max-w-[760px] rounded-carte" />}>
      <Sessions />
    </Suspense>
  );
}
