"use client";

import { createContext, useContext, useId, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { Note01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/cn";
import { INDISPONIBLE } from "@/lib/indisponible";
import { enregistrerNote } from "@/lib/lecon/actions";
import { NOTE_ECHEC, NOTE_MAX } from "@/lib/lecon/regles";

type Props = { leconId: string; noteInitiale: string | null; connecte: boolean; disponible: boolean };

const TEXTE_DISCRET = "m-0 text-sm leading-[22px] text-discret";

type Statut = { ok: boolean; message: string } | null;
type EtatNote = { texte: string; setTexte: (texte: string) => void; statut: Statut; setStatut: (statut: Statut) => void };

const ContexteNote = createContext<EtatNote | null>(null);

/**
 * Garde la note au-dessus des onglets : un changement d'onglet (qui démonte le panneau) ne perd ni la saisie ni la note
 * enregistrée, et les onglets de l'ordinateur et du téléphone montrent la même note.
 */
export function NoteProvider({ noteInitiale, children }: { noteInitiale: string | null; children: ReactNode }) {
  const [texte, setTexte] = useState(noteInitiale ?? "");
  const [statut, setStatut] = useState<Statut>(null);
  return <ContexteNote value={{ texte, setTexte, statut, setStatut }}>{children}</ContexteNote>;
}

/** L'état partagé s'il existe, sinon un état propre (composant utilisé seul). */
function useEtatNote(noteInitiale: string | null): EtatNote {
  const partage = useContext(ContexteNote);
  const [texte, setTexte] = useState(noteInitiale ?? "");
  const [statut, setStatut] = useState<Statut>(null);
  return partage ?? { texte, setTexte, statut, setStatut };
}

/** Onglet « Notes » (NdLecon §2.11) : une note privée par leçon, enregistrée au clic. */
export function NotesLecon({ leconId, noteInitiale, connecte, disponible }: Props) {
  const champ = useId();
  const aide = useId();
  const { texte, setTexte, statut, setStatut } = useEtatNote(noteInitiale);
  const [enCours, demarrer] = useTransition();

  if (!connecte) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className={TEXTE_DISCRET}>Vos notes sont privées : créez un compte gratuit pour en prendre.</p>
        <Button asChild variant="gris">
          <Link href="/inscription">Créer un compte gratuit</Link>
        </Button>
      </div>
    );
  }
  if (!disponible) return <p className={TEXTE_DISCRET}>{INDISPONIBLE}</p>;

  return (
    <form
      className="flex min-w-0 flex-col gap-3.5"
      onSubmit={(e) => {
        e.preventDefault();
        demarrer(async () => {
          try {
            const reponse = await enregistrerNote(leconId, texte);
            setStatut(reponse.ok ? { ok: true, message: "Note enregistrée" } : { ok: false, message: reponse.erreur });
          } catch {
            // Coupure réseau : on le dit et on garde la saisie, au lieu de l'écran d'erreur.
            setStatut({ ok: false, message: NOTE_ECHEC });
          }
        });
      }}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <label htmlFor={champ} className="text-sm leading-5 font-medium text-encre">
          Mes notes sur cette leçon
        </label>
        <Textarea
          id={champ}
          rows={7}
          maxLength={NOTE_MAX}
          value={texte}
          onChange={(e) => {
            setTexte(e.target.value);
            setStatut(null);
          }}
          placeholder="Notez ce que vous voulez retenir : une formule, un raccourci, une idée pour votre mémoire…"
          aria-describedby={aide}
          className="resize-y"
        />
        <span id={aide} className="text-xs leading-[18px] text-discret">
          Vos notes sont privées. Vous les retrouvez à chaque retour sur cette leçon.
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="gris" iconLeft={Note01Icon} loading={enCours}>
          Enregistrer la note
        </Button>
        <span aria-live="polite" className={cn("text-sm leading-5", statut?.ok ? "text-reussite-texte" : "text-erreur-texte")}>
          {statut?.message}
        </span>
      </div>
    </form>
  );
}
