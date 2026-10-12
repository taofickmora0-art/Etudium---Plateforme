import { Suspense } from "react";
import type { Metadata } from "next";
import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { SessionGuard } from "@/components/layout/SessionGuard";
import { MesParcours } from "@/components/parcours/MesParcours";
import { Skeleton } from "@/components/ui/Skeleton";
import { listCatalogue, listParcoursCatalogue } from "@/lib/catalogue/data";
import type { ProgressionFormation } from "@/lib/parcours/regles";

export const metadata: Metadata = { title: "Mes parcours · Étudium" };

async function Contenu() {
  let donnees;
  try {
    donnees = await Promise.all([listParcoursCatalogue(), listCatalogue()]);
  } catch (erreur) {
    return siTablesAbsentes(erreur);
  }
  const [parcours, cartes] = donnees;
  // La progression arrive avec la tâche 1.7 : d'ici là, tout est à 0 %.
  const progressions = new Map<string, ProgressionFormation>();
  return <MesParcours parcours={parcours} cartes={cartes} progressions={progressions} />;
}

/** Mes parcours (NdParcours) : chaque parcours, son état et ses formations. */
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
