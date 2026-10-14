"use client";

import { useId, useRef, useState } from "react";
import { ArrowDown01Icon, CalendarClockIcon, Cancel01Icon, SentIcon } from "@hugeicons/core-free-icons";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { Menu } from "@/components/ui/Menu";
import { TextInput } from "@/components/ui/TextInput";
import { cn } from "@/lib/cn";
import { refusProgrammation } from "@/lib/communaute/sondage";
import { champsDepuis, debutDepuis, phraseSession } from "@/lib/sessions/regles";

/**
 * « Publier ▾ » (spec sondages, quiz et programmation, §1) : « Publier » à gauche, la flèche ouvre « Programmer… » (date
 * et heure du Bénin, de 10 minutes à 3 mois). Programmée, le bouton devient « Programmer » et une ligne rappelle l'heure,
 * avec « Ne plus programmer ».
 */
export function BoutonPublier({
  envoi,
  publieLe,
  onPublier,
  onProgrammer,
}: {
  envoi: boolean;
  /** L'heure de parution choisie (ISO), ou null : maintenant. */
  publieLe: string | null;
  onPublier: () => void;
  onProgrammer: (publieLe: string | null) => void;
}) {
  const id = useId();
  const [fenetre, setFenetre] = useState(false);
  const [date, setDate] = useState("");
  const [heure, setHeure] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  // La fenêtre s'ouvre depuis le menu : il ne reprend pas le focus en se fermant.
  const fenetreDemandee = useRef(false);

  function ouvrir() {
    fenetreDemandee.current = true;
    const champs = publieLe ? champsDepuis(publieLe) : { date: "", heure: "" };
    setDate(champs.date);
    setHeure(champs.heure);
    setErreur(null);
    setFenetre(true);
  }

  function valider() {
    const iso = debutDepuis(date, heure);
    const refus = iso ? refusProgrammation(iso, new Date()) : "Choisissez la date et l’heure.";
    if (refus || !iso) {
      setErreur(refus);
      return;
    }
    onProgrammer(iso);
    setFenetre(false);
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      {publieLe && (
        <span className="flex items-center gap-1 text-[13px] leading-5 text-discret">
          <Icon icon={CalendarClockIcon} size={16} className="text-bleu" />
          <span>Programmée pour le {phraseSession(publieLe)}</span>
          <IconButton icon={Cancel01Icon} label="Ne plus programmer" variant="discret" size="sm" disabled={envoi} onClick={() => onProgrammer(null)} />
        </span>
      )}
      <div className="inline-flex">
        <Button loading={envoi} iconLeft={publieLe ? CalendarClockIcon : SentIcon} className="rounded-r-none" onClick={onPublier}>
          {publieLe ? "Programmer" : "Publier"}
        </Button>
        <Menu
          label="Options de publication"
          trigger={
            <button
              type="button"
              aria-label="Plus d’options de publication"
              disabled={envoi}
              className={cn(buttonVariants(), "rounded-l-none border-l border-white/30 px-2.5")}
            >
              <Icon icon={ArrowDown01Icon} size={18} />
            </button>
          }
          items={[
            { label: "Programmer…", icon: CalendarClockIcon, onSelect: ouvrir },
            ...(publieLe ? [{ label: "Publier maintenant", icon: SentIcon, onSelect: () => onProgrammer(null) }] : []),
          ]}
          rendreLeFocus={() => {
            const rendre = !fenetreDemandee.current;
            fenetreDemandee.current = false;
            return rendre;
          }}
        />
      </div>
      <Dialog
        open={fenetre}
        onOpenChange={setFenetre}
        title="Programmer la publication"
        icon={CalendarClockIcon}
        description="Heure du Bénin. Elle paraîtra en haut du fil à cette heure-là ; d’ici là, vous seul la voyez (onglet « Programmées »)."
        footer={
          <>
            <Button variant="contour" onClick={() => setFenetre(false)}>
              Annuler
            </Button>
            <Button onClick={valider}>Programmer</Button>
          </>
        }
      >
        <div className="flex flex-wrap gap-3">
          <Field label="Date" htmlFor={`${id}-date`} className="min-w-0 flex-[1_1_160px]">
            <TextInput id={`${id}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Heure" htmlFor={`${id}-heure`} className="min-w-0 flex-[1_1_120px]">
            <TextInput id={`${id}-heure`} type="time" value={heure} onChange={(e) => setHeure(e.target.value)} />
          </Field>
        </div>
        {erreur && (
          <p role="alert" className="m-0 mt-2 text-sm leading-5 text-erreur-texte">
            {erreur}
          </p>
        )}
      </Dialog>
    </div>
  );
}
