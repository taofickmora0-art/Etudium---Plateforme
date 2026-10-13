import { Suspense } from "react";
import type { Metadata } from "next";
import { FicheUtilisateur } from "@/components/admin/utilisateurs/FicheUtilisateur";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireSpace } from "@/lib/auth/require-space";

export const metadata: Metadata = { title: "Utilisateur · Back-office · Étudium" };

type Params = { params: Promise<{ id: string }> };

async function Fiche({ params }: Params) {
  const moi = await requireSpace("admin");
  return <FicheUtilisateur params={params} roles={moi.roles} />;
}

/** Fiche d'un compte (spec des utilisateurs, §3) : réservée à l'équipe, rien n'est rendu avant la vérification du rôle. */
export default function Page({ params }: Params) {
  return (
    <Suspense fallback={<Skeleton className="h-96 max-w-[680px] rounded-carte" />}>
      <Fiche params={params} />
    </Suspense>
  );
}
