import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormationInfosForm } from "@/components/admin/FormationInfosForm";
import { FormationOnglets } from "@/components/admin/FormationOnglets";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { ongletHistorique } from "@/components/editeur/historique-serveur";
import { BoutonPublierModifications } from "@/components/editeur/FenetrePublication";
import { OngletApprenants } from "@/components/admin/OngletApprenants";
import { OngletLecons } from "@/components/admin/OngletLecons";
import { PublicationPanel } from "@/components/admin/PublicationPanel";
import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tag } from "@/components/ui/Tag";
import { getFormationAdmin, listFormateurs, listParcours } from "@/lib/admin/data";
import { competencesAVendre } from "@/lib/catalogue/data";
import { requireSpace } from "@/lib/auth/require-space";
import { ETATS, TON_ETAT } from "@/lib/contenus/etat";

export const metadata: Metadata = { title: "Formation · Back-office · Étudium" };

type Params = { params: Promise<{ id: string }>; searchParams: Promise<{ onglet?: string }> };

const ONGLETS = ["informations", "programme", "publication", "apprenants", "historique"];

async function FicheFormation({ params, searchParams }: Params) {
  await requireSpace("admin");
  const [{ id }, { onglet }] = await Promise.all([params, searchParams]);
  let donnees;
  try {
    donnees = await Promise.all([getFormationAdmin(id), listParcours(), listFormateurs(), competencesAVendre(id)]);
  } catch (erreur) {
    return siTablesAbsentes(erreur);
  }
  const [formation, parcours, formateurs, { competences, liees }] = donnees;
  if (!formation) notFound();
  const historique = await ongletHistorique(formation.id);
  return (
    <PageAdmin
      titre={formation.titre}
      fil={[{ label: "Formations", href: "/admin/formations" }, { label: formation.titre }]}
      action={
        <span className="flex flex-wrap items-center gap-2">
          {formation.modificationsNonPubliees && <BoutonPublierModifications formationId={formation.id} />}
          <Tag tone={TON_ETAT[formation.etat]}>{ETATS[formation.etat]}</Tag>
        </span>
      }
    >
      <FormationOnglets
        ongletInitial={onglet && ONGLETS.includes(onglet) ? onglet : "informations"}
        informations={<FormationInfosForm formation={formation} parcours={parcours} formateurs={formateurs} competences={competences} liees={liees} />}
        programme={<OngletLecons formation={formation} />}
        publication={
          <PublicationPanel
            id={formation.id}
            formation={formation}
            formateurNom={formateurs.find((f) => f.id === formation.formateurId)?.nom ?? null}
            version={historique.version}
          />
        }
        historique={historique.onglet}
        apprenants={
          <Suspense fallback={<Skeleton className="h-64 rounded-carte" />}>
            <OngletApprenants formationId={formation.id} espace="admin" />
          </Suspense>
        }
      />
    </PageAdmin>
  );
}

export default function Page({ params, searchParams }: Params) {
  return (
    <Suspense fallback={<Skeleton className="h-96 max-w-[680px] rounded-carte" />}>
      <FicheFormation params={params} searchParams={searchParams} />
    </Suspense>
  );
}
