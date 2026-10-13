"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { renvoyerAuFormateur } from "@/lib/admin/actions";

const REMARQUE_MAX = 1000;

/**
 * « Renvoyer au formateur » (spec de l'espace formateur, §4) : une formation en attente repart chez son formateur avec
 * une remarque obligatoire ; il la voit dans son espace, corrige et renvoie.
 */
export function RenvoyerAuFormateur({ id }: { id: string }) {
  const { toast } = useToast();
  const champ = useId();
  const [ouvert, setOuvert] = useState(false);
  const [remarque, setRemarque] = useState("");
  const [erreur, setErreur] = useState<string | undefined>();

  return (
    <>
      <Button
        variant="contour"
        onClick={() => {
          setErreur(undefined);
          setOuvert(true);
        }}
      >
        Renvoyer au formateur
      </Button>
      <ConfirmDialog
        open={ouvert}
        onOpenChange={setOuvert}
        title="Renvoyer au formateur ?"
        description="La formation reste un brouillon. Le formateur voit votre remarque dans son espace, corrige, puis la renvoie en relecture."
        confirmLabel="Renvoyer"
        confirmDisabled={remarque.trim() === ""}
        errorMessage={erreur}
        onConfirm={async () => {
          const resultat = await renvoyerAuFormateur(id, remarque);
          if (!resultat.ok) {
            setErreur(resultat.message);
            throw new Error(resultat.message);
          }
          setRemarque("");
          toast({ tone: "reussite", title: "Formation renvoyée au formateur" });
        }}
      >
        <Field label="Remarque pour le formateur" htmlFor={champ} hint="Ce qu’il doit corriger avant la publication.">
          <Textarea id={champ} value={remarque} onChange={(e) => setRemarque(e.target.value)} rows={4} maxLength={REMARQUE_MAX} />
        </Field>
      </ConfirmDialog>
    </>
  );
}
