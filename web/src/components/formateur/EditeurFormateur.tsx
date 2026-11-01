import { Suspense } from "react";
import { notFound } from "next/navigation";
import { FormationInfosForm } from "@/components/admin/FormationInfosForm";
import { FormationOnglets } from "@/components/admin/FormationOnglets";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { ongletHistorique } from "@/components/editeur/historique-serveur";
import { BoutonPublierModifications } from "@/components/editeur/FenetrePublication";
import { OngletApprenants } from "@/components/admin/OngletApprenants";
import { OngletLecons } from "@/components/admin/OngletLecons";
import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tag } from "@/components/ui/Tag";
import { getFormationAdmin, listParcours } from "@/lib/admin/data";
import { competencesAVendre } from "@/lib/catalogue/data";
import { ETATS, TON_ETAT } from "@/lib/contenus/etat";
import { estMaFormation } from "@/lib/formateur/data";
import { MES_FORMATIONS, RACINE_FORMATEUR } from "./cadre";
import { PublicationFormateur } from "./PublicationFormateur";

type Params = { params: Promise<{ id: string }>; searchParams: Promise<{ onglet?: string }> };

const ONGLETS = ["informations", "programme", "publication", "apprenants", "historique"];

/**
 * L'éditeur d'une formation, dans l'espace formateur (spec de l'espace formateur, §3) : celui du back-office, réglé pour
 * le formateur. Une formation qui n'est pas la sienne (même publiée, donc lisible) donne la page introuvable.
 */
export async function EditeurFormateur({ params, searchParams }: Params) {
  const [{ id }, { onglet }] = await Promise.all([params, searchParams]);
  if (!(await estMaFormation(id))) notFound();
  let donnees;
  try {
    donnees = await Promise.all([getFormationAdmin(id), listParcours(), competencesAVendre(id)]);
  } catch (erreur) {
    return siTablesAbsentes(erreur);
  }
  const [formation, parcours, { competences, liees }] = donnees;
  if (!formation) notFound();
  const historique = await ongletHistorique(formation.id);
  return (
    <PageAdmin
      titre={formation.titre}
      racine={RACINE_FORMATEUR}
      fil={[MES_FORMATIONS, { label: formation.titre }]}
      action={
        <span className="flex flex-wrap items-center gap-2">
          {formation.modificationsNonPubliees && <BoutonPublierModifications formationId={formation.id} />}
          <Tag tone={TON_ETAT[formation.etat]}>{ETATS[formation.etat]}</Tag>
        </span>
      }
    >
      <FormationOnglets
        ongletInitial={onglet && ONGLETS.includes(onglet) ? onglet : "informations"}
        informations={<FormationInfosForm formation={formation} parcours={parcours} formateurs={[]} espace="formateur" competences={competences} liees={liees} />}
        programme={<OngletLecons formation={formation} base="/formateur/formations" />}
        publication={<PublicationFormateur id={formation.id} formation={formation} version={historique.version} />}
        historique={historique.onglet}
        apprenants={
          <Suspense fallback={<Skeleton className="h-64 rounded-carte" />}>
            <OngletApprenants formationId={formation.id} espace="formateur" />
          </Suspense>
        }
      />
    </PageAdmin>
  );
}
