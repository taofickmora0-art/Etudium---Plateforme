"use client";

import { useId, useState } from "react";
import { CalendarClockIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { ChampDate } from "@/components/ui/ChampDate";
import { ChampHeure } from "@/components/ui/ChampHeure";
import { aujourdhui } from "@/lib/dates/saisie";
import { refusProgrammation } from "@/lib/communaute/sondage";
import { champsDepuis, debutDepuis } from "@/lib/sessions/regles";

/**
 * La date et l'heure (du Bénin) de parution d'une publication, de 10 minutes à 3 mois : « Programmer… » du champ de
 * publication, « Modifier la date » d'une publication programmée. `onValider` rend le refus du serveur, ou null.
 */
export function FenetreProgrammation({
  open,
  onOpenChange,
  titre,
  description,
  valider: libelle,
  initiale,
  onValider,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titre: string;
  description: string;
  valider: string;
  /** L'heure déjà choisie (ISO), ou null. */
  initiale: string | null;
  onValider: (iso: string) => Promise<string | null>;
}) {
  const id = useId();
  const [ouverte, setOuverte] = useState(false);
  const [date, setDate] = useState("");
  const [heure, setHeure] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  // À chaque ouverture, les champs repartent de l'heure déjà choisie.
  if (open !== ouverte) {
    setOuverte(open);
    if (open) {
      const champs = initiale ? champsDepuis(initiale) : { date: "", heure: "" };
      setDate(champs.date);
      setHeure(champs.heure);
      setErreur(null);
    }
  }

  async function valider() {
    const iso = debutDepuis(date, heure);
    const refus = iso ? refusProgrammation(iso, new Date()) : "Choisissez la date et l’heure.";
    if (refus || !iso) {
      setErreur(refus);
      return;
    }
    setEnvoi(true);
    const refusServeur = await onValider(iso).catch(() => "L’opération n’a pas abouti. Réessayez.");
    setEnvoi(false);
    if (refusServeur) {
      setErreur(refusServeur);
      return;
    }
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={titre}
      icon={CalendarClockIcon}
      description={description}
      footer={
        <>
          <Button variant="contour" disabled={envoi} onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button loading={envoi} onClick={() => void valider()}>
            {libelle}
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap gap-3">
        <Field label="Date" htmlFor={`${id}-date`} className="min-w-0 flex-[1_1_160px]">
          <ChampDate id={`${id}-date`} value={date} onChange={setDate} min={aujourdhui()} />
        </Field>
        <Field label="Heure" htmlFor={`${id}-heure`} className="min-w-0 flex-[1_1_120px]">
          <ChampHeure id={`${id}-heure`} value={heure} onChange={setHeure} />
        </Field>
      </div>
      {erreur && (
        <p role="alert" className="m-0 mt-2 text-sm leading-5 text-erreur-texte">
          {erreur}
        </p>
      )}
    </Dialog>
  );
}
