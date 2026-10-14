import { Suspense } from "react";
import type { Metadata } from "next";
import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { SessionGuard } from "@/components/layout/SessionGuard";
import { MesFormations } from "@/components/mes-formations/MesFormations";
import { Skeleton } from "@/components/ui/Skeleton";
import { lireFormationsSuivies } from "@/lib/mes-formations/data";

export const metadata: Metadata = { title: "Mes formations · Étudium" };

async function Contenu() {
  let suivies;
  try {
    suivies = await lireFormationsSuivies();
  } catch (erreur) {
    return siTablesAbsentes(erreur);
  }
  return <MesFormations suivies={suivies} />;
}

/** Mes formations (spec du lot 1, §8) : les formations commencées, même archivées depuis (verrouillées). */
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
