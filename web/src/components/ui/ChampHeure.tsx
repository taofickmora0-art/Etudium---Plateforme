"use client";

import { useState } from "react";
import { Clock01Icon } from "@hugeicons/core-free-icons";
import { Popover } from "radix-ui";
import { cn } from "@/lib/cn";
import { heureDepuisTexte } from "@/lib/dates/saisie";
import { IconButton } from "./IconButton";
import { menuSurfaceClasses } from "./Menu";
import { controlClasses, isInvalid } from "./TextInput";

const HEURES = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, m) =>
  String(m * 5).padStart(2, "0"),
);

type Props = {
  id: string;
  /** L'heure choisie, « 15:00 », ou "" (vide ou pas encore valable). */
  value: string;
  onChange: (heure: string) => void;
  invalid?: boolean;
  className?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
};

const CASE =
  "focus-etudium h-9 w-full shrink-0 cursor-pointer rounded-champ text-sm leading-5 tabular-nums transition-colors";

/**
 * Une heure (demande du 31 octobre 2026, à la place de celle du navigateur) : un champ texte comme dans le design
 * (« 15:00 »), où l'on tape une heure exacte, et l'icône qui ouvre deux colonnes : les heures, puis les minutes de 5 en 5.
 */
export function ChampHeure({
  id,
  value,
  onChange,
  invalid,
  className,
  "aria-describedby": decrit,
  "aria-invalid": ariaInvalid,
}: Props) {
  const [texte, setTexte] = useState(value);
  const [valeurVue, setValeurVue] = useState(value);
  const [ouvert, setOuvert] = useState(false);

  // Une valeur changée par le formulaire : le texte suit, sauf s'il la dit déjà.
  if (value !== valeurVue) {
    setValeurVue(value);
    if (value !== (heureDepuisTexte(texte) ?? "")) setTexte(value);
  }

  const [heure, minute] = value ? value.split(":") : ["", ""];
  function choisir(h: string, m: string, fermer: boolean) {
    const nouvelle = `${h}:${m}`;
    setTexte(nouvelle);
    onChange(nouvelle);
    if (fermer) setOuvert(false);
  }

  return (
    <Popover.Root open={ouvert} onOpenChange={setOuvert}>
      <Popover.Anchor asChild>
        <div className={cn("relative min-w-0", className)}>
          <input
            id={id}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="hh:mm"
            value={texte}
            onChange={(e) => {
              setTexte(e.target.value);
              onChange(heureDepuisTexte(e.target.value) ?? "");
            }}
            aria-describedby={decrit}
            aria-invalid={isInvalid(invalid, ariaInvalid)}
            className={cn(controlClasses, "pr-12")}
          />
          <Popover.Trigger asChild>
            <IconButton
              icon={Clock01Icon}
              label="Choisir une heure"
              variant="discret"
              size="sm"
              className="absolute top-1/2 right-1.5 -translate-y-1/2"
            />
          </Popover.Trigger>
        </div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          aria-label="Choisir une heure"
          align="start"
          sideOffset={8}
          onOpenAutoFocus={(e) => {
            // L'heure choisie est visible et prend le focus.
            e.preventDefault();
            const cible = (
              e.currentTarget as HTMLElement | null
            )?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
            cible?.scrollIntoView?.({ block: "center" });
            cible?.focus();
          }}
          className={cn(menuSurfaceClasses, "flex w-[200px] gap-2 p-2")}
        >
          <div
            role="group"
            aria-label="Heures"
            className="flex max-h-60 flex-1 flex-col gap-0.5 overflow-y-auto pr-1"
          >
            <span
              aria-hidden="true"
              className="sticky top-0 bg-panneau pb-1 text-center text-xs leading-[18px] font-medium text-discret"
            >
              Heure
            </span>
            {HEURES.map((h) => (
              <button
                key={h}
                type="button"
                aria-label={`${Number(h)} h`}
                aria-pressed={h === heure}
                onClick={() => choisir(h, minute || "00", false)}
                className={cn(
                  CASE,
                  h === heure
                    ? "bg-bleu font-semibold text-white"
                    : "text-texte hover:bg-coque",
                )}
              >
                {h}
              </button>
            ))}
          </div>
          <div
            role="group"
            aria-label="Minutes"
            className="flex max-h-60 flex-1 flex-col gap-0.5 overflow-y-auto pr-1"
          >
            <span
              aria-hidden="true"
              className="sticky top-0 bg-panneau pb-1 text-center text-xs leading-[18px] font-medium text-discret"
            >
              Min
            </span>
            {MINUTES.map((m) => (
              <button
                key={m}
                type="button"
                aria-label={`${Number(m)} min`}
                aria-pressed={m === minute}
                onClick={() => choisir(heure || "00", m, true)}
                className={cn(
                  CASE,
                  m === minute
                    ? "bg-bleu font-semibold text-white"
                    : "text-texte hover:bg-coque",
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
