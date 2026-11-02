import { Suspense } from "react";
import type { Metadata } from "next";
import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { SessionGuard } from "@/components/layout/SessionGuard";
import { PageRecherche } from "@/components/recherche/PageRecherche";
import { Skeleton } from "@/components/ui/Skeleton";
import { lireRecherche } from "@/lib/recherche/donnees";

export const metadata: Metadata = { title: "Recherche · Étudium" };

type Recherche = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function Contenu({ searchParams }: Recherche) {
  const brut = (await searchParams).q;
  // Une seule requête, 100 caractères au plus ; la recherche se fait en mémoire (rien n'atteint la base).
  const q = (Array.isArray(brut) ? brut[0] : (brut ?? "")).slice(0, 100);
  let donnees;
  try {
    donnees = await lireRecherche(q);
  } catch (erreur) {
    return siTablesAbsentes(erreur);
  }
  return <PageRecherche q={q} {...donnees} />;
}

/** Recherche (spec du lot 1, §8) : formations, parcours et leçons publiés, sans accents ni majuscules. */
export default function Page({ searchParams }: Recherche) {
  return (
    <>
      <Suspense fallback={<Skeleton className="h-96 rounded-panneau" />}>
        <Contenu searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={null}>
        <SessionGuard />
      </Suspense>
    </>
  );
}
