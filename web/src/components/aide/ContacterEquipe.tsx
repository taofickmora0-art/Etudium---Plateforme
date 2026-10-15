"use client";

import { useId, useState, type FormEvent } from "react";
import { SentIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { contacterEquipe } from "@/lib/messages/actions";
import { SUJETS_ASSISTANCE, type SujetAssistance } from "@/lib/messages/types";

const ECHEC = "Votre message n’a pas pu être envoyé. Réessayez.";

/**
 * « Contacter l’équipe » (NdAide) : un sujet et un message, qui partent dans la conversation d'assistance de l'étudiant
 * (« Équipe Étudium ») ; la réponse arrive dans ses messages.
 */
export function ContacterEquipe() {
  const id = useId();
  const { toast } = useToast();
  const [sujet, setSujet] = useState<SujetAssistance>(SUJETS_ASSISTANCE[0]);
  const [message, setMessage] = useState("");
  const [vide, setVide] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function envoyer(event: FormEvent) {
    event.preventDefault();
    if (envoi) return;
    setErreur(null);
    if (!message.trim()) return setVide(true);
    setVide(false);
    setEnvoi(true);
    const reponse = await contacterEquipe(sujet, message).catch(() => ({ ok: false as const, message: ECHEC }));
    setEnvoi(false);
    if (!reponse.ok) return setErreur(reponse.message);
    setMessage("");
    toast({ tone: "reussite", title: "Message envoyé", description: "La réponse arrivera dans vos messages." });
  }

  return (
    <section aria-labelledby={`${id}-titre`} className="box-border flex min-w-0 flex-col rounded-carte border border-bordure-carte bg-panneau p-5 max-sm:p-4">
      <form onSubmit={(e) => void envoyer(e)} noValidate className="flex min-w-0 flex-col gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 id={`${id}-titre`} className="m-0 text-base leading-6 font-semibold text-encre">
            Contacter l’équipe
          </h3>
          <p className="m-0 text-sm leading-[22px] text-pretty text-discret">Vous ne trouvez pas la réponse ? Écrivez-nous.</p>
        </div>
        <Field label="Sujet" htmlFor={`${id}-sujet`}>
          <Select
            id={`${id}-sujet`}
            value={sujet}
            onChange={(e) => setSujet(e.target.value as SujetAssistance)}
            options={SUJETS_ASSISTANCE.map((s) => ({ value: s, label: s }))}
          />
        </Field>
        <Field label="Message" htmlFor={`${id}-message`} error={vide ? "Écrivez votre message." : undefined}>
          <Textarea
            id={`${id}-message`}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              if (vide && e.target.value.trim()) setVide(false);
            }}
            rows={4}
            maxLength={3900}
            placeholder="Décrivez votre question en quelques lignes"
          />
        </Field>
        {erreur && (
          <p role="alert" className="m-0 text-[13px] leading-5 text-erreur-texte">
            {erreur}
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" iconLeft={SentIcon} loading={envoi}>
            Envoyer
          </Button>
        </div>
      </form>
    </section>
  );
}
