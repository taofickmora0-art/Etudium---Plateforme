import { Suspense } from "react";
import type { Metadata } from "next";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { PagePaiements } from "@/components/admin/paiements/PagePaiements";
import { Banner } from "@/components/ui/Banner";
import { Skeleton } from "@/components/ui/Skeleton";
import { lireFormules } from "@/lib/abonnement/data";
import { lireEtatEnvois } from "@/lib/admin/envois/data";
import { lireCodesParAbonnement, lireCodesPromo, lireEtatPaiements, lirePaiementsEquipe, lireResumePaiements } from "@/lib/admin/paiements/data";
import { requireDomaine } from "@/lib/auth/require-domaine";

export const metadata: Metadata = { title: "Abonnements et paiements · Back-office · Étudium" };

const TITRE = "Abonnements et paiements";
const DESCRIPTION = "Les prix des abonnements, les codes promo et les paiements Mobile Money.";

async function Paiements() {
  const moi = await requireDomaine("paiements");
  const resume = await lireResumePaiements();
  if (!resume) {
    return (
      <PageAdmin titre={TITRE} description={DESCRIPTION} fil={[{ label: TITRE }]}>
        <Banner tone="attention" title="Appliquez les migrations 0049 à 0052 (guide « Ce qui te revient », section 56)." />
      </PageAdmin>
    );
  }
  const [etat, formules, codes, codesParAbonnement, paiements, envois] = await Promise.all([
    lireEtatPaiements(),
    lireFormules(),
    lireCodesPromo(),
    lireCodesParAbonnement(),
    lirePaiementsEquipe({ statut: null, recherche: "", page: 1 }),
    lireEtatEnvois(),
  ]);
  // L'argent (prix, codes, activation, annulation) : administrateurs seulement ; la base le revérifie (0051).
  const ecriture = moi.roles.some((r) => r === "admin" || r === "super_admin");
  return (
    <PageAdmin titre={TITRE} description={DESCRIPTION} fil={[{ label: TITRE }]}>
      <PagePaiements
        resume={resume}
        etat={etat}
        formules={formules}
        codes={codes}
        codesParAbonnement={codesParAbonnement}
        paiements={paiements}
        envois={envois}
        ecriture={ecriture}
      />
    </PageAdmin>
  );
}

/** Abonnements et paiements (lot 2, spec §6) : réservé à l'équipe, rien n'est rendu avant la vérification du rôle. */
export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-60 max-w-[760px] rounded-carte" />}>
      <Paiements />
    </Suspense>
  );
}
