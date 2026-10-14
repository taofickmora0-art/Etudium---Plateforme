"use client";

import { useEffect, useRef, type ChangeEvent } from "react";
import { Add01Icon, Cancel01Icon, Image01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { TextInput } from "@/components/ui/TextInput";
import { formatDe } from "@/lib/admin/fichiers";
import { identifiantAleatoire } from "@/lib/identifiant";
import { BORNES, DUREES_SONDAGE, EXPLICATION_MAX, OPTION_MAX, type TypeSondage } from "@/lib/communaute/sondage";

const TYPES_IMAGE = ["image/jpeg", "image/png", "image/webp"];
const IMAGE_MAX_OCTETS = 10 * 1024 * 1024;
export const REFUS_IMAGE_OPTION = "Une option d’un sondage avec images est une image (JPG, PNG ou WebP), 10 Mo au plus.";

/** Une option en cours de saisie ; pour un sondage avec images, le fichier choisi et son aperçu local. */
export type OptionSaisie = { cle: string; texte: string; fichier?: File | null; type?: string; apercu?: string | null; correcte?: boolean };
export type EtatSondage = { type: TypeSondage; options: OptionSaisie[]; choixMultiples: boolean; duree: string; explication: string };

const TITRES: Record<TypeSondage, string> = { texte: "Sondage avec texte", images: "Sondage avec images", quiz: "Quiz" };
const nouvelleOption = (): OptionSaisie => ({ cle: identifiantAleatoire(), texte: "" });

/** Un sondage vide de ce type : 2 options, fin à 1 semaine. */
export function sondageVide(type: TypeSondage): EtatSondage {
  return { type, options: [nouvelleOption(), nouvelleOption()], choixMultiples: false, duree: "7", explication: "" };
}

/** Un sondage commencé : une option écrite, une image, une explication. */
export const sondageRempli = (s: EtatSondage) => s.explication.trim() !== "" || s.options.some((o) => o.texte.trim() !== "" || o.fichier);

/**
 * La saisie d'un sondage (texte ou images) ou d'un quiz (spec sondages, quiz et programmation, §2 à §4) : les options
 * (2 à 10, ou 2 à 6), « Plusieurs réponses possibles » et la fin ; pour un quiz, la bonne réponse et l'explication.
 * La question est le texte de la publication.
 */
export function ChampSondage({
  etat,
  onChange,
  onRetirer,
  onErreur,
  desactive,
}: {
  etat: EtatSondage;
  onChange: (etat: EtatSondage) => void;
  onRetirer: () => void;
  onErreur: (message: string | null) => void;
  desactive: boolean;
}) {
  const [min, max] = BORNES[etat.type];
  const quiz = etat.type === "quiz";
  const images = etat.type === "images";
  const nom = quiz ? "Réponse" : "Option";
  // Les aperçus locaux des images : rendus quand le sondage disparaît.
  const apercus = useRef<string[]>([]);
  useEffect(() => {
    apercus.current = etat.options.flatMap((o) => (o.apercu ? [o.apercu] : []));
  }, [etat.options]);
  useEffect(() => () => apercus.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const changerOption = (cle: string, modif: Partial<OptionSaisie>) => onChange({ ...etat, options: etat.options.map((o) => (o.cle === cle ? { ...o, ...modif } : o)) });

  async function choisirImage(cle: string, e: ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0];
    e.target.value = "";
    if (!fichier) return;
    // Le type se lit sur les premiers octets : un « .png » qui n'en est pas un est refusé.
    const type = formatDe(fichier.name, new Uint8Array(await fichier.slice(0, 16).arrayBuffer()));
    if (!type || !TYPES_IMAGE.includes(type) || fichier.size < 1 || fichier.size > IMAGE_MAX_OCTETS) {
      onErreur(REFUS_IMAGE_OPTION);
      return;
    }
    onErreur(null);
    const ancienne = etat.options.find((o) => o.cle === cle)?.apercu;
    if (ancienne) URL.revokeObjectURL(ancienne);
    changerOption(cle, { fichier, type, apercu: URL.createObjectURL(fichier) });
  }

  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-3 rounded-[14px] border border-bordure-carte bg-page p-3.5 max-sm:p-3">
      <div className="flex items-center justify-between gap-2">
        <legend className="float-left p-0 text-sm leading-5 font-semibold text-encre">{TITRES[etat.type]}</legend>
        <IconButton icon={Cancel01Icon} label={quiz ? "Retirer le quiz" : "Retirer le sondage"} variant="discret" size="sm" disabled={desactive} onClick={onRetirer} />
      </div>
      <p className="m-0 -mt-1 text-[13px] leading-5 text-discret">{quiz ? "La question est le texte de la publication. Cochez la bonne réponse." : "La question est le texte de la publication."}</p>

      <div className={images ? "grid grid-cols-2 gap-2.5 sm:grid-cols-3" : "flex flex-col gap-2"}>
        {etat.options.map((o, i) => {
          const rang = i + 1;
          const retirer = etat.options.length > min && (
            <IconButton
              icon={Cancel01Icon}
              label={`Retirer ${quiz ? "la réponse" : "l’option"} ${rang}`}
              variant="discret"
              size="sm"
              disabled={desactive}
              onClick={() => onChange({ ...etat, options: etat.options.filter((x) => x.cle !== o.cle) })}
            />
          );
          if (images) {
            return (
              <div key={o.cle} className="flex min-w-0 flex-col gap-1.5">
                <label className="focus-within:ring-bleu relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-[12px] border border-dashed border-bordure-champ bg-panneau focus-within:ring-2">
                  {o.apercu ? (
                    // Une image choisie dans le navigateur (adresse blob:) : pas d'optimisation de Next.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.apercu} alt="" className="absolute inset-0 size-full object-cover" />
                  ) : (
                    <span className="flex flex-col items-center gap-1 text-xs leading-[18px] text-discret">
                      <Icon icon={Image01Icon} size={22} />
                      Ajouter une image
                    </span>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-label={`Image de l’option ${rang}`}
                    disabled={desactive}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    onChange={(e) => void choisirImage(o.cle, e)}
                  />
                </label>
                <div className="flex min-w-0 items-center gap-1">
                  <TextInput
                    aria-label={`Libellé de l’option ${rang} (facultatif)`}
                    placeholder="Libellé (facultatif)"
                    value={o.texte}
                    maxLength={OPTION_MAX}
                    disabled={desactive}
                    onChange={(e) => changerOption(o.cle, { texte: e.target.value })}
                    className="h-9 min-w-0 flex-1 text-[13px]"
                  />
                  {retirer}
                </div>
              </div>
            );
          }
          return (
            <div key={o.cle} className="flex min-w-0 items-center gap-2">
              {quiz && (
                <input
                  type="radio"
                  name={`bonne-${etat.options[0]?.cle}`}
                  aria-label={`Bonne réponse : réponse ${rang}`}
                  title="Bonne réponse"
                  checked={o.correcte === true}
                  disabled={desactive}
                  onChange={() => onChange({ ...etat, options: etat.options.map((x) => ({ ...x, correcte: x.cle === o.cle })) })}
                  className="size-5 flex-none accent-[var(--color-reussite-texte)]"
                />
              )}
              <TextInput
                aria-label={`${nom} ${rang}`}
                placeholder={`${nom} ${rang}`}
                value={o.texte}
                maxLength={OPTION_MAX}
                disabled={desactive}
                onChange={(e) => changerOption(o.cle, { texte: e.target.value })}
                className="h-10 min-w-0 flex-1 text-sm"
              />
              {retirer}
            </div>
          );
        })}
      </div>

      {etat.options.length < max && (
        <Button
          type="button"
          variant="discret"
          size="sm"
          iconLeft={Add01Icon}
          disabled={desactive}
          className="self-start"
          onClick={() => onChange({ ...etat, options: [...etat.options, nouvelleOption()] })}
        >
          {quiz ? "Ajouter une réponse" : "Ajouter une option"}
        </Button>
      )}

      {quiz ? (
        <Textarea
          aria-label="Explication (facultative)"
          placeholder="Explication (facultative) : elle s’affiche après la réponse."
          value={etat.explication}
          maxLength={EXPLICATION_MAX}
          rows={2}
          disabled={desactive}
          onChange={(e) => onChange({ ...etat, explication: e.target.value })}
          className="text-sm"
        />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Checkbox
            label="Plusieurs réponses possibles"
            checked={etat.choixMultiples}
            disabled={desactive}
            onChange={(e) => onChange({ ...etat, choixMultiples: e.target.checked })}
          />
          <label className="flex items-center gap-2 text-[13px] leading-5 font-medium text-discret">
            Fin du sondage
            <Select
              aria-label="Fin du sondage"
              value={etat.duree}
              disabled={desactive}
              onChange={(e) => onChange({ ...etat, duree: e.target.value })}
              options={DUREES_SONDAGE}
              className="h-9 w-[150px] text-sm"
            />
          </label>
        </div>
      )}
    </fieldset>
  );
}
