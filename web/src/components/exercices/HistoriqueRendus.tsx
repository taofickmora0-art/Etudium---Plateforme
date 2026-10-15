"use client";

import { useId } from "react";
import { Download04Icon } from "@hugeicons/core-free-icons";
import { IconButton } from "@/components/ui/IconButton";
import { Tag, type TagTone } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { moment } from "@/lib/communaute/regles";
import { lienRendu } from "@/lib/exercices/actions";
import { LIBELLES_STATUT, type StatutRendu, type VersionRendu } from "@/lib/exercices/types";

export const TONS_STATUT: Record<StatutRendu, TagTone> = { en_attente: "enAttente", a_corriger: "aCorriger", valide: "valide" };
const ECHEC = "Le fichier n’a pas pu être ouvert. Réessayez.";
const majuscule = (texte: string) => texte.charAt(0).toUpperCase() + texte.slice(1);

/**
 * « Historique des rendus » (NdExercice, NdCorrection) : chaque version, son statut, son fichier à télécharger, le message
 * de l'étudiant et la remarque (ou le commentaire) du correcteur. La plus récente en premier.
 */
export function HistoriqueRendus({ versions, vue = "etudiant" }: { versions: VersionRendu[]; vue?: "etudiant" | "correcteur" }) {
  const titre = useId();
  const { toast } = useToast();
  const maintenant = new Date();

  async function telecharger(version: VersionRendu) {
    const reponse = await lienRendu(version.id).catch(() => ({ erreur: ECHEC }));
    if ("url" in reponse) window.location.assign(reponse.url);
    else toast({ tone: "erreur", title: reponse.erreur });
  }

  return (
    <section aria-labelledby={titre} className="flex min-w-0 flex-col gap-2">
      <h3 id={titre} className="m-0 text-base leading-6 font-semibold text-encre max-sm:text-[15px]">
        Historique des rendus
      </h3>
      <ol aria-labelledby={titre} className="m-0 flex list-none flex-col p-0 [&>li+li]:border-t [&>li+li]:border-separateur">
        {versions.map((v) => (
          <li key={v.id} className="flex min-w-0 flex-col gap-1.5 py-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-[15px] leading-[22px] font-semibold text-encre max-sm:text-sm">{`Version ${v.version}`}</span>
              <Tag tone={TONS_STATUT[v.statut]}>{LIBELLES_STATUT[v.statut]}</Tag>
            </div>
            <div className="flex min-w-0 items-center gap-2 text-[13px] leading-5 text-discret">
              <span className="min-w-0 truncate">{[majuscule(moment(v.creeLe, maintenant)), v.aUnFichier && v.nomFichier].filter(Boolean).join(" · ")}</span>
              {v.aUnFichier && (
                <IconButton icon={Download04Icon} label={`Télécharger ${v.nomFichier}`} variant="discret" size="sm" onClick={() => void telecharger(v)} className="flex-none" />
              )}
            </div>
            {v.message && (
              <p className="m-0 text-[13px] leading-5 text-texte">{`${vue === "etudiant" ? "Votre message" : "Message de l’étudiant"} : ${v.message}`}</p>
            )}
            {v.remarque && (
              <p className="m-0 rounded-champ bg-page px-3 py-2 text-[13px] leading-5 text-texte">
                {`${v.statut === "valide" ? "Commentaire" : "Remarque"} de ${v.correcteur ?? "votre formateur"} : ${v.remarque}`}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
