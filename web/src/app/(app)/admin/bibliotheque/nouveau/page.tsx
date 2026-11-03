import { Suspense } from "react";
import type { Metadata } from "next";
import { BibliothequeAbsente } from "@/components/admin/bibliotheque/BibliothequeAbsente";
import { FormulaireLivre } from "@/components/admin/bibliotheque/FormulaireLivre";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { Skeleton } from "@/components/ui/Skeleton";
import { listParcours } from "@/lib/admin/data";
import type { ParcoursAdmin } from "@/lib/admin/types";
import { requireDomaine } from "@/lib/auth/require-domaine";
import { listCategoriesLivres } from "@/lib/bibliotheque/data";

export const metadata: Metadata = { title: "Ajouter un livre · Back-office · Étudium" };

const FIL = [{ label: "Bibliothèque", href: "/admin/bibliotheque" }, { label: "Ajouter un livre" }];

async function NouveauLivre() {
  await requireDomaine("contenus");
  let parcours: ParcoursAdmin[];
  try {
    parcours = await listParcours();
  } catch (erreur) {
    return siTablesAbsentes(erreur, { equipe: true });
  }
  const categories = await listCategoriesLivres();
  return (
    <PageAdmin titre="Ajouter un livre" description="Il naît en brouillon : publiez-le quand sa fiche est prête." fil={FIL}>
      {categories ? <FormulaireLivre livre={null} categories={categories} parcours={parcours} /> : <BibliothequeAbsente />}
    </PageAdmin>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-96 max-w-[680px] rounded-carte" />}>
      <NouveauLivre />
    </Suspense>
  );
}
