import { PageAdmin } from "@/components/admin/PageAdmin";
import { Banner } from "@/components/ui/Banner";
import { listParcours } from "@/lib/admin/data";
import { demoModeActive, getAuthUser } from "@/lib/auth/current-user";
import { lireAnnonceEquipe } from "@/lib/communaute/annonce";
import { FormulaireAnnonceCommunaute } from "./FormulaireAnnonceCommunaute";

const CADRE = {
  titre: "Annonce de la communauté",
  description: "Une vidéo ou une affiche épinglée en haut du fil « Actualités ».",
  fil: [{ label: "Annonce de la communauté" }],
};

/**
 * L'annonce épinglée de la communauté (design NdAdminAnnonceCommunaute ; spec du fil « Actualités », §2) : le réglage et
 * son aperçu dans le fil. La page vérifie le rôle avant (requireSpace) ; avant la migration 0021, un bandeau.
 */
export async function PageAnnonceCommunaute() {
  const [lecture, parcours, compte] = await Promise.all([lireAnnonceEquipe(), listParcours(), demoModeActive() ? null : getAuthUser()]);
  if (lecture.migrationAbsente) {
    return (
      <PageAdmin {...CADRE}>
        <Banner tone="attention" title="L’annonce de la communauté n’est pas encore dans la base.">
          Appliquez la migration 0021 (guide « Ce qui te revient », section 26).
        </Banner>
      </PageAdmin>
    );
  }
  return (
    <PageAdmin {...CADRE}>
      <FormulaireAnnonceCommunaute
        initial={lecture.donnees}
        parcours={parcours.filter((p) => p.actif || p.id === lecture.donnees.parcoursId).map((p) => ({ id: p.id, nom: p.nom }))}
        compteId={compte?.id ?? ""}
      />
    </PageAdmin>
  );
}
