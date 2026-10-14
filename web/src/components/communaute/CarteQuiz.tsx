"use client";

import { useId, useState } from "react";
import { CancelCircleIcon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { pourcentage } from "@/lib/communaute/sondage";
import type { Sondage } from "@/lib/communaute/types";
import { PiedSondage, pluriel, Refus, useVote, VOTE_A_VENIR } from "./CarteSondage";

/**
 * Le quiz d'une publication (spec sondages, quiz et programmation, §4) : on choisit une réponse, « Valider », et c'est
 * définitif. Ensuite la bonne réponse en vert, la mienne en rouge si elle est fausse, l'explication et la part de chaque
 * réponse. La base n'envoie la bonne réponse qu'après avoir répondu (ou à l'auteur et à l'équipe).
 */
export function CarteQuiz({
  publicationId,
  sondage: s,
  ouvert,
  onChange,
}: {
  publicationId: string;
  sondage: Sondage;
  /** La publication est en ligne : on peut répondre. */
  ouvert: boolean;
  onChange: (sondage: Sondage) => void;
}) {
  const nom = useId();
  const [choix, setChoix] = useState<string | null>(null);
  const { envoi, erreur, envoyer } = useVote(publicationId, s, onChange);

  if (s.votants === null) {
    return (
      <section aria-label="Quiz" className="mt-3.5 flex min-w-0 flex-col">
        <fieldset disabled={!ouvert || envoi} className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
          <legend className="sr-only">Votre réponse</legend>
          {s.options.map((o) => (
            <label
              key={o.id}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-[12px] border px-3.5 py-2.5 text-sm leading-5 text-encre has-disabled:cursor-default",
                choix === o.id ? "border-bleu bg-bleu-clair" : "border-bordure-champ hover:border-bleu-bord",
              )}
            >
              <input type="radio" name={nom} checked={choix === o.id} onChange={() => setChoix(o.id)} className="size-[18px] flex-none accent-[var(--color-bleu)]" />
              <span className="min-w-0 flex-1 wrap-anywhere">{o.texte}</span>
            </label>
          ))}
        </fieldset>
        <PiedSondage texte="Une seule réponse, définitive.">
          {ouvert && (
            <Button size="sm" loading={envoi} disabled={choix === null} onClick={() => choix && void envoyer([choix])}>
              Valider
            </Button>
          )}
        </PiedSondage>
        {!ouvert && <p className="m-0 mt-1.5 text-[13px] leading-5 text-discret">{VOTE_A_VENIR}</p>}
        <Refus erreur={erreur} />
      </section>
    );
  }

  const juste = s.options.some((o) => o.moi && o.correcte === true);
  return (
    <section aria-label="Quiz" className="mt-3.5 flex min-w-0 flex-col">
      <ul aria-label="Résultats du quiz" className="m-0 flex list-none flex-col gap-2 p-0">
        {s.options.map((o) => {
          const pct = pourcentage(o.votes ?? 0, s.votants ?? 0);
          const bonne = o.correcte === true;
          const fausse = o.moi && !bonne;
          return (
            <li
              key={o.id}
              className={cn(
                "relative min-w-0 overflow-hidden rounded-[12px] border",
                bonne ? "border-reussite-texte/40 bg-reussite-fond" : fausse ? "border-erreur-texte/40 bg-erreur-fond" : "border-bordure-carte",
              )}
            >
              <span
                aria-hidden
                className={cn("absolute inset-y-0 left-0", bonne ? "bg-reussite-texte/15" : fausse ? "bg-erreur-texte/15" : "bg-fond-doux")}
                style={{ width: `${pct}%` }}
              />
              <span className="relative flex min-h-11 flex-wrap items-center gap-x-2 gap-y-0.5 px-3.5 py-2.5 text-sm leading-5">
                {bonne && <Icon icon={CheckmarkCircle02Icon} size={18} className="flex-none text-reussite-texte" />}
                {fausse && <Icon icon={CancelCircleIcon} size={18} className="flex-none text-erreur-texte" />}
                <span className={cn("min-w-0 flex-1 wrap-anywhere", bonne || o.moi ? "font-semibold text-encre" : "text-texte")}>{o.texte}</span>
                {bonne && <span className="text-xs leading-[18px] font-semibold text-reussite-texte">Bonne réponse</span>}
                {o.moi && <span className={cn("text-xs leading-[18px] font-semibold", bonne ? "text-reussite-texte" : "text-erreur-texte")}>Votre réponse</span>}
                <span className="sr-only">{`, ${pluriel(o.votes ?? 0, "réponse")}`}</span>
                <span className="flex-none font-semibold text-encre tabular-nums">{pct} %</span>
              </span>
            </li>
          );
        })}
      </ul>
      {s.explication && (
        <p className="m-0 mt-2.5 rounded-[12px] bg-bleu-clair px-3.5 py-2.5 text-sm leading-[21px] wrap-anywhere text-texte">
          <span className="font-semibold text-encre">Explication : </span>
          {s.explication}
        </p>
      )}
      <PiedSondage texte={pluriel(s.votants, "participant")}>
        {s.aRepondu && (
          <span className={cn("text-[13px] leading-5 font-semibold", juste ? "text-reussite-texte" : "text-erreur-texte")}>
            {juste ? "Bonne réponse !" : "Ce n’est pas la bonne réponse."}
          </span>
        )}
      </PiedSondage>
      <Refus erreur={erreur} />
    </section>
  );
}
