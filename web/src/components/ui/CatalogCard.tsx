import { useId } from "react";
import { Clock01Icon, StarIcon } from "@hugeicons/core-free-icons";
import { CardShell, type CardTag } from "./CourseCard";
import type { Parcours } from "./CourseIllustration";
import { Icon } from "./Icon";
import { MetaDot } from "./Progress";

type CatalogCardProps = {
  href: string;
  title: string;
  description: string;
  parcours: Parcours;
  /** Note moyenne sur 5. */
  rating: number;
  reviews: number;
  /** « 6 h 00 ». */
  duration: string;
  /** « Débutant », « Intermédiaire »… */
  level: string;
  tag?: CardTag;
};

const formatNote = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Carte du catalogue : comme la carte de formation, avec note, durée et niveau à la place de la progression. */
export function CatalogCard({ href, title, description, parcours, rating, reviews, duration, level, tag }: CatalogCardProps) {
  const metaId = useId();
  const note = formatNote(rating);
  return (
    <CardShell href={href} title={title} description={description} parcours={parcours} tag={tag} describedBy={metaId}>
      <div aria-hidden="true" className="mt-4 h-px bg-bordure-carte" />
      <div id={metaId} className="mt-3 flex flex-wrap items-center gap-[7px] text-xs leading-[18px] text-discret">
        <span className="flex items-center gap-1">
          <Icon icon={StarIcon} size={16} className="-mx-px" />
          <span aria-hidden="true">
            {note} ({reviews})
          </span>
          <span className="sr-only">
            Note {note} sur 5, {reviews} avis
          </span>
        </span>
        <MetaDot />
        <span className="flex items-center gap-1">
          <Icon icon={Clock01Icon} size={18} className="-mx-[1.5px]" />
          <span>{duration}</span>
        </span>
        <MetaDot />
        <span>{level}</span>
      </div>
    </CardShell>
  );
}
