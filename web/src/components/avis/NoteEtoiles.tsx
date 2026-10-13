import { useId } from "react";
import { StarIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/Icon";
import type { Etoiles } from "@/lib/avis/types";
import { EtoilePleine } from "./EtoilesNote";

const NOTES: Etoiles[] = [1, 2, 3, 4, 5];

/**
 * Choix de la note (formulaire d'avis, non maquetté) : cinq boutons radio natifs, qui se règlent aussi aux flèches du
 * clavier. Étoiles de 28 px dans des cibles de 44 px ; pleines jusqu'à la note choisie.
 */
export function NoteEtoiles({ valeur, onChange }: { valeur: Etoiles | null; onChange: (note: Etoiles) => void }) {
  const nom = useId();
  return (
    <fieldset className="m-0 flex min-w-0 flex-col border-0 p-0">
      <legend className="mb-1.5 p-0 text-sm leading-5 font-medium text-encre">Votre note</legend>
      <div className="flex flex-wrap gap-0.5">
        {NOTES.map((n) => (
          <label key={n} className="flex cursor-pointer">
            <input type="radio" name={nom} value={n} checked={valeur === n} onChange={() => onChange(n)} className="peer sr-only" />
            <span className="sr-only">{n > 1 ? `${n} étoiles` : "1 étoile"}</span>
            <span
              aria-hidden="true"
              className="flex size-11 items-center justify-center rounded-champ transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-bleu hover:bg-page"
            >
              {valeur !== null && n <= valeur ? <EtoilePleine taille={28} className="text-attention-texte" /> : <Icon icon={StarIcon} size={28} className="text-discret" />}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
