import { Suspense } from "react";
import type { Metadata } from "next";
import { PageFormulaireSession } from "@/components/sessions/PageSessionsEdition";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireSpace } from "@/lib/auth/require-space";

export const metadata: Metadata = { title: "Nouvelle session · Espace formateur · Étudium" };

async function Nouvelle() {
  await requireSpace("formateur");
  return <PageFormulaireSession espace="formateur" />;
}

/** Programmer une session live (formateur). Rien n'est rendu avant la vérification du rôle. */
export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-60 max-w-[760px] rounded-carte" />}>
      <Nouvelle />
    </Suspense>
  );
}
