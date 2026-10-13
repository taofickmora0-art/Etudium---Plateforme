"use client";

import { useId, useState } from "react";
import { StarIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { enregistrerAvis, supprimerAvis } from "@/lib/avis/actions";
import { COMMENTAIRE_MAX } from "@/lib/avis/regles";
import type { AvisPublic, Etoiles } from "@/lib/avis/types";
import { NoteEtoiles } from "./NoteEtoiles";

type Props = {
  formation: { id: string; titre: string };
  /** Son avis, pour le modifier ou le supprimer ; null pour en laisser un. */
  avis: AvisPublic | null;
};

/**
 * « Laisser un avis » / « Modifier mon avis » (non maquetté) : une fenêtre avec la note et un commentaire facultatif.
 * En modification, « Supprimer mon avis » passe par une confirmation. Un refus de la base s'affiche dans la fenêtre.
 */
export function BoutonAvis({ formation, avis }: Props) {
  const { toast } = useToast();
  const champ = useId();
  const [ouvert, setOuvert] = useState(false);
  const [suppression, setSuppression] = useState(false);
  const [note, setNote] = useState<Etoiles | null>(null);
  const [commentaire, setCommentaire] = useState("");
  const [message, setMessage] = useState<string>();

  const ouvrir = () => {
    setNote(avis?.note ?? null);
    setCommentaire(avis?.commentaire ?? "");
    setMessage(undefined);
    setOuvert(true);
  };

  return (
    <>
      <Button variant="contour" size="sm" iconLeft={StarIcon} onClick={ouvrir}>
        {avis ? "Modifier mon avis" : "Laisser un avis"}
      </Button>
      <ConfirmDialog
        open={ouvert}
        onOpenChange={setOuvert}
        title={`Votre avis sur ${formation.titre}`}
        description="Votre note et votre commentaire s’affichent sur la fiche, avec votre prénom et l’initiale de votre nom."
        icon={StarIcon}
        confirmLabel={avis ? "Enregistrer" : "Publier mon avis"}
        confirmDisabled={note === null}
        errorMessage={message}
        onConfirm={async () => {
          const reponse = await enregistrerAvis(formation.id, note ?? 0, commentaire);
          if (!reponse.ok) {
            setMessage(reponse.erreur);
            throw new Error(reponse.erreur);
          }
          toast({ tone: "reussite", title: avis ? "Votre avis est enregistré." : "Votre avis est publié." });
        }}
      >
        <NoteEtoiles valeur={note} onChange={setNote} />
        <Field label="Commentaire (facultatif)" htmlFor={champ} hint={`${commentaire.length} / 1 000`}>
          <Textarea id={champ} rows={4} maxLength={COMMENTAIRE_MAX} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
        </Field>
        {avis && (
          <div>
            <Button
              variant="dangerDoux"
              size="sm"
              onClick={() => {
                setOuvert(false);
                setMessage(undefined);
                setSuppression(true);
              }}
            >
              Supprimer mon avis
            </Button>
          </div>
        )}
      </ConfirmDialog>
      <ConfirmDialog
        open={suppression}
        onOpenChange={setSuppression}
        title="Supprimer votre avis ?"
        description="Votre note et votre commentaire seront retirés de la fiche."
        tone="danger"
        confirmLabel="Supprimer"
        errorMessage={message}
        onConfirm={async () => {
          const reponse = await supprimerAvis(formation.id);
          if (!reponse.ok) {
            setMessage(reponse.erreur);
            throw new Error(reponse.erreur);
          }
          toast({ tone: "reussite", title: "Votre avis est supprimé." });
        }}
      />
    </>
  );
}
