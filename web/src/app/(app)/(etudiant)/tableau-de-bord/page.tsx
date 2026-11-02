import { Suspense } from "react";
import type { Metadata } from "next";
import { BandeauAbonnement } from "@/components/abonnement/BandeauAbonnement";
import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { SessionGuard } from "@/components/layout/SessionGuard";
import { TableauDeBord } from "@/components/tableau-de-bord/TableauDeBord";
import { Skeleton } from "@/components/ui/Skeleton";
import { lireTableauDeBord } from "@/lib/tableau-de-bord/data";

export const metadata: Metadata = { title: "Tableau de bord · Étudium" };

async function Contenu() {
  let donnees;
  try {
    donnees = await lireTableauDeBord();
  } catch (erreur) {
    return siTablesAbsentes(erreur);
  }
  return (
    <TableauDeBord
      donnees={donnees}
      bandeau={
        <Suspense fallback={null}>
          <BandeauAbonnement />
        </Suspense>
      }
    />
  );
}

/** Le tableau de bord de l'étudiant (lot 6 B, §1 ; NdAccueil) : où il en est, quoi continuer, quoi faire, quoi apprendre. */
export default function Page() {
  return (
    <>
      <Suspense fallback={<Skeleton className="h-96 rounded-panneau" />}>
        <Contenu />
      </Suspense>
      <Suspense fallback={null}>
        <SessionGuard />
      </Suspense>
    </>
  );
}
