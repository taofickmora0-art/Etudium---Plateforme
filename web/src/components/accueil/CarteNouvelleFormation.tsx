import Link from "next/link";
import { ArrowRight01Icon, CourseIcon } from "@hugeicons/core-free-icons";
import { buttonVariants } from "@/components/ui/Button";
import { Couverture } from "@/components/ui/Couverture";
import { Icon } from "@/components/ui/Icon";
import { Tag, type TagTone } from "@/components/ui/Tag";
import { cn } from "@/lib/cn";
import { parcoursPrincipal } from "@/lib/catalogue/regles";
import type { CarteCatalogue } from "@/lib/catalogue/types";
import { moment } from "@/lib/communaute/regles";
import { urlCouverture } from "@/lib/couvertures/adresse";

/**
 * Une formation mise en ligne depuis peu, dans le fil de l'Accueil (spec du nouvel Accueil, §2) : l'étiquette, le moment,
 * la couverture, le titre, le résumé et le parcours ; « Découvrir la formation » mène à sa fiche. Ce n'est pas une
 * publication : ni J’aime ni commentaires.
 */
export function CarteNouvelleFormation({ formation, maintenant }: { formation: CarteCatalogue; maintenant: Date }) {
  const parcours = [...formation.parcours].sort((a, b) => a.ordre - b.ordre)[0];
  return (
    <article
      aria-label={`Nouvelle formation : ${formation.titre}`}
      className="box-border flex min-w-0 flex-col gap-4 rounded-2xl border border-bordure-carte bg-panneau px-5 py-[18px] max-sm:gap-3 max-sm:px-4 max-sm:py-4 sm:flex-row sm:items-start"
    >
      {/* Sur ordinateur, la couverture à gauche : la carte garde la hauteur d'une publication. */}
      <Couverture src={urlCouverture(formation.couverture)} parcours={parcoursPrincipal(formation)} sizes="(max-width: 640px) 100vw, 220px" className="rounded-[12px] sm:w-[220px] sm:flex-none" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <Tag tone="nouveau" icon={CourseIcon}>
            Nouvelle formation
          </Tag>
          <span className="text-[13px] leading-5 text-discret max-sm:text-xs max-sm:leading-[18px]">{moment(formation.publieeLe, maintenant)}</span>
          {/* Le parcours en badge, à sa couleur (liste du 31 octobre 2026, tâche 15). */}
          {parcours && <Tag tone={parcoursPrincipal(formation) as TagTone}>{parcours.nomCourt}</Tag>}
        </div>
        <h3 className="m-0 mt-2 text-[17px] leading-[25px] font-semibold wrap-anywhere text-encre max-sm:text-base max-sm:leading-6">{formation.titre}</h3>
        {formation.resume && <p className="m-0 mt-1 line-clamp-2 text-[15px] leading-6 text-texte max-sm:text-sm max-sm:leading-[22px]">{formation.resume}</p>}
        <Link href={`/formations/${formation.slug}`} className={cn(buttonVariants({ variant: "contour", size: "sm" }), "mt-3.5 self-start")}>
          Découvrir la formation
          <Icon icon={ArrowRight01Icon} size={16} />
        </Link>
      </div>
    </article>
  );
}
