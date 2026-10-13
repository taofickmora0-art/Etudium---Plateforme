"use client";

import { useId, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { reactiverCompte, suspendreCompte } from "@/lib/utilisateurs/actions";
import { MOTIF_MAX } from "@/lib/utilisateurs/regles";

export type FenetreSuspension = "suspendre" | "reactiver" | null;

type Props = {
  compte: { id: string; nomCourt: string };
  fenetre: FenetreSuspension;
  onFenetreChange: (fenetre: FenetreSuspension) => void;
  /** Après une suspension ou une réactivation réussie (la liste se relit). */
  onTermine?: () => void;
  /** L'élément qui reprend le focus à la fermeture (le bouton du menu de la ligne, dans la liste). */
  retourFocus?: () => HTMLElement | null;
};

/**
 * Les fenêtres « Suspendre ce compte ? » et « Réactiver ce compte ? » (design NdAdminSuspension), partagées par la liste
 * des comptes et la fiche d'un compte. Le motif est facultatif et visible de l'équipe seulement.
 */
export function FenetresSuspension({ compte, fenetre, onFenetreChange, onTermine, retourFocus }: Props) {
  const { toast } = useToast();
  const idMotif = useId();
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState<string | undefined>();

  const agir = async (action: () => Promise<{ ok: boolean; message?: string }>, title: string, description: string) => {
    const reponse = await action();
    if (!reponse.ok) {
      setErreur(reponse.message);
      throw new Error(reponse.message);
    }
    setMotif("");
    toast({ tone: "reussite", title, description });
    onTermine?.();
  };
  const ouvrir = (quoi: FenetreSuspension) => (ouvert: boolean) => {
    setErreur(undefined);
    onFenetreChange(ouvert ? quoi : null);
  };

  return (
    <>
      <ConfirmDialog
        open={fenetre === "suspendre"}
        onOpenChange={ouvrir("suspendre")}
        title="Suspendre ce compte ?"
        description={`${compte.nomCourt} ne pourra plus se connecter ni publier. Ses formations et ses certificats sont conservés, et vous pourrez réactiver le compte à tout moment.`}
        tone="danger"
        confirmLabel="Suspendre le compte"
        errorMessage={erreur}
        returnFocus={retourFocus}
        onConfirm={() =>
          agir(
            () => suspendreCompte(compte.id, motif),
            "Compte suspendu",
            `${compte.nomCourt} ne peut plus se connecter. Vous pourrez réactiver le compte à tout moment.`,
          )
        }
      >
        <Field label="Motif (visible par l’équipe)" htmlFor={idMotif}>
          <Textarea id={idMotif} value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={MOTIF_MAX} rows={3} />
        </Field>
      </ConfirmDialog>
      <ConfirmDialog
        open={fenetre === "reactiver"}
        onOpenChange={ouvrir("reactiver")}
        title="Réactiver ce compte ?"
        description={`${compte.nomCourt} retrouvera aussitôt tous ses accès.`}
        confirmLabel="Réactiver"
        errorMessage={erreur}
        returnFocus={retourFocus}
        onConfirm={() => agir(() => reactiverCompte(compte.id), "Compte réactivé", `${compte.nomCourt} peut de nouveau se connecter.`)}
      />
    </>
  );
}
