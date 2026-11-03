import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LivresRecommandes } from "@/components/admin/bibliotheque/LivresRecommandes";
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
import { getFormationAdmin, listFormateurs, listParcours, nombreSuiveurs } from "@/lib/admin/data";
import { competencesAVendre } from "@/lib/catalogue/data";
import { requireDomaine } from "@/lib/auth/require-domaine";
import { lireLivresRecommandes, listLivresPublies } from "@/lib/bibliotheque/data";
import { ETATS, TON_ETAT } from "@/lib/contenus/etat";

export const metadata: Metadata = { title: "Formation · Back-office · Étudium" };

type Params = { params: Promise<{ id: string }>; searchParams: Promise<{ onglet?: string }> };

const ONGLETS = ["informations", "programme", "publication", "apprenants", "historique"];

async function FicheFormation({ params, searchParams }: Params) {
  await requireDomaine("contenus");
  const [{ id }, { onglet }] = await Promise.all([params, searchParams]);
  let donnees;
  try {
    donnees = await Promise.all([getFormationAdmin(id), listParcours(), listFormateurs(), competencesAVendre(id)]);
  } catch (erreur) {
    return siTablesAbsentes(erreur, { equipe: true });
  }
  const [formation, parcours, formateurs, { competences, liees }] = donnees;
  if (!formation) notFound();
  const [historique, suiveurs, recommandes, publies] = await Promise.all([
    ongletHistorique(formation.id),
    formation.statut === "publiee" ? nombreSuiveurs(formation.id) : Promise.resolve(null),
    // Une carte annexe : si sa lecture échoue, elle n'est pas montrée, et la formation reste modifiable.
    lireLivresRecommandes(formation.id).catch(() => undefined),
    listLivresPublies().catch(() => []),
  ]);
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
        informations={
          <div className="flex flex-col gap-5">
            <FormationInfosForm formation={formation} parcours={parcours} formateurs={formateurs} competences={competences} liees={liees} />
            {/* « Pour aller plus loin » : les livres de la Bibliothèque recommandés aux apprenants (0074). */}
            {recommandes !== undefined && <LivresRecommandes formationId={formation.id} recommandes={recommandes} publies={publies} />}
          </div>
        }
        programme={<OngletLecons formation={formation} />}
        publication={
          <PublicationPanel
            id={formation.id}
            formation={formation}
            formateurNom={formateurs.find((f) => f.id === formation.formateurId)?.nom ?? null}
            version={historique.version}
            suiveurs={suiveurs}
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
