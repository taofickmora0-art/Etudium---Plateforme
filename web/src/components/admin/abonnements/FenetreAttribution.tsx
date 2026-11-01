"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { ChoiceCards } from "@/components/ui/ChoiceCards";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import { attribuerAbonnement } from "@/lib/admin/paiements/actions";
import { dureeAbonnement, montantFcfa } from "@/lib/abonnement/regles";
import type { Formule, MoyenManuel } from "@/lib/abonnement/types";

const MOYENS: { value: MoyenManuel; title: string }[] = [
  { value: "mobile_money", title: "Mobile Money hors plateforme" },
  { value: "especes", title: "Espèces" },
  { value: "virement", title: "Virement" },
  { value: "offert", title: "Offert" },
];

const prixSaisi = (f: Formule | undefined) => (f?.prix == null ? "" : String(f.prix));

/**
 * Attribuer un abonnement à la main (0054) : un paiement reçu hors plateforme, ou un abonnement offert. L'accès s'ouvre
 * aussitôt, à la suite de l'abonnement en cours ; la personne reçoit une notification et un reçu.
 */
export function FenetreAttribution({ compte, formules, onFermer }: { compte: { id: string; nom: string }; formules: Formule[]; onFermer: () => void }) {
  const router = useRouter();
  const parDefaut = formules.find((f) => f.recommandee && f.prix !== null) ?? formules.find((f) => f.prix !== null) ?? formules[0];
  const [formuleId, setFormuleId] = useState(parDefaut?.id ?? "");
  const [moyen, setMoyen] = useState<MoyenManuel>("mobile_money");
  const [montant, setMontant] = useState(prixSaisi(parDefaut));
  const [reference, setReference] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  async function attribuer() {
    setOccupe(true);
    setErreur(null);
    const r = await attribuerAbonnement({ compteId: compte.id, formuleId, moyen, montant: moyen === "offert" ? "0" : montant, reference });
    setOccupe(false);
    if (!r.ok) return setErreur(r.message);
    onFermer();
    router.refresh();
  }

  return (
    <Dialog
      open
      onOpenChange={(ouverte) => !ouverte && onFermer()}
      title={`Attribuer un abonnement à ${compte.nom}`}
      description="L’accès s’ouvre aussitôt, à la suite de l’abonnement en cours s’il y en a un. La personne reçoit une notification et retrouve son reçu dans « Mon abonnement »."
      className="sm:max-w-[560px]"
      footer={
        <>
          <Button variant="contour" onClick={onFermer}>
            Annuler
          </Button>
          <Button loading={occupe} disabled={!formuleId} onClick={() => void attribuer()}>
            Attribuer
          </Button>
        </>
      }
    >
      <div className="mt-4 flex flex-col gap-4">
        {erreur && <Banner tone="erreur" title={erreur} />}
        <div className="flex flex-col gap-1.5">
          <p className="m-0 text-sm leading-5 font-medium text-encre">Abonnement</p>
          <ChoiceCards
            label="Abonnement"
            className="gap-2.5 sm:grid-cols-1"
            value={formuleId}
            onValueChange={(id) => {
              setFormuleId(id);
              setMontant(prixSaisi(formules.find((f) => f.id === id)));
            }}
            options={formules.map((f) => ({ value: f.id, title: f.nom, subtitle: dureeAbonnement(f.dureeMois), price: f.prix === null ? undefined : montantFcfa(f.prix) }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="m-0 text-sm leading-5 font-medium text-encre">Moyen de paiement</p>
          <ChoiceCards
            label="Moyen de paiement"
            className="gap-2.5 sm:grid-cols-2"
            value={moyen}
            onValueChange={(v) => setMoyen(MOYENS.find((m) => m.value === v)?.value ?? "mobile_money")}
            options={MOYENS}
          />
        </div>
        {moyen !== "offert" && (
          <Field label="Montant reçu (FCFA)" htmlFor="attribution-montant" hint="Le prix de l’abonnement, à corriger si la personne a payé un autre montant.">
            <TextInput id="attribution-montant" inputMode="numeric" value={montant} onChange={(e) => setMontant(e.target.value)} />
          </Field>
        )}
        <Field label="Référence (facultative)" htmlFor="attribution-reference" hint="L’identifiant de la transaction MTN ou Moov, ou une note.">
          <TextInput id="attribution-reference" maxLength={120} value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
