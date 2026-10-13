import { Suspense } from "react";
import type { Metadata } from "next";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { TableauDeBordAdmin } from "@/components/admin/TableauDeBordAdmin";
import { Skeleton } from "@/components/ui/Skeleton";
import { lireStatistiques } from "@/lib/admin/statistiques";
import { requireSpace } from "@/lib/auth/require-space";

export const metadata: Metadata = { title: "Back-office · Étudium" };

async function AccueilAdmin() {
  await requireSpace("admin");
  return (
    <PageAdmin titre="Tableau de bord" description="Vue d’ensemble de la plateforme : inscriptions, apprentissage et, à partir du lot 2, revenus.">
      <TableauDeBordAdmin stats={await lireStatistiques()} />
    </PageAdmin>
  );
}

/** Accueil du back-office (spec du lot 1, §10) : réservé à l'équipe, rien n'est rendu avant la vérification du rôle. */
export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-60 max-w-[680px] rounded-carte" />}>
      <AccueilAdmin />
    </Suspense>
  );
}
