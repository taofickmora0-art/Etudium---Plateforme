import { Suspense } from "react";
import type { Metadata } from "next";
import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { cartesFavorites } from "@/components/favoris/cartes";
import { PageFavoris, type Favori } from "@/components/favoris/PageFavoris";
import { SessionGuard } from "@/components/layout/SessionGuard";
import { Skeleton } from "@/components/ui/Skeleton";
import { listFiches } from "@/lib/catalogue/data";
import { lireFavoris } from "@/lib/favoris/data";
import { lireProgression } from "@/lib/progression/data";

export const metadata: Metadata = { title: "Favoris · Étudium" };

async function Contenu() {
  let favoris: Favori[];
  try {
    const [lus, lignes] = await Promise.all([lireFavoris(), lireProgression()]);
    const ids = (lus ?? []).map((f) => f.formationId);
    favoris = cartesFavorites(ids, await listFiches(ids), lignes ?? []);
  } catch (erreur) {
    return siTablesAbsentes(erreur);
  }
  return <PageFavoris favoris={favoris} />;
}

/** Favoris (spec du lot 1, §8) : les formations mises de côté depuis leur fiche. */
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
