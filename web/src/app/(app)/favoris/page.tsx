import { Suspense } from "react";
import type { Metadata } from "next";
import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { CarteFormation } from "@/components/catalogue/CarteFormation";
import { PageFavoris, type Favori } from "@/components/favoris/PageFavoris";
import { SessionGuard } from "@/components/layout/SessionGuard";
import { CarteSuivie, versVueCarte } from "@/components/mes-formations/CarteSuivie";
import { Skeleton } from "@/components/ui/Skeleton";
import { listFiches } from "@/lib/catalogue/data";
import { lireFavoris } from "@/lib/favoris/data";
import { formationsSuivies } from "@/lib/mes-formations/regles";
import { lireProgression } from "@/lib/progression/data";

export const metadata: Metadata = { title: "Favoris · Étudium" };

async function Contenu() {
  let favoris: Favori[];
  try {
    const [lus, lignes] = await Promise.all([lireFavoris(), lireProgression()]);
    const ids = (lus ?? []).map((f) => f.formationId);
    const fiches = await listFiches(ids);
    const suivies = formationsSuivies(fiches, lignes ?? [], new Set(ids));
    // Dans l'ordre des favoris (le plus récent d'abord). Une formation suivie montre sa progression ; une formation
    // archivée jamais commencée n'est plus visible (règles de la base) et disparaît de la liste.
    favoris = ids.flatMap((id): Favori[] => {
      const fiche = fiches.find((f) => f.id === id);
      if (!fiche) return [];
      const suivie = suivies.find((s) => s.fiche.id === id);
      if (suivie) return [{ id, titre: fiche.titre, carte: <CarteSuivie vue={versVueCarte(suivie)} /> }];
      if (fiche.statut !== "publiee") return [];
      return [{ id, titre: fiche.titre, carte: <CarteFormation carte={fiche} variante="connecte" /> }];
    });
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
