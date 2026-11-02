"use client";

import { useId, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { renvoyerAuFormateur } from "@/lib/admin/actions";

const REMARQUE_MAX = 1000;

type Props = {
  id: string;
  ouverte: boolean;
  onOuverteChange: (ouverte: boolean) => void;
  /** Après le renvoi réussi, une fois le message affiché (la liste des formations se relit). */
  apresReussite?: () => void;
  /** L'élément qui reprend le focus à la fermeture (le bouton ⋮ de la carte). */
  retourFocus?: () => HTMLElement | null;
};

/**
 * La fenêtre « Renvoyer au formateur » (spec de l'espace formateur, §4) : une formation en attente repart chez son
 * formateur avec une remarque obligatoire ; il la voit dans son espace, corrige et renvoie. Ouverte par le bouton de
 * l'onglet « Publication » ou par le menu ⋮ d'une carte (FenetresFormation).
 */
export function FenetreRenvoyerAuFormateur({ id, ouverte, onOuverteChange, apresReussite, retourFocus }: Props) {
  const { toast } = useToast();
  const champ = useId();
  const [remarque, setRemarque] = useState("");
  const [erreur, setErreur] = useState<string | undefined>();

  return (
    <ConfirmDialog
      open={ouverte}
      onOpenChange={(o) => {
        if (!o) setErreur(undefined);
        onOuverteChange(o);
      }}
      title="Renvoyer au formateur ?"
      description="La formation reste un brouillon. Le formateur voit votre remarque dans son espace, corrige, puis la renvoie en relecture."
      confirmLabel="Renvoyer"
      confirmDisabled={remarque.trim() === ""}
      errorMessage={erreur}
      returnFocus={retourFocus}
      onConfirm={async () => {
        const resultat = await renvoyerAuFormateur(id, remarque);
        if (!resultat.ok) {
          setErreur(resultat.message);
          throw new Error(resultat.message);
        }
        setRemarque("");
        toast({ tone: "reussite", title: "Formation renvoyée au formateur" });
        apresReussite?.();
      }}
    >
      <Field label="Remarque pour le formateur" htmlFor={champ} hint="Ce qu’il doit corriger avant la publication.">
        <Textarea id={champ} value={remarque} onChange={(e) => setRemarque(e.target.value)} rows={4} maxLength={REMARQUE_MAX} />
      </Field>
    </ConfirmDialog>
  );
}
