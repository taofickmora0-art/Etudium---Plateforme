"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { annulerSession } from "@/lib/sessions/actions";

const prevenus = (n: number) =>
  n === 0 ? "Aucune personne n’est inscrite." : n === 1 ? "La personne inscrite sera prévenue." : `Les ${n.toLocaleString("fr-FR")} personnes inscrites seront prévenues.`;

/** « Annuler la session » : ses inscrits sont prévenus ; elle ne se reprogramme pas. */
export function AnnulerSession({ id, inscriptions }: { id: string; inscriptions: number }) {
  const { toast } = useToast();
  const [ouverte, setOuverte] = useState(false);
  const [erreur, setErreur] = useState<string | undefined>();
  return (
    <div>
      <Button variant="dangerDoux" onClick={() => setOuverte(true)}>
        Annuler la session
      </Button>
      <ConfirmDialog
        open={ouverte}
        onOpenChange={(o) => {
          setErreur(undefined);
          setOuverte(o);
        }}
        title="Annuler cette session ?"
        description={`${prevenus(inscriptions)} Elle ne pourra pas être reprogrammée.`}
        confirmLabel="Annuler la session"
        cancelLabel="Garder la session"
        tone="danger"
        errorMessage={erreur}
        onConfirm={async () => {
          const reponse = await annulerSession(id);
          if (!reponse.ok) {
            setErreur(reponse.message);
            throw new Error(reponse.message);
          }
          toast({ tone: "reussite", title: "Session annulée", description: inscriptions > 0 ? "Les personnes inscrites sont prévenues." : undefined });
        }}
      />
    </div>
  );
}
