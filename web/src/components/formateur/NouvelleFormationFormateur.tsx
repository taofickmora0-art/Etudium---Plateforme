import { NouvelleFormationForm } from "@/components/admin/NouvelleFormationForm";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { lireMaFiche } from "@/lib/formateur/data";
import { MES_FORMATIONS, MigrationFormateurAbsente, RACINE_FORMATEUR, SansFiche } from "./cadre";

/** Nouvelle formation, dans l'espace formateur : un titre, puis l'éditeur (spec de l'espace formateur, §3). */
export async function NouvelleFormationFormateur() {
  const lecture = await lireMaFiche();
  return (
    <PageAdmin titre="Nouvelle formation" racine={RACINE_FORMATEUR} fil={[MES_FORMATIONS, { label: "Nouvelle formation" }]}>
      {lecture.migrationAbsente ? <MigrationFormateurAbsente /> : lecture.fiche ? <NouvelleFormationForm espace="formateur" /> : <SansFiche />}
    </PageAdmin>
  );
}
