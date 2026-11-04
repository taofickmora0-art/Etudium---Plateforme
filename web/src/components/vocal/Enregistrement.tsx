"use client";

import { useSyncExternalStore } from "react";
import { Delete02Icon, Mic01Icon, SentIcon, StopIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/lib/cn";
import { dureeLisible, DUREE_MAX_MS } from "@/lib/vocal/regles";
import { LecteurVocal } from "./LecteurVocal";
import { vocalPossible, type EnregistreurVocal, type NoteEnregistree } from "./useEnregistreurVocal";

// Le micro et la barre d'enregistrement d'une note vocale (spec du 4 novembre 2026), communs aux messages privés et aux
// groupes : le micro remplace « Envoyer » quand le champ est vide ; pendant l'enregistrement, la barre remplace le
// champ (Supprimer, la durée et l'onde en direct, Arrêter pour réécouter, Envoyer).

const rien = () => () => undefined;

/** Le navigateur sait-il enregistrer ? (faux au rendu du serveur, puis lu dans le navigateur) */
export function useVocalPossible(): boolean {
  return useSyncExternalStore(rien, vocalPossible, () => false);
}

export function BoutonMicro({ onClick, disabled, className }: { onClick: () => void; disabled?: boolean; className?: string }) {
  return (
    <Button
      type="button"
      size="lg"
      iconLeft={Mic01Icon}
      onClick={onClick}
      disabled={disabled}
      aria-label="Enregistrer une note vocale"
      title="Enregistrer une note vocale"
      className={cn("flex-none px-4", className)}
    >
      <span className="sr-only">Note vocale</span>
    </Button>
  );
}

/** La barre d'enregistrement, puis l'aperçu de la note (à réécouter) avant de l'envoyer. */
export function BarreEnregistrement({
  enregistreur: e,
  envoi,
  onEnvoyer,
  className,
}: {
  enregistreur: EnregistreurVocal;
  envoi: boolean;
  onEnvoyer: (note: NoteEnregistree) => void;
  className?: string;
}) {
  async function envoyer() {
    const note = e.etat === "apercu" ? e.note : await e.arreter();
    if (note) onEnvoyer(note);
  }
  const restant = DUREE_MAX_MS - e.dureeMs;
  return (
    <div className={cn("flex min-w-0 items-center gap-1.5 max-sm:gap-1", className)}>
      <IconButton icon={Delete02Icon} label="Supprimer la note vocale" variant="discret" className="size-11 text-erreur-texte max-sm:size-10" disabled={envoi} onClick={e.annuler} />
      {e.etat === "apercu" && e.note ? (
        <div className="min-w-0 flex-1 rounded-champ bg-coque px-3 py-1.5">
          <LecteurVocal dureeMs={e.note.dureeMs} ondes={e.note.ondes} source={e.note.url} />
        </div>
      ) : (
        <div className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-champ bg-coque px-3.5 max-sm:h-10 max-sm:px-3" role="status" aria-live="polite">
          <span aria-hidden="true" className={cn("size-2.5 flex-none rounded-full bg-erreur-vif", e.etat === "enregistre" && "animate-pulse")} />
          <span className="flex-none text-sm leading-5 font-medium text-encre tabular-nums">
            {e.etat === "demande" ? "Autorisation du micro…" : dureeLisible(e.dureeMs)}
          </span>
          <span className="sr-only">{e.etat === "enregistre" ? "Enregistrement en cours" : ""}</span>
          <span aria-hidden="true" className="flex h-6 min-w-0 flex-1 items-center justify-end gap-[2px] overflow-hidden">
            {e.niveaux.map((n, i) => (
              <span key={i} style={{ height: `${Math.max(10, Math.min(100, Math.round(n * 400)))}%` }} className="w-[3px] flex-none rounded-full bg-bleu/70" />
            ))}
          </span>
          {e.etat === "enregistre" && restant <= 30_000 && <span className="flex-none text-xs leading-[18px] text-attention-texte tabular-nums">{`encore ${dureeLisible(restant)}`}</span>}
        </div>
      )}
      {e.etat === "enregistre" && (
        <IconButton icon={StopIcon} label="Arrêter pour réécouter" title="Arrêter pour réécouter" variant="discret" className="size-11 max-sm:size-10" onClick={() => void e.arreter()} />
      )}
      <Button
        type="button"
        size="lg"
        iconLeft={SentIcon}
        loading={envoi}
        disabled={e.etat === "demande"}
        onClick={() => void envoyer()}
        className="h-11 flex-none px-4 max-sm:h-10 max-sm:px-3"
      >
        <span className="max-sm:sr-only">Envoyer</span>
      </Button>
    </div>
  );
}
