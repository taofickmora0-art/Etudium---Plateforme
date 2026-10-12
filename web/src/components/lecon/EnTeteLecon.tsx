import type { ReactNode } from "react";
import { Clock01Icon, TeachingIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/Icon";
import { MetaDot } from "@/components/ui/Progress";
import type { FicheFormation } from "@/lib/catalogue/types";
import { dureeLecon, situation } from "@/lib/lecon/regles";
import type { LeconDetail } from "@/lib/lecon/types";

const META = "flex flex-wrap items-center gap-[7px] text-sm leading-[22px] text-discret";

/** Une suite d'éléments séparés par des points. */
function Meta({ elements, className }: { elements: ReactNode[]; className: string }) {
  const visibles = elements.filter(Boolean);
  if (visibles.length === 0) return null;
  return (
    <div className={className}>
      {visibles.map((element, i) => (
        <span key={i} className="contents">
          {i > 0 && <MetaDot />}
          {element}
        </span>
      ))}
    </div>
  );
}

/**
 * En-tête de la leçon : un seul h1, 32/40 sur ordinateur (NdLecon §2.5), 20/28 sur téléphone (NdMobLecon §3.3).
 * Ordinateur : module au-dessus, puis formateur, durée et rang dans le module. Téléphone : module et formateur.
 */
export function EnTeteLecon({ fiche, lecon }: { fiche: FicheFormation; lecon: LeconDetail }) {
  const ou = situation(fiche.modules, lecon.id);
  const nomModule = ou ? `Module ${ou.numero} · ${ou.titreModule}` : "";
  const formateur = fiche.formateur?.nom ?? "";
  const duree = dureeLecon(lecon.dureeSecondes);
  return (
    <div>
      {nomModule && <p className="m-0 text-sm leading-[22px] text-pretty text-discret max-lg:hidden">{nomModule}</p>}
      <h1 className="m-0 text-xl leading-7 font-semibold text-balance text-encre lg:mt-1 lg:text-[32px] lg:leading-10 lg:font-medium lg:tracking-[-0.01em] lg:text-titre">
        {lecon.titre}
      </h1>
      <Meta
        className={`${META} mt-2.5 max-lg:hidden`}
        elements={[
          formateur && (
            <span className="flex items-center gap-1">
              <Icon icon={TeachingIcon} size={18} />
              <span>{formateur}</span>
            </span>
          ),
          duree && (
            <span className="flex items-center gap-1">
              <Icon icon={Clock01Icon} size={18} className="-mx-[1.5px]" />
              <span>{duree}</span>
            </span>
          ),
          ou && <span>{`Leçon ${ou.rang} sur ${ou.total} de ce module`}</span>,
        ]}
      />
      <Meta className={`${META} mt-1 lg:hidden`} elements={[nomModule && <span>{nomModule}</span>, formateur && <span>{formateur}</span>]} />
    </div>
  );
}
