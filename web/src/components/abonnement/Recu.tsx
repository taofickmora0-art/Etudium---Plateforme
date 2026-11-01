"use client";

import { PrinterIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Heading } from "@/components/ui/Text";
import type { Recu as DonneesRecu } from "@/lib/abonnement/data";
import { dateLongue, dureeAbonnement, libelleMoyen, montantFcfa } from "@/lib/abonnement/regles";

function Ligne({ libelle, valeur, forte = false }: { libelle: string; valeur: string; forte?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${forte ? "text-base font-semibold text-encre" : "text-sm text-texte"}`}>
      <dt>{libelle}</dt>
      <dd className="m-0 whitespace-nowrap">{valeur}</dd>
    </div>
  );
}

/**
 * Le reçu d'un paiement réussi (lot 2, spec §6 et choix 5) : une page imprimable ; « Imprimer ou enregistrer en PDF »
 * passe par le navigateur. Pas une facture fiscale.
 */
export function Recu({ recu }: { recu: DonneesRecu }) {
  const moyen = libelleMoyen(recu);
  return (
    <article className="mx-auto flex w-full max-w-[640px] flex-col gap-6 rounded-carte border border-bordure-carte p-8 max-sm:p-5 print:max-w-none print:border-0 print:p-0">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="m-0 text-[17px] font-bold text-bleu">Étudium</p>
          <Heading level="page" className="mt-3">
            Reçu de paiement
          </Heading>
        </div>
        <dl className="m-0 text-right text-sm leading-[22px] text-discret">
          <dt className="sr-only">Numéro</dt>
          <dd className="m-0 font-medium text-encre">{recu.numero}</dd>
          <dt className="sr-only">Date</dt>
          <dd className="m-0">{dateLongue(recu.date)}</dd>
        </dl>
      </header>

      <div className="flex flex-col gap-1 text-sm leading-[22px] text-texte">
        <p className="m-0">{`Compte : ${`${recu.compte.prenom} ${recu.compte.nom}`.trim()}`}</p>
        <p className="m-0 font-medium text-encre">{`Abonnement ${recu.formule.nom} · ${dureeAbonnement(recu.formule.dureeMois)}`}</p>
        {recu.debut && recu.fin && <p className="m-0">{`Du ${dateLongue(recu.debut)} au ${dateLongue(recu.fin)}`}</p>}
      </div>

      <dl className="m-0 flex flex-col gap-3 rounded-carte bg-page p-5 print:bg-transparent print:px-0">
        <Ligne libelle="Prix" valeur={montantFcfa(recu.prixInitial)} />
        {recu.remise > 0 && <Ligne libelle={recu.code ? `Remise (${recu.code})` : "Remise"} valeur={`− ${montantFcfa(recu.remise)}`} />}
        <div aria-hidden="true" className="h-px bg-filet" />
        <Ligne libelle="Montant payé" valeur={montantFcfa(recu.montant)} forte />
      </dl>

      <p className="m-0 text-sm leading-[22px] text-texte">
        {`Moyen : ${moyen}${recu.montant > 0 && recu.telephoneMasque ? ` · ${recu.telephoneMasque}` : ""}${recu.referenceManuelle ? ` · réf. ${recu.referenceManuelle}` : ""}`}
      </p>
      <p className="m-0 text-[13px] leading-5 text-discret">{recu.moyenManuel ? "Étudium · Paiement enregistré par l’équipe" : "Étudium · Paiement traité par Payiz"}</p>

      <div className="print:hidden">
        <Button variant="contour" onClick={() => window.print()}>
          <Icon icon={PrinterIcon} size={18} />
          Imprimer ou enregistrer en PDF
        </Button>
      </div>
    </article>
  );
}
