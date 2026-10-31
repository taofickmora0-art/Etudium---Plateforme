"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Calendar03Icon,
} from "@hugeicons/core-free-icons";
import { Popover } from "radix-ui";
import { cn } from "@/lib/cn";
import {
  aujourdhui,
  decaler,
  isoDepuisTexte,
  nomDuJour,
  premierDuMois,
  semainesDuMois,
  texteDepuisIso,
  titreMois,
} from "@/lib/dates/saisie";
import { IconButton } from "./IconButton";
import { menuSurfaceClasses } from "./Menu";
import { controlClasses, isInvalid } from "./TextInput";

const JOURS = [
  ["lu", "lundi"],
  ["ma", "mardi"],
  ["me", "mercredi"],
  ["je", "jeudi"],
  ["ve", "vendredi"],
  ["sa", "samedi"],
  ["di", "dimanche"],
] as const;

type Props = {
  id: string;
  /** La date choisie, « 2026-10-24 », ou "" (vide ou pas encore valable). */
  value: string;
  onChange: (iso: string) => void;
  /** Le premier jour qu'on peut choisir (« 2026-10-31 ») : les jours d'avant sont désactivés. */
  min?: string;
  invalid?: boolean;
  className?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
};

/**
 * Une date (demande du 31 octobre 2026, à la place du calendrier du navigateur) : un champ texte comme dans le design
 * (« 24/10/2026 »), où l'on tape, et l'icône qui ouvre le calendrier d'Étudium (lundi en premier ; flèches, Page
 * précédente et suivante au clavier).
 */
export function ChampDate({
  id,
  value,
  onChange,
  min,
  invalid,
  className,
  "aria-describedby": decrit,
  "aria-invalid": ariaInvalid,
}: Props) {
  const [texte, setTexte] = useState(() => texteDepuisIso(value));
  const [valeurVue, setValeurVue] = useState(value);
  const [ouvert, setOuvert] = useState(false);
  const [mois, setMois] = useState(() => premierDuMois(value || aujourdhui()));
  const [focus, setFocus] = useState(value || aujourdhui());
  const grille = useRef<HTMLTableElement>(null);
  const clavier = useRef(false);

  // Une valeur changée par le formulaire (fenêtre rouverte) : le texte suit, sauf s'il la dit déjà.
  if (value !== valeurVue) {
    setValeurVue(value);
    if (value !== (isoDepuisTexte(texte) ?? ""))
      setTexte(texteDepuisIso(value));
  }

  // Au clavier, le jour visé prend le focus (y compris dans le mois suivant ou précédent).
  useEffect(() => {
    if (!ouvert || !clavier.current) return;
    grille.current
      ?.querySelector<HTMLButtonElement>(`[data-jour="${focus}"]`)
      ?.focus();
  }, [focus, mois, ouvert]);

  const permis = (jour: string) => !min || jour >= min;

  function ouvrir(suivant: boolean) {
    setOuvert(suivant);
    if (suivant) {
      const depart = value || (min && aujourdhui() < min ? min : aujourdhui());
      setMois(premierDuMois(depart));
      setFocus(depart);
      clavier.current = true;
    }
  }

  function choisir(jour: string) {
    if (!permis(jour)) return;
    setTexte(texteDepuisIso(jour));
    onChange(jour);
    setOuvert(false);
  }

  function viser(jour: string) {
    if (!permis(jour)) return;
    clavier.current = true;
    setFocus(jour);
    if (jour.slice(0, 7) !== mois.slice(0, 7)) setMois(premierDuMois(jour));
  }

  function touche(event: KeyboardEvent) {
    const sauts: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (event.key in sauts) {
      event.preventDefault();
      viser(decaler(focus, sauts[event.key]));
    } else if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      const cible = premierDuMois(focus, event.key === "PageUp" ? -1 : 1);
      viser(permis(cible) ? cible : (min ?? cible));
    }
  }

  const aujourd = aujourdhui();
  return (
    <Popover.Root open={ouvert} onOpenChange={ouvrir}>
      {/* Le calendrier s'aligne sur le champ entier, pas sur l'icône. */}
      <Popover.Anchor asChild>
        <div className={cn("relative min-w-0", className)}>
          <input
            id={id}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="jj/mm/aaaa"
            value={texte}
            onChange={(e) => {
              setTexte(e.target.value);
              onChange(isoDepuisTexte(e.target.value) ?? "");
            }}
            aria-describedby={decrit}
            aria-invalid={isInvalid(invalid, ariaInvalid)}
            className={cn(controlClasses, "pr-12")}
          />
          <Popover.Trigger asChild>
            <IconButton
              icon={Calendar03Icon}
              label="Choisir une date"
              variant="discret"
              size="sm"
              className="absolute top-1/2 right-1.5 -translate-y-1/2"
            />
          </Popover.Trigger>
        </div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          aria-label="Choisir une date"
          align="start"
          sideOffset={8}
          onOpenAutoFocus={(e) => {
            // Le focus va au jour choisi (ou à aujourd'hui), pas au premier bouton.
            e.preventDefault();
            grille.current
              ?.querySelector<HTMLButtonElement>(`[data-jour="${focus}"]`)
              ?.focus();
          }}
          className={cn(menuSurfaceClasses, "w-[316px] p-3 max-sm:w-[292px]")}
        >
          <div className="flex items-center justify-between gap-2 pb-2">
            <IconButton
              icon={ArrowLeft01Icon}
              label="Mois précédent"
              variant="discret"
              size="sm"
              onClick={() => setMois(premierDuMois(mois, -1))}
            />
            <span
              className="text-[15px] leading-[22px] font-semibold text-encre"
              aria-live="polite"
            >
              {titreMois(mois)}
            </span>
            <IconButton
              icon={ArrowRight01Icon}
              label="Mois suivant"
              variant="discret"
              size="sm"
              onClick={() => setMois(premierDuMois(mois, 1))}
            />
          </div>
          <table
            ref={grille}
            className="w-full border-collapse"
            onKeyDown={touche}
          >
            <thead>
              <tr>
                {JOURS.map(([court, long]) => (
                  <th
                    key={court}
                    scope="col"
                    abbr={long}
                    className="pb-1 text-center text-xs leading-[18px] font-medium text-discret"
                  >
                    {court}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {semainesDuMois(mois).map((semaine) => (
                <tr key={semaine[0]}>
                  {semaine.map((jour) => {
                    const choisi = jour === value;
                    const horsMois = jour.slice(0, 7) !== mois.slice(0, 7);
                    return (
                      <td key={jour} className="p-0.5 text-center">
                        <button
                          type="button"
                          data-jour={jour}
                          tabIndex={jour === focus ? 0 : -1}
                          disabled={!permis(jour)}
                          aria-label={nomDuJour(jour)}
                          aria-pressed={choisi}
                          aria-current={jour === aujourd ? "date" : undefined}
                          onClick={() => choisir(jour)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              choisir(jour);
                            }
                          }}
                          className={cn(
                            "focus-etudium size-10 cursor-pointer rounded-champ text-sm leading-5 transition-colors max-sm:size-9",
                            choisi
                              ? "bg-bleu font-semibold text-white"
                              : jour === aujourd
                                ? "font-semibold text-bleu ring-1 ring-bleu ring-inset hover:bg-coque"
                                : horsMois
                                  ? "text-discret hover:bg-coque"
                                  : "text-texte hover:bg-coque",
                            "disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-35",
                          )}
                        >
                          {Number(jour.slice(8))}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end pt-2">
            <button
              type="button"
              disabled={!permis(aujourd)}
              onClick={() => choisir(aujourd)}
              className="focus-etudium cursor-pointer rounded-puce px-2.5 py-1.5 text-sm leading-5 font-medium text-bleu hover:bg-coque disabled:cursor-not-allowed disabled:opacity-40"
            >
              Aujourd’hui
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
