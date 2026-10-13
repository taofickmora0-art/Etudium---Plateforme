"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { Tag } from "@/components/ui/Tag";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { reactiverCompte, suspendreCompte } from "@/lib/utilisateurs/actions";
import { dateCourte, MOTIF_MAX } from "@/lib/utilisateurs/regles";
import type { CompteDetail } from "@/lib/utilisateurs/types";
import { Section } from "./Section";

type Props = {
  compte: CompteDetail;
  /** Ce que la personne connectée peut faire ici (droitsSurCompte) : sans droit, aucun bouton. */
  droits: { suspendre: boolean; reactiver: boolean };
};

/**
 * Suspension d'un compte (spec des utilisateurs, §3 et §4) : suspendre avec un motif facultatif (vu de l'équipe
 * seulement), puis réactiver. Un compte suspendu est déconnecté et n'a plus accès à rien ; ses données sont gardées.
 */
export function SuspensionCompte({ compte, droits }: Props) {
  const { toast } = useToast();
  const idMotif = useId();
  const [fenetre, setFenetre] = useState<"suspendre" | "reactiver" | null>(null);
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState<string | undefined>(undefined);
  const { suspension } = compte;

  const agir = async (action: () => Promise<{ ok: boolean; message?: string }>, reussite: string) => {
    const reponse = await action();
    if (!reponse.ok) {
      setErreur(reponse.message);
      throw new Error(reponse.message);
    }
    setMotif("");
    toast({ tone: "reussite", title: reussite });
  };

  return (
    <Section titre="Suspension">
      {suspension ? (
        <div className="flex flex-col items-start gap-2">
          <Tag tone="echoue">Suspendu</Tag>
          <p className="m-0 text-sm leading-[22px] text-texte">
            {`Suspendu depuis le ${dateCourte(suspension.depuis)}${suspension.parNom ? `, par ${suspension.parNom}` : ""}`}
          </p>
          {suspension.motif && <p className="m-0 text-sm leading-[22px] break-words text-discret">{suspension.motif}</p>}
        </div>
      ) : (
        <p className="m-0 text-sm leading-[22px] text-texte">Ce compte est actif.</p>
      )}
      {droits.suspendre && !suspension && (
        <div>
          <Button type="button" variant="dangerDoux" onClick={() => setFenetre("suspendre")}>
            Suspendre le compte
          </Button>
        </div>
      )}
      {droits.reactiver && suspension && (
        <div>
          <Button type="button" variant="contour" onClick={() => setFenetre("reactiver")}>
            Réactiver le compte
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={fenetre === "suspendre"}
        onOpenChange={(ouverte) => setFenetre(ouverte ? "suspendre" : null)}
        title="Suspendre ce compte ?"
        description="Il sera déconnecté et n’aura plus accès à rien. Ses données sont gardées ; vous pourrez le réactiver."
        tone="danger"
        confirmLabel="Suspendre"
        errorMessage={erreur}
        onConfirm={() => agir(() => suspendreCompte(compte.id, motif), "Compte suspendu.")}
      >
        <Field label="Motif (facultatif)" htmlFor={idMotif} hint="Visible de l’équipe seulement.">
          <Textarea id={idMotif} value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={MOTIF_MAX} rows={3} />
        </Field>
      </ConfirmDialog>
      <ConfirmDialog
        open={fenetre === "reactiver"}
        onOpenChange={(ouverte) => setFenetre(ouverte ? "reactiver" : null)}
        title="Réactiver ce compte ?"
        description="Il retrouvera aussitôt tous ses accès."
        confirmLabel="Réactiver"
        errorMessage={erreur}
        onConfirm={() => agir(() => reactiverCompte(compte.id), "Compte réactivé.")}
      />
    </Section>
  );
}
