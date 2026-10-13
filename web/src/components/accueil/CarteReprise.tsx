import { useId } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { CourseIllustration } from "@/components/ui/CourseIllustration";
import { ProgressBar, ProgressMeta } from "@/components/ui/Progress";
import { Tag } from "@/components/ui/Tag";
import type { Reprise } from "@/lib/accueil/regles";

/**
 * « Continuer l’apprentissage » (annexe 1.10 §3.4, téléphone §4.3) : la carte n'est pas un lien, seuls ses boutons le
 * sont. Sur téléphone : ni étiquette ni « Voir le parcours », et « Reprendre la leçon » prend toute la largeur.
 */
export function CarteReprise({ reprise }: { reprise: Reprise }) {
  const titre = useId();
  return (
    <div className="box-border flex min-w-0 flex-col rounded-carte border border-bordure-carte bg-panneau px-[19px] pt-[22px] pb-[17px] max-sm:px-4 max-sm:pt-[18px] max-sm:pb-4">
      <div className="flex items-start gap-4 max-sm:gap-3.5">
        <span className="ml-1 flex flex-none max-sm:ml-0">
          <CourseIllustration parcours={reprise.parcours} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 id={titre} className="m-0 text-base leading-6 font-semibold text-encre wrap-anywhere">
            {reprise.titre}
          </h3>
          <p className="m-0 text-[13px] leading-5 text-pretty text-discret wrap-anywhere max-sm:text-sm max-sm:leading-[22px]">{reprise.sousTitre}</p>
        </div>
        {reprise.etiquette && (
          <Tag tone={reprise.etiquette.tone} className="flex-none max-sm:hidden">
            {reprise.etiquette.libelle}
          </Tag>
        )}
      </div>
      <ProgressBar value={reprise.pourcentage} label={`Progression de ${reprise.titre}`} className="mt-5 max-sm:mt-4" />
      <ProgressMeta value={reprise.pourcentage} timeLabel={reprise.temps} className="mt-2" />
      <div className="mt-[18px] flex flex-wrap items-center gap-2 max-sm:mt-4">
        <Button asChild className="max-sm:h-12 max-sm:w-full max-sm:rounded-bouton max-sm:px-[18px] max-sm:text-base">
          <Link href={reprise.href} aria-describedby={titre}>
            Reprendre la leçon
          </Link>
        </Button>
        {reprise.lienParcours && (
          <Button asChild variant="gris" className="max-sm:hidden">
            <Link href={reprise.lienParcours} aria-describedby={titre}>
              Voir le parcours
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
