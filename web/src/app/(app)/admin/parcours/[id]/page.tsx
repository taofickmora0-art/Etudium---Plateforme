import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { FicheParcours } from "@/components/admin/parcours/FicheParcours";
import { ParcoursForm } from "@/components/admin/ParcoursForm";
import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { Banner } from "@/components/ui/Banner";
import { Skeleton } from "@/components/ui/Skeleton";
import { getParcours, lireFicheParcours, listParcours } from "@/lib/admin/data";
import type { FicheParcoursDonnees } from "@/lib/admin/parcours-chiffres";
import type { ParcoursAdmin } from "@/lib/admin/types";
import { requireDomaine } from "@/lib/auth/require-domaine";

export const metadata: Metadata = { title: "Parcours · Back-office · Étudium" };

type Params = { params: Promise<{ id: string }>; searchParams: Promise<{ onglet?: string }> };

/**
 * La fiche d'un parcours (demande du 2 novembre 2026) : vue d'ensemble, formations (ranger, changer de parcours,
 * ajouter), apprenants et réglages. Sans la 0066 : les réglages seuls, et un bandeau.
 */
async function FicheDuParcours({ params, searchParams }: Params) {
  await requireDomaine("contenus");
  const [{ id }, { onglet }] = await Promise.all([params, searchParams]);
  let parcours: ParcoursAdmin | null;
  let fiche: FicheParcoursDonnees | null;
  let tous: ParcoursAdmin[];
  try {
    [parcours, fiche, tous] = await Promise.all([getParcours(id), lireFicheParcours(id), listParcours()]);
  } catch (erreur) {
    return siTablesAbsentes(erreur, { equipe: true });
  }
  if (!parcours) notFound();
  return (
    <PageAdmin titre={parcours.nom} fil={[{ label: "Parcours", href: "/admin/parcours" }, { label: parcours.nom }]}>
      {fiche ? (
        <FicheParcours parcours={parcours} fiche={fiche} tousLesParcours={tous} ongletInitial={onglet} />
      ) : (
        <div className="flex max-w-[680px] flex-col gap-5">
          <Banner tone="attention" title="La fiche du parcours n’est pas encore disponible">
            Appliquez la migration 0066 (guide « Ce qui te revient », section 65) pour voir ses formations et ses apprenants.
          </Banner>
          <ParcoursForm parcours={parcours} />
        </div>
      )}
    </PageAdmin>
  );
}

export default function Page({ params, searchParams }: Params) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-carte" />}>
      <FicheDuParcours params={params} searchParams={searchParams} />
    </Suspense>
  );
}
