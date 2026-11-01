"use client";

import { AlertCircleIcon, CheckmarkCircle02Icon, CreditCardIcon, UserMultipleIcon } from "@hugeicons/core-free-icons";
import { BoutonAttribuer } from "@/components/admin/abonnements/BoutonAttribuer";
import { GRILLE_CHIFFRES, Tuile } from "@/components/tableau/Blocs";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import type { CodePromo, EtatReglage, PagePaiements as Page, ResumePaiements } from "@/lib/admin/paiements/types";
import { montantFcfa } from "@/lib/abonnement/regles";
import type { Formule } from "@/lib/abonnement/types";
import { OngletCodesPromo } from "./OngletCodesPromo";
import { OngletFormules } from "./OngletFormules";
import { OngletPaiements } from "./OngletPaiements";
import { ReglagePaiements } from "./ReglagePaiements";

type Props = {
  resume: ResumePaiements;
  etat: EtatReglage;
  formules: Formule[];
  codes: CodePromo[];
  paiements: Page;
  /** Administrateur : prix, codes, activation, annulation. Un modérateur voit tout sans rien changer. */
  ecriture: boolean;
};

const chiffre = new Intl.NumberFormat("fr-FR");

/**
 * « Abonnements et paiements » au back-office (lot 2, spec §6 ; NdAdminPaiements, sans remboursement) : les chiffres
 * du mois, le réglage des paiements, puis les paiements, les prix des abonnements et les codes promo.
 */
export function PagePaiements({ resume, etat, formules, codes, paiements, ecriture }: Props) {
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className={GRILLE_CHIFFRES}>
        <Tuile icon={CreditCardIcon} tone="attention" label="Revenus du mois" value={montantFcfa(resume.revenusMois)} />
        <Tuile icon={CheckmarkCircle02Icon} tone="reussite" label="Paiements réussis" value={chiffre.format(resume.reussisMois)} hint="Ce mois" />
        <Tuile icon={AlertCircleIcon} label="Paiements échoués" value={chiffre.format(resume.echouesMois)} hint="Ce mois" />
        <Tuile icon={UserMultipleIcon} tone="information" label="Abonnés actifs" value={chiffre.format(resume.abonnesActifs)} />
      </div>
      {/* Un paiement reçu hors plateforme, ou un abonnement offert (0054) : administrateurs seulement. */}
      {ecriture && (
        <div className="flex justify-end">
          <BoutonAttribuer formules={formules} />
        </div>
      )}
      <ReglagePaiements etat={etat} ecriture={ecriture} />
      <SegmentedTabs
        label="Abonnements et paiements"
        items={[
          { value: "paiements", label: "Paiements", content: <OngletPaiements initial={paiements} ecriture={ecriture} /> },
          { value: "abonnements", label: "Abonnements", content: <OngletFormules formules={formules} ecriture={ecriture} /> },
          { value: "codes", label: "Codes promo", content: <OngletCodesPromo codes={codes} ecriture={ecriture} /> },
        ]}
      />
    </div>
  );
}
