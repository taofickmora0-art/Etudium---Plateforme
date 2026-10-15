import Link from "next/link";
import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { ListeCochee } from "@/components/catalogue/BlocsFiche";
import { CourseIllustration } from "@/components/ui/CourseIllustration";
import { Icon } from "@/components/ui/Icon";
import type { ParcoursCatalogue } from "@/lib/catalogue/types";
import { cn } from "@/lib/cn";
import type { CouleurParcours } from "@/lib/contenus/libelles";
import { POINTS_PARCOURS } from "@/lib/landing/textes";
import { EnTeteSection, SECTION_BLANCHE } from "./BlocsLanding";

/** Fond de la carte, couleur d'accent (surtitre, coches, survol du lien) selon la couleur du parcours. */
const COULEURS: Record<CouleurParcours, { fond: string; accent: string; survol: string }> = {
  academique: { fond: "bg-bleu-clair", accent: "text-bleu", survol: "hover:text-bleu" },
  digital: { fond: "bg-[#F3F0FE]", accent: "text-premium-texte", survol: "hover:text-premium-texte" },
  business: { fond: "bg-[#FFF3E6]", accent: "text-business-texte", survol: "hover:text-business-texte" },
};

/** Carte d'un parcours (CARTE-PARCOURS) : nom et description de la base, six points fixes, lien vers ses formations. */
function CarteParcours({ parcours }: { parcours: ParcoursCatalogue }) {
  const { fond, accent, survol } = COULEURS[parcours.couleur] ?? COULEURS.academique;
  const points = POINTS_PARCOURS[parcours.slug] ?? [];
  return (
    <div className={cn("box-border flex min-w-0 flex-col rounded-bloc p-[clamp(22px,2.6vw,32px)] max-sm:p-5", fond)}>
      <span className="flex size-[92px] items-center justify-center rounded-panneau bg-panneau max-sm:size-[72px] max-sm:rounded-[22px] max-sm:[&_svg]:size-12">
        <CourseIllustration parcours={parcours.couleur} size={62} />
      </span>
      <span className={cn("mt-[26px] text-[13px] leading-5 font-semibold tracking-[0.04em] uppercase max-sm:mt-4", accent)}>Parcours</span>
      <h3 className="mt-1 mb-0 min-h-16 text-[26px] leading-8 font-semibold tracking-[-0.02em] text-encre max-sm:min-h-0 max-sm:text-[22px] max-sm:leading-7">
        {parcours.nom}
      </h3>
      {parcours.description && <p className="mt-3 mb-0 min-h-24 text-[15px] leading-6 text-pretty text-texte max-sm:min-h-0">{parcours.description}</p>}
      <div className="flex-1">
        {points.length > 0 && (
          <>
            <div aria-hidden="true" className="mt-[22px] mb-5 h-px bg-encre/10 max-sm:mt-4 max-sm:mb-4" />
            <ListeCochee elements={points} couleur={accent} taille="text-sm" colonnes="grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-2.5" />
          </>
        )}
      </div>
      <Link
        href={`/formations?parcours=${parcours.slug}`}
        className={cn(
          "focus-etudium mt-[26px] box-border flex min-h-12 items-center justify-between gap-2 rounded-bouton bg-panneau px-4 py-2.5 text-[15px] leading-[22px] font-semibold text-encre no-underline transition-colors max-sm:mt-5",
          survol,
        )}
      >
        <span>
          Voir les formations du parcours{" "}
          <span className="sr-only">{parcours.nom}</span>
        </span>
        <Icon icon={ArrowRight02Icon} size={18} />
      </Link>
    </div>
  );
}

/**
 * Les trois parcours (NdLanding §6), cible de « Parcours » : les parcours actifs de la base, dans leur ordre. Sans
 * parcours lus, la section garde son titre (l'ancre de l'en-tête reste valable).
 */
export function SectionParcours({ parcours }: { parcours: ParcoursCatalogue[] }) {
  return (
    <section id="parcours" aria-labelledby="titre-parcours" className={SECTION_BLANCHE}>
      <EnTeteSection
        pastille="Trois parcours au lancement"
        ton="bleu"
        titre="Choisissez la direction qui vous ressemble"
        idTitre="titre-parcours"
        chapeau="Chaque parcours regroupe des formations qui se complètent. D’autres parcours arriveront."
      />
      {parcours.length > 0 && (
        <div className="mt-10 grid grid-cols-[repeat(auto-fill,minmax(min(100%,max(290px,calc((100%-40px)/3))),1fr))] gap-5 max-sm:mt-6 max-sm:gap-3">
          {parcours.map((p) => (
            <CarteParcours key={p.slug} parcours={p} />
          ))}
        </div>
      )}
    </section>
  );
}
