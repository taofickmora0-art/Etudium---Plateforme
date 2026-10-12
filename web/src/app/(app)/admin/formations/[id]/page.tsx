import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormationInfosForm } from "@/components/admin/FormationInfosForm";
import { FormationOnglets } from "@/components/admin/FormationOnglets";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { ProgrammeEditor } from "@/components/admin/ProgrammeEditor";
import { PublicationPanel } from "@/components/admin/PublicationPanel";
import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { TON_STATUT } from "@/components/admin/tons";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tag } from "@/components/ui/Tag";
import { getFormationAdmin, listFormateurs, listParcours } from "@/lib/admin/data";
import { requireSpace } from "@/lib/auth/require-space";
import { STATUTS } from "@/lib/contenus/libelles";

export const metadata: Metadata = { title: "Formation · Back-office · Étudium" };

type Params = { params: Promise<{ id: string }> };

async function FicheFormation({ params }: Params) {
  await requireSpace("admin");
  const { id } = await params;
  let donnees;
  try {
    donnees = await Promise.all([getFormationAdmin(id), listParcours(), listFormateurs()]);
  } catch (erreur) {
    return siTablesAbsentes(erreur);
  }
  const [formation, parcours, formateurs] = donnees;
  if (!formation) notFound();
  return (
    <PageAdmin
      titre={formation.titre}
      fil={[{ label: "Formations", href: "/admin/formations" }, { label: formation.titre }]}
      action={<Tag tone={TON_STATUT[formation.statut]}>{STATUTS[formation.statut]}</Tag>}
    >
      <FormationOnglets
        informations={<FormationInfosForm formation={formation} parcours={parcours} formateurs={formateurs} />}
        programme={<ProgrammeEditor formation={formation} />}
        publication={<PublicationPanel id={formation.id} statut={formation.statut} />}
      />
    </PageAdmin>
  );
}

export default function Page({ params }: Params) {
  return (
    <Suspense fallback={<Skeleton className="h-96 max-w-[680px] rounded-carte" />}>
      <FicheFormation params={params} />
    </Suspense>
  );
}
