import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { BibliothequeAbsente } from "@/components/admin/bibliotheque/BibliothequeAbsente";
import { GestionCategories } from "@/components/admin/bibliotheque/Categories";
import { estFiltreLivres, VueBibliotheque } from "@/components/admin/bibliotheque/VueBibliotheque";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireDomaine } from "@/lib/auth/require-domaine";
import { lireBibliothequeAdmin, listCategoriesLivres } from "@/lib/bibliotheque/data";

export const metadata: Metadata = { title: "Bibliothèque · Back-office · Étudium" };

type Recherche = { searchParams: Promise<{ etat?: string }> };

const FIL = [{ label: "Bibliothèque" }];

/**
 * La Bibliothèque numérique du back-office (spec du 3 novembre 2026, étape A) : les chiffres clés, le filtre par état,
 * une carte par livre avec son menu ⋮ ; « Catégories » et « Ajouter un livre » en haut. L'équipe des contenus seule.
 */
async function ListeLivres({ searchParams }: Recherche) {
  await requireDomaine("contenus");
  const { etat } = await searchParams;
  const [donnees, categories] = await Promise.all([lireBibliothequeAdmin(), listCategoriesLivres()]);
  if (!donnees || !categories) {
    return (
      <PageAdmin titre="Bibliothèque" fil={FIL}>
        <BibliothequeAbsente />
      </PageAdmin>
    );
  }
  return (
    <PageAdmin
      titre="Bibliothèque"
      description="Les livres numériques et documents de référence proposés aux étudiants."
      fil={FIL}
      action={
        <span className="flex flex-wrap items-center gap-2">
          <GestionCategories categories={categories} />
          <Button asChild>
            <Link href="/admin/bibliotheque/nouveau">Ajouter un livre</Link>
          </Button>
        </span>
      }
    >
      <VueBibliotheque donnees={donnees} filtreInitial={estFiltreLivres(etat) ? etat : "tous"} />
    </PageAdmin>
  );
}

export default function Page({ searchParams }: Recherche) {
  return (
    <Suspense fallback={<Skeleton className="h-60 rounded-carte" />}>
      <ListeLivres searchParams={searchParams} />
    </Suspense>
  );
}
