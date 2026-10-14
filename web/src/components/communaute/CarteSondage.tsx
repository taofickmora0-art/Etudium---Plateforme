"use client";

import { useId, useState } from "react";
import { Image01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { voter } from "@/lib/communaute/actions";
import { pourcentage } from "@/lib/communaute/sondage";
import type { OptionSondage, Sondage } from "@/lib/communaute/types";
import { phraseSession } from "@/lib/sessions/regles";

const ECHEC = "L’opération n’a pas abouti. Réessayez.";
/** Une publication programmée ou en attente de l'équipe : son sondage se lit, mais ne se vote pas encore. */
export const VOTE_A_VENIR = "Le vote ouvrira à la parution de la publication.";
export const pluriel = (n: number, mot: string) => `${n.toLocaleString("fr-FR")} ${mot}${n > 1 ? "s" : ""}`;

/** Le sondage rendu par le vote : ses images gardent leur lien temporaire (le vote ne les signe pas). */
export function avecImages(avant: Sondage, apres: Sondage): Sondage {
  const liens = new Map(avant.options.map((o) => [o.id, o.image?.url ?? null]));
  return { ...apres, options: apres.options.map((o) => (o.image && !o.image.url ? { ...o, image: { ...o.image, url: liens.get(o.id) ?? null } } : o)) };
}

/** Voter (sondage) ou répondre (quiz) : l'envoi en cours, son refus, le sondage à jour. */
export function useVote(publicationId: string, sondage: Sondage, onChange: (s: Sondage) => void) {
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  async function envoyer(choix: string[]): Promise<boolean> {
    setEnvoi(true);
    setErreur(null);
    const reponse = await voter(publicationId, choix).catch(() => ({ ok: false as const, message: ECHEC }));
    setEnvoi(false);
    if (!reponse.ok) {
      setErreur(reponse.message);
      return false;
    }
    onChange(avecImages(sondage, reponse.sondage));
    return true;
  }
  return { envoi, erreur, envoyer };
}

/** L'image d'une option, ou sa place si le lien temporaire manque. */
function Vignette({ option, alt, children }: { option: OptionSondage; alt: string; children?: React.ReactNode }) {
  return (
    <span className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-[12px] border border-bordure-carte bg-page">
      {option.image?.url ? (
        // Un lien temporaire de Supabase : l'optimisation d'images de Next ne s'y applique pas.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={option.image.url} alt={alt} className="absolute inset-0 size-full object-cover" />
      ) : (
        <Icon icon={Image01Icon} size={24} className="text-discret" />
      )}
      {children}
    </span>
  );
}

/** Le pied : le nombre de votants (s'il se voit), la fin ; les boutons à droite. */
export function PiedSondage({ texte, children }: { texte: string; children?: React.ReactNode }) {
  return (
    <div className="mt-2.5 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <span className="text-[13px] leading-5 text-discret max-sm:text-xs max-sm:leading-[18px]">{texte}</span>
      {children && <span className="flex flex-wrap items-center gap-2">{children}</span>}
    </div>
  );
}

export function Refus({ erreur }: { erreur: string | null }) {
  return erreur ? (
    <p role="alert" className="m-0 mt-2 text-sm leading-5 text-erreur-texte">
      {erreur}
    </p>
  ) : null;
}

/**
 * Le sondage d'une publication, avec texte ou avec images (spec sondages, quiz et programmation, §2 et §3) : on coche et
 * on vote (une image se touche) ; ensuite les résultats (pourcentage, barre, mon choix), « Changer mon vote » tant que le
 * sondage est ouvert ; terminé, les résultats seuls. L'auteur et l'équipe voient les résultats sans voter.
 */
export function CarteSondage({
  publicationId,
  sondage: s,
  ouvert,
  onChange,
}: {
  publicationId: string;
  sondage: Sondage;
  /** La publication est en ligne : on peut voter. */
  ouvert: boolean;
  onChange: (sondage: Sondage) => void;
}) {
  const nom = useId();
  const [modifier, setModifier] = useState(false);
  const [choix, setChoix] = useState<string[]>(() => s.options.filter((o) => o.moi).map((o) => o.id));
  const { envoi, erreur, envoyer } = useVote(publicationId, s, onChange);
  const images = s.type === "images";
  const visibles = s.votants !== null;
  const enVote = !s.ferme && (!ouvert || !visibles || modifier);
  const fin = s.ferme ? "Sondage terminé" : s.finLe ? `Se termine le ${phraseSession(s.finLe)}` : "Sans date de fin";
  const pied = [visibles ? pluriel(s.votants ?? 0, "votant") : null, fin, enVote && s.choixMultiples ? "plusieurs réponses possibles" : null].filter(Boolean).join(" · ");

  const basculer = (id: string) => setChoix((actuel) => (s.choixMultiples ? (actuel.includes(id) ? actuel.filter((x) => x !== id) : [...actuel, id]) : [id]));
  // Les choix envoyés dans l'ordre des options.
  const ordonnes = () => s.options.filter((o) => choix.includes(o.id)).map((o) => o.id);
  async function valider(ids: string[]) {
    if (await envoyer(ids)) setModifier(false);
  }
  function revoter() {
    setChoix(s.options.filter((o) => o.moi).map((o) => o.id));
    setModifier(true);
  }

  if (enVote) {
    // Un sondage avec images à une seule réponse : toucher une image vote ; sinon on coche, puis « Voter ».
    const direct = images && !s.choixMultiples;
    return (
      <section aria-label="Sondage" className="mt-3.5 flex min-w-0 flex-col">
        {images ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {s.options.map((o, i) => {
              const choisi = choix.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  aria-label={`Voter pour ${o.texte || `l’image ${i + 1}`}`}
                  aria-pressed={direct ? undefined : choisi}
                  disabled={!ouvert || envoi}
                  onClick={() => (direct ? void valider([o.id]) : basculer(o.id))}
                  className={cn(
                    "focus-etudium flex min-w-0 cursor-pointer flex-col gap-1.5 rounded-[14px] border-2 bg-transparent p-1 text-left transition-colors disabled:cursor-default",
                    choisi ? "border-bleu" : "border-transparent enabled:hover:border-bleu-bord",
                  )}
                >
                  <Vignette option={o} alt="">
                    {choisi && (
                      <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-bleu text-white">
                        <Icon icon={Tick02Icon} size={16} />
                      </span>
                    )}
                  </Vignette>
                  {o.texte && <span className="truncate px-1 text-[13px] leading-5 font-medium text-encre">{o.texte}</span>}
                </button>
              );
            })}
          </div>
        ) : (
          <fieldset disabled={!ouvert || envoi} className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
            <legend className="sr-only">{s.choixMultiples ? "Vos réponses" : "Votre réponse"}</legend>
            {s.options.map((o) => {
              const choisi = choix.includes(o.id);
              return (
                <label
                  key={o.id}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-3 rounded-[12px] border px-3.5 py-2.5 text-sm leading-5 text-encre has-disabled:cursor-default",
                    choisi ? "border-bleu bg-bleu-clair" : "border-bordure-champ hover:border-bleu-bord",
                  )}
                >
                  <input
                    type={s.choixMultiples ? "checkbox" : "radio"}
                    name={nom}
                    checked={choisi}
                    onChange={() => basculer(o.id)}
                    className="size-[18px] flex-none accent-[var(--color-bleu)]"
                  />
                  <span className="min-w-0 flex-1 wrap-anywhere">{o.texte}</span>
                </label>
              );
            })}
          </fieldset>
        )}
        <PiedSondage texte={pied}>
          {ouvert && modifier && (
            <Button variant="contour" size="sm" disabled={envoi} onClick={() => setModifier(false)}>
              Annuler
            </Button>
          )}
          {ouvert && !direct && (
            <Button size="sm" loading={envoi} disabled={choix.length === 0} onClick={() => void valider(ordonnes())}>
              Voter
            </Button>
          )}
        </PiedSondage>
        {!ouvert && <p className="m-0 mt-1.5 text-[13px] leading-5 text-discret">{VOTE_A_VENIR}</p>}
        <Refus erreur={erreur} />
      </section>
    );
  }

  const total = s.votants ?? 0;
  return (
    <section aria-label="Sondage" className="mt-3.5 flex min-w-0 flex-col">
      <ul aria-label="Résultats du sondage" className={cn("m-0 list-none p-0", images ? "grid grid-cols-2 gap-2.5 sm:grid-cols-3" : "flex flex-col gap-2")}>
        {s.options.map((o, i) => {
          const pct = pourcentage(o.votes ?? 0, total);
          const detail = <span className="sr-only">{`, ${pluriel(o.votes ?? 0, "vote")}${o.moi ? " (votre choix)" : ""}`}</span>;
          if (images) {
            return (
              <li key={o.id} className="flex min-w-0 flex-col gap-1.5">
                <Vignette option={o} alt={o.texte || `Image ${i + 1}`}>
                  <span className={cn("absolute right-2 bottom-2 rounded-full px-2 py-0.5 text-xs leading-[18px] font-semibold tabular-nums", o.moi ? "bg-bleu text-white" : "bg-encre/75 text-white")}>
                    {pct} %
                  </span>
                  {o.moi && (
                    <span aria-hidden className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-bleu text-white">
                      <Icon icon={Tick02Icon} size={16} />
                    </span>
                  )}
                </Vignette>
                <span className="truncate px-1 text-[13px] leading-5 font-medium text-encre">
                  {o.texte}
                  {detail}
                </span>
              </li>
            );
          }
          return (
            <li key={o.id} className="relative min-w-0 overflow-hidden rounded-[12px] border border-bordure-carte">
              <span aria-hidden className={cn("absolute inset-y-0 left-0", o.moi ? "bg-bleu-pale" : "bg-fond-doux")} style={{ width: `${pct}%` }} />
              <span className="relative flex min-h-11 items-center gap-2 px-3.5 py-2.5 text-sm leading-5">
                <span className={cn("min-w-0 flex-1 wrap-anywhere", o.moi ? "font-semibold text-encre" : "text-texte")}>{o.texte}</span>
                {o.moi && <Icon icon={Tick02Icon} size={16} className="flex-none text-bleu" />}
                {detail}
                <span className="flex-none font-semibold text-encre tabular-nums">{pct} %</span>
              </span>
            </li>
          );
        })}
      </ul>
      <PiedSondage texte={pied}>
        {ouvert && !s.ferme && (
          <Button variant={s.aRepondu ? "contour" : "principal"} size="sm" onClick={revoter}>
            {s.aRepondu ? "Changer mon vote" : "Voter"}
          </Button>
        )}
      </PiedSondage>
      <Refus erreur={erreur} />
    </section>
  );
}
