"use client";

import { useState } from "react";
import { Flag02Icon } from "@hugeicons/core-free-icons";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { signaler } from "@/lib/communaute/actions";
import { LIBELLES_MOTIFS, MOTIFS, PRECISIONS_MAX, refusSignalement } from "@/lib/moderation/regles";
import type { MotifSignalement } from "@/lib/moderation/types";

const ECHEC = "L’opération n’a pas abouti. Réessayez.";

/**
 * « Signaler cette publication », « Signaler ce commentaire » (design NdCommunaute ; spec de la modération, §4) ou
 * « Signaler ce message » (un message de groupe, 0075) : un motif, des précisions (obligatoires pour « Autre »), puis
 * « Signalement envoyé ».
 */
export function FenetreSignalement({
  cible,
  open,
  onOpenChange,
  envoi,
}: {
  cible: { publicationId: string } | { reponseId: string } | { messageGroupeId: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Un autre envoi que celui de la communauté (un commentaire de leçon, 0028 ; un message de groupe, 0075). */
  envoi?: (motif: MotifSignalement, precisions: string) => Promise<{ ok: true } | { ok: false; message: string }>;
}) {
  const { toast } = useToast();
  const [motif, setMotif] = useState<MotifSignalement>("inapproprie");
  const [precisions, setPrecisions] = useState("");
  const [erreur, setErreur] = useState<string>();
  const surUneReponse = "reponseId" in cible;
  const surUnMessage = "messageGroupeId" in cible;
  const champ = `precisions-${"reponseId" in cible ? cible.reponseId : "messageGroupeId" in cible ? cible.messageGroupeId : cible.publicationId}`;

  function changer(ouvert: boolean) {
    if (!ouvert) {
      setMotif("inapproprie");
      setPrecisions("");
      setErreur(undefined);
    }
    onOpenChange(ouvert);
  }

  async function envoyer() {
    const refus = refusSignalement(motif, precisions);
    const reponse = refus
      ? { ok: false as const, message: refus }
      : await (envoi ? envoi(motif, precisions) : "messageGroupeId" in cible ? Promise.resolve({ ok: false as const, message: ECHEC }) : signaler(cible, motif, precisions)).catch(() => ({
          ok: false as const,
          message: ECHEC,
        }));
    if (!reponse.ok) {
      setErreur(reponse.message);
      // La fenêtre reste ouverte et affiche le message.
      throw new Error(reponse.message);
    }
    toast({
      tone: "reussite",
      title: "Signalement envoyé",
      description: surUnMessage
        ? "Merci, le message a été signalé à la modération."
        : surUneReponse
          ? "Merci, le commentaire a été signalé à la modération."
          : "Merci, la publication a été signalée à la modération.",
    });
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={changer}
      icon={Flag02Icon}
      iconTone="attention"
      title={surUnMessage ? "Signaler ce message" : surUneReponse ? "Signaler ce commentaire" : "Signaler cette publication"}
      description="L’équipe Étudium examinera votre signalement. L’auteur ne saura pas qui l’a envoyé."
      confirmLabel="Envoyer le signalement"
      errorMessage={erreur}
      onConfirm={envoyer}
    >
      <div className="flex flex-col gap-3.5">
        <RadioGroup
          label="Motif du signalement"
          name={`motif-${champ}`}
          options={MOTIFS.map((m) => ({ value: m, label: LIBELLES_MOTIFS[m] }))}
          value={motif}
          onValueChange={(v) => setMotif(v as MotifSignalement)}
          className="gap-2.5"
        />
        <Field label="Précisions" htmlFor={champ}>
          <Textarea
            id={champ}
            rows={3}
            placeholder="Expliquez en quelques mots (facultatif)"
            maxLength={PRECISIONS_MAX}
            value={precisions}
            onChange={(e) => setPrecisions(e.target.value)}
          />
        </Field>
      </div>
    </ConfirmDialog>
  );
}
