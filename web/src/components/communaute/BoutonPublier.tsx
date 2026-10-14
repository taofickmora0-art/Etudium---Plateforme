"use client";

import { useRef, useState } from "react";
import { ArrowDown01Icon, CalendarClockIcon, Cancel01Icon, SentIcon } from "@hugeicons/core-free-icons";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { Menu } from "@/components/ui/Menu";
import { cn } from "@/lib/cn";
import { phraseSession } from "@/lib/sessions/regles";
import { FenetreProgrammation } from "./FenetreProgrammation";

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
  const [fenetre, setFenetre] = useState(false);
  // La fenêtre s'ouvre depuis le menu : il ne reprend pas le focus en se fermant.
  const fenetreDemandee = useRef(false);

  function ouvrir() {
    fenetreDemandee.current = true;
    setFenetre(true);
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
      <FenetreProgrammation
        open={fenetre}
        onOpenChange={setFenetre}
        titre="Programmer la publication"
        description="Heure du Bénin. Elle paraîtra en haut du fil à cette heure-là ; d’ici là, vous seul la voyez (onglet « Programmées »)."
        valider="Programmer"
        initiale={publieLe}
        onValider={async (iso) => {
          onProgrammer(iso);
          return null;
        }}
      />
    </div>
  );
}
