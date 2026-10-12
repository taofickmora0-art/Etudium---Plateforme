"use client";

import { useState } from "react";
import {
  Doc01Icon,
  Download04Icon,
  File01Icon,
  Image01Icon,
  Pdf01Icon,
  Ppt01Icon,
  ViewIcon,
  Xls01Icon,
  Zip01Icon,
} from "@hugeicons/core-free-icons";
import { Icon, type IconSvgElement } from "@/components/ui/Icon";
import { formatParMime } from "@/lib/admin/fichiers";
import { cn } from "@/lib/cn";
import { lienRessource } from "@/lib/lecon/actions";
import { metaRessource } from "@/lib/lecon/regles";
import type { RessourceLecon } from "@/lib/lecon/types";

/** Icône du format (le design n'en montre qu'une ; une par famille aide à reconnaître le fichier). */
function iconeDu(format: string): IconSvgElement {
  const label = formatParMime(format)?.label;
  if (format === "application/pdf") return Pdf01Icon;
  if (format.startsWith("image/")) return Image01Icon;
  if (label === "Excel" || label === "CSV") return Xls01Icon;
  if (label === "Word") return Doc01Icon;
  if (label === "PowerPoint") return Ppt01Icon;
  if (label === "ZIP") return Zip01Icon;
  return File01Icon;
}

// Ordinateur : bouton secondaire de 34 px avec texte (NdLecon §2.9) ; téléphone : bouton icône de 44 px (NdMobLecon §3.6).
const BOUTON = cn(
  "focus-etudium inline-flex flex-none cursor-pointer items-center justify-center gap-2 font-medium whitespace-nowrap text-texte transition-colors",
  "size-11 rounded-champ bg-transparent hover:bg-coque",
  "lg:h-[34px] lg:w-auto lg:rounded-puce lg:border lg:border-bordure lg:bg-panneau lg:px-3 lg:text-[13px] lg:hover:bg-page",
  "disabled:cursor-not-allowed disabled:opacity-45",
);

function ContenuBouton({ icone, libelle }: { icone: IconSvgElement; libelle: string }) {
  return (
    <>
      <Icon icon={icone} size={20} className="lg:hidden" />
      <Icon icon={icone} size={16} className="max-lg:hidden" />
      <span className="max-lg:hidden">{libelle}</span>
    </>
  );
}

/** Onglet « Ressources » : les fichiers de la leçon. Le téléchargement passe par un lien temporaire (60 s). */
export function RessourcesLecon({ ressources }: { ressources: RessourceLecon[] }) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  if (ressources.length === 0) return <p className="m-0 text-sm leading-[22px] text-discret">Aucune ressource pour cette leçon.</p>;

  const telecharger = async (r: RessourceLecon) => {
    setErreur(null);
    setEnCours(r.id);
    const reponse = await lienRessource(r.id);
    setEnCours(null);
    if ("url" in reponse) window.location.assign(reponse.url);
    else setErreur(reponse.erreur);
  };

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      {erreur && (
        <p role="alert" className="m-0 text-sm leading-[22px] text-erreur-texte">
          {erreur}
        </p>
      )}
      <ul className="m-0 flex min-w-0 list-none flex-col gap-2.5 p-0">
        {ressources.map((r) => (
          <li key={r.id} className="flex min-w-0 items-center gap-3 rounded-bouton border border-bordure-carte px-3.5 py-3">
            <span className="flex size-10 flex-none items-center justify-center rounded-champ bg-coque text-texte">
              <Icon icon={iconeDu(r.format)} size={18} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm leading-5 font-medium text-encre">{r.titre}</span>
              <span className="text-xs leading-[18px] text-discret">{metaRessource(r)}</span>
            </span>
            {r.telechargeable ? (
              <button
                type="button"
                aria-label={`Télécharger ${r.titre}`}
                aria-busy={enCours === r.id || undefined}
                disabled={enCours === r.id}
                onClick={() => telecharger(r)}
                className={BOUTON}
              >
                <ContenuBouton icone={Download04Icon} libelle="Télécharger" />
              </button>
            ) : (
              // Le visualiseur intégré (consultation sans téléchargement) arrive avec la tâche 1.8.
              <button type="button" aria-label={`Consulter ${r.titre}`} disabled title="Bientôt disponible" className={BOUTON}>
                <ContenuBouton icone={ViewIcon} libelle="Consulter" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
