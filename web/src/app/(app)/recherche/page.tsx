import { Suspense } from "react";
import type { Metadata } from "next";
import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { SessionGuard } from "@/components/layout/SessionGuard";
import { versVueCarte, type VueCarteSuivie } from "@/components/mes-formations/CarteSuivie";
import { PageRecherche } from "@/components/recherche/PageRecherche";
import { Skeleton } from "@/components/ui/Skeleton";
import { listCatalogue, listFiches, listParcoursCatalogue } from "@/lib/catalogue/data";
import { formationsSuivies } from "@/lib/mes-formations/regles";
import { lireProgression } from "@/lib/progression/data";
import { listLeconsPubliees } from "@/lib/recherche/data";
import { recommandations, rechercher } from "@/lib/recherche/regles";

export const metadata: Metadata = { title: "Recherche · Étudium" };

type Recherche = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function Contenu({ searchParams }: Recherche) {
  const brut = (await searchParams).q;
  // Une seule requête, 100 caractères au plus ; la recherche se fait en mémoire (rien n'atteint la base).
  const q = (Array.isArray(brut) ? brut[0] : (brut ?? "")).slice(0, 100);
  let donnees;
  try {
    const [cartes, parcours, lecons, lignes] = await Promise.all([
      listCatalogue(),
      listParcoursCatalogue(),
      q.trim() ? listLeconsPubliees() : [],
      lireProgression(),
    ]);
    const commencees = new Set((lignes ?? []).map((l) => l.formationId));
    const resultats = q.trim() ? rechercher({ cartes, parcours, lecons }, q) : null;
    // Les formations trouvées et déjà commencées montrent leur progression.
    const ids = (resultats?.formations ?? []).map((c) => c.id).filter((id) => commencees.has(id));
    const suivies = new Map<string, VueCarteSuivie>(
      formationsSuivies(await listFiches(ids), lignes ?? [], new Set()).map((s) => [s.fiche.id, versVueCarte(s)]),
    );
    const terminees = new Set((lignes ?? []).filter((l) => l.termineeLe).map((l) => l.leconId));
    donnees = { cartes, resultats, suivies, terminees, recommandees: recommandations(cartes, commencees) };
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
