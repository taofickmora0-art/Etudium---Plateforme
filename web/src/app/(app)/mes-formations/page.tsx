import { Suspense } from "react";
import type { Metadata } from "next";
import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { SessionGuard } from "@/components/layout/SessionGuard";
import { versVueCarte } from "@/components/mes-formations/CarteSuivie";
import { MesFormations } from "@/components/mes-formations/MesFormations";
import { Skeleton } from "@/components/ui/Skeleton";
import { listFiches } from "@/lib/catalogue/data";
import { lireFavoris } from "@/lib/favoris/data";
import { formationsSuivies } from "@/lib/mes-formations/regles";
import { lireProgression } from "@/lib/progression/data";

export const metadata: Metadata = { title: "Mes formations · Étudium" };

async function Contenu() {
  let suivies;
  try {
    const [lignes, favoris] = await Promise.all([lireProgression(), lireFavoris()]);
    // Sans les tables de progression (0007, 0008), aucune formation n'est encore commencée.
    const ids = [...new Set((lignes ?? []).map((l) => l.formationId))];
    const fiches = await listFiches(ids);
    suivies = formationsSuivies(fiches, lignes ?? [], new Set((favoris ?? []).map((f) => f.formationId)));
  } catch (erreur) {
    return siTablesAbsentes(erreur);
  }
  return <MesFormations suivies={suivies.map(versVueCarte)} />;
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
