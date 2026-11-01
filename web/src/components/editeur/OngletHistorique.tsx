"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { restaurerVersion } from "@/lib/editeur/actions";
import { dateHeureVersion } from "@/lib/editeur/historique";
import type { VersionFormation } from "@/lib/editeur/types";

/**
 * L'onglet « Historique » d'une formation (fin du lot 4, spec §3.3) : chaque version publiée, la plus récente d'abord,
 * avec sa date, son auteur et ce qui a changé. Une version ancienne se restaure dans le brouillon : rien ne change pour
 * les étudiants avant « Publier les modifications ».
 */
export function OngletHistorique({ versions }: { versions: VersionFormation[] }) {
  const { toast } = useToast();
  const [choisie, setChoisie] = useState<VersionFormation | null>(null);
  return (
    <div className="flex max-w-[680px] flex-col gap-4 rounded-carte border border-bordure-carte bg-panneau p-6 max-sm:p-4">
      <p className="m-0 text-sm leading-[22px] text-discret">
        Une version est gardée à chaque mise en ligne et à chaque publication de modifications. Les questions des quiz, les fichiers et la couverture
        n’y sont pas.
      </p>
      <ul aria-label="Versions de la formation" className="m-0 flex list-none flex-col p-0">
        {versions.map((v) => (
          <li key={v.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 border-t border-bordure-carte py-3.5 first:border-t-0 first:pt-0">
            <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] leading-[22px] font-semibold text-encre">{`Version ${v.numero}`}</span>
                {v.enLigne && <Tag tone="reussi">En ligne</Tag>}
              </span>
              <span className="text-[13px] leading-5 text-discret">{`${v.creeLe ? dateHeureVersion(v.creeLe) : ""} · par ${v.auteur ?? "un compte supprimé"}`}</span>
              <span className="text-sm leading-[22px] text-texte">{v.resume}</span>
            </div>
            {!v.enLigne && (
              <Button size="sm" variant="contour" aria-label={`Restaurer la version ${v.numero} dans le brouillon`} onClick={() => setChoisie(v)}>
                Restaurer dans le brouillon
              </Button>
            )}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={choisie !== null}
        onOpenChange={(ouverte) => !ouverte && setChoisie(null)}
        title={`Restaurer la version ${choisie?.numero ?? ""} ?`}
        description={`Le contenu de la version ${choisie?.numero ?? ""} revient dans le brouillon. Les étudiants ne verront rien changer avant « Publier les modifications ».`}
        confirmLabel="Restaurer"
        onConfirm={async () => {
          if (!choisie) return;
          const r = await restaurerVersion(choisie.id);
          if (!r.ok) throw new Error(r.message);
          toast({ tone: "reussite", title: r.message ?? "Version restaurée dans le brouillon." });
        }}
      />
    </div>
  );
}
