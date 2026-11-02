import { useId, type ReactNode } from "react";
import { Clock01Icon, StarIcon, UserMultipleIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/cn";
import { buttonVariants } from "./Button";
import { CardShell, type CardTag } from "./CourseCard";
import type { Parcours } from "./CourseIllustration";
import { Icon } from "./Icon";
import { MetaDot } from "./Progress";

type CatalogCardProps = {
  href: string;
  title: string;
  description: string;
  parcours: Parcours;
  /** Note moyenne sur 5 ; absente tant que la formation n'a pas d'avis. */
  rating?: number;
  reviews?: number;
  /** « 6 h 00 » ; absente si la durée n'est pas connue. */
  duration?: string;
  /** « Débutant », « Intermédiaire »… */
  level: string;
  tag?: CardTag;
  /** Adresse de l'image de couverture ; null : couverture par défaut du parcours. */
  couverture?: string | null;
  /** Puce du parcours, avant le badge (catalogue public). */
  parcoursTag?: CardTag;
  titleAs?: "h2" | "h3";
  /** « 4 modules • 12 leçons », sous le titre ; absent : pas de ligne. */
  programme?: string;
  /** « 34 apprenants », à droite du programme ; absent (nombre inconnu) : rien. */
  apprenants?: string;
  /** Le bouton du bas, pleine largeur (« Voir le cours », « 40 % terminé ») ; absent : pas de bouton. */
  action?: string;
  /** Le cœur favori, à droite du bouton du bas, hors du lien de la carte ; absent : pas de cœur (visiteur). */
  coeur?: ReactNode;
};

const formatNote = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * Carte du catalogue (spec du 2 novembre 2026, §4) : couverture, titre, programme et apprenants, résumé, note · durée ·
 * niveau, puis le bouton du bas et le cœur. Toute la carte est un seul lien ; le bouton du bas en fait partie (c'est son
 * aspect, pas un second lien), le cœur est un bouton posé à côté, hors du lien.
 */
export function CatalogCard({
  href,
  title,
  description,
  parcours,
  rating,
  reviews,
  duration,
  level,
  tag,
  parcoursTag,
  titleAs,
  couverture = null,
  programme,
  apprenants,
  action,
  coeur,
}: CatalogCardProps) {
  const id = useId();
  const avecNote = rating !== undefined && reviews !== undefined && reviews > 0;
  const note = avecNote ? formatNote(rating) : "";
  const elements = [
    avecNote && (
      <span key="note" className="flex items-center gap-1">
        <Icon icon={StarIcon} size={16} className="-mx-px" />
        <span aria-hidden="true">
          {note} ({reviews})
        </span>
        <span className="sr-only">
          Note {note} sur 5, {reviews} avis
        </span>
      </span>
    ),
    duration && (
      <span key="duree" className="flex items-center gap-1">
        <Icon icon={Clock01Icon} size={18} className="-mx-[1.5px]" />
        <span>{duration}</span>
      </span>
    ),
    <span key="niveau">{level}</span>,
  ].filter(Boolean);
  // Le programme à gauche, les apprenants à droite ; faute de place, les apprenants passent à la ligne.
  const sousTitre = (programme || apprenants) && (
    <div
      id={`${id}-programme`}
      className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-xs leading-[18px] text-discret max-sm:text-[11.5px]"
    >
      {programme && <span>{programme}</span>}
      {apprenants && (
        <span className="flex items-center gap-1">
          <Icon icon={UserMultipleIcon} size={16} className="flex-none max-sm:size-[15px]" />
          <span>{apprenants}</span>
        </span>
      )}
    </div>
  );
  const decrit = [sousTitre && `${id}-programme`, `${id}-meta`, action && `${id}-action`].filter(Boolean).join(" ");
  return (
    <CardShell
      href={href}
      title={title}
      description={description}
      parcours={parcours}
      tag={tag}
      parcoursTag={parcoursTag}
      titleAs={titleAs}
      describedBy={decrit}
      couverture={couverture}
      sousTitre={sousTitre || undefined}
      horsLien={
        coeur && action ? (
          // Aligné sur le bouton du bas : bord de la carte (1 px) + marge intérieure (19 px à droite, 17 px en bas).
          <div className="absolute right-5 bottom-[18px] flex">{coeur}</div>
        ) : undefined
      }
    >
      <div id={`${id}-meta`} className="mt-3 flex flex-wrap items-center gap-[7px] text-xs leading-[18px] text-discret max-sm:text-[11.5px]">
        {elements.flatMap((element, index) => (index === 0 ? [element] : [<MetaDot key={`point-${index}`} />, element]))}
      </div>
      {action && (
        <div className="mt-auto flex gap-2 pt-4 max-sm:pt-3.5">
          {/* L'aspect d'un bouton doux : la carte entière est le lien. */}
          <span
            id={`${id}-action`}
            className={cn(
              buttonVariants({ variant: "doux" }),
              // 13 px : « 100 % terminé » tient sur une ligne dans une carte de 200 px ; plus étroite, il passe à la ligne.
              "h-auto min-h-10 min-w-0 flex-1 px-2.5 py-1.5 text-center text-[13px] leading-[18px] whitespace-normal group-hover:bg-bleu-pale",
              "max-sm:min-h-9 max-sm:text-[12.5px] max-sm:leading-4",
            )}
          >
            {action}
          </span>
          {/* La place du cœur, posé par-dessus hors du lien. */}
          {coeur && <span aria-hidden="true" className="w-10 flex-none max-sm:w-9" />}
        </div>
      )}
    </CardShell>
  );
}
