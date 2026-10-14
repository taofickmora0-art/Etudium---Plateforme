import { Banner } from "@/components/ui/Banner";
import { lireEtatModeration, lireFileModeration, lireNombreAExaminer } from "@/lib/moderation/data";
import { PageModeration } from "./PageModeration";

/** L'état de l'analyse et l'onglet « À examiner » ; avant la migration 0020, un bandeau. */
export async function ContenuModeration() {
  const [etat, file, nombre] = await Promise.all([lireEtatModeration(), lireFileModeration("a_examiner"), lireNombreAExaminer()]);
  if (etat.migrationAbsente || file.migrationAbsente) {
    return (
      <Banner tone="attention" title="La modération n’est pas encore dans la base.">
        Appliquez la migration 0020 (guide « Ce qui te revient », section 25).
      </Banner>
    );
  }
  return <PageModeration initial={file.donnees} nombre={nombre ?? file.donnees.length} etat={etat.donnees} maintenant={new Date().toISOString()} />;
}
