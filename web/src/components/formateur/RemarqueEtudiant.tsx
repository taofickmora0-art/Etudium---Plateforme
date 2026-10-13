"use client";

import { useId, useState, useTransition } from "react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { enregistrerRemarque } from "@/lib/formateur/actions";
import { REMARQUE_MAX } from "@/lib/formateur/regles-suivi";
import { dateCourte } from "@/lib/utilisateurs/regles";

type Props = {
  etudiantId: string;
  remarque: { texte: string; modifieeLe: string } | null;
};

/**
 * La remarque privée du formateur sur un étudiant (spec, §3) : lue par lui et par l'équipe, jamais par l'étudiant.
 * Vider le champ puis enregistrer supprime la remarque.
 */
export function RemarqueEtudiant({ etudiantId, remarque }: Props) {
  const { toast } = useToast();
  const id = useId();
  const [texte, setTexte] = useState(remarque?.texte ?? "");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, demarrer] = useTransition();

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        demarrer(async () => {
          const vide = texte.trim() === "";
          const reponse = await enregistrerRemarque(etudiantId, texte);
          if (!reponse.ok) {
            setErreur(reponse.message ?? "La remarque n’a pas pu être enregistrée. Réessayez.");
            return;
          }
          setErreur(null);
          toast({ tone: "reussite", title: vide ? "Remarque supprimée" : "Remarque enregistrée" });
        });
      }}
    >
      {erreur && <Banner tone="erreur" title={erreur} />}
      <Field label="Remarque privée" htmlFor={id} hint="Visible par vous et l’équipe Étudium. Jamais par l’étudiant.">
        <Textarea id={id} value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={REMARQUE_MAX} rows={4} />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] leading-5 text-discret">{remarque ? `Modifiée le ${dateCourte(remarque.modifieeLe)}` : ""}</span>
        <Button type="submit" loading={envoi}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
