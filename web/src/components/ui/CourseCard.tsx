import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import Link from "next/link";
import type { Parcours } from "./CourseIllustration";
import { Couverture } from "./Couverture";
import { ProgressBar, ProgressMeta } from "./Progress";
import { Tag, type TagTone } from "./Tag";

export type CardTag = { tone: TagTone; label: string };

/** Coque commune des cartes de formation et de catalogue (planche « Cartes ») : bordure #EAEEF7, rayon 16. */
export function CardShell({
  href,
  title,
  description,
  parcours,
  tag,
  parcoursTag,
  titleAs: Titre = "h3",
  describedBy,
  couverture = null,
  children,
}: {
  /** Sans adresse, la carte n'est pas un lien (formation verrouillée dont la fiche n'existe plus). */
  href?: string | null;
  title: string;
  description: string;
  parcours: Parcours;
  tag?: CardTag;
  /** Puce du parcours, avant le badge (carte du catalogue public). */
  parcoursTag?: CardTag;
  /** Niveau du titre de la carte dans la page. */
  titleAs?: "h2" | "h3";
  describedBy?: string;
  /** Adresse de l'image de couverture ; null : couverture par défaut du parcours. */
  couverture?: string | null;
  children: ReactNode;
}) {
  const id = useId();
  const etiquettes = [parcoursTag, tag].filter((t): t is CardTag => Boolean(t));
  const classes = "box-border flex min-w-0 flex-col overflow-hidden rounded-carte border border-bordure-carte bg-panneau text-inherit no-underline";
  const contenu = (
    <>
      {/* La couverture en haut, sur toute la largeur ; les étiquettes posées dessus (spec des couvertures). */}
      <div data-couverture="" className="relative">
        <Couverture src={couverture} parcours={parcours} sizes="(max-width: 640px) 100vw, 360px" />
        {etiquettes.length > 0 && (
          <span id={`${id}-etiquette`} className="absolute top-3 right-3 left-3 flex flex-wrap justify-end gap-1.5">
            {/* Anneau blanc : le badge reste lisible sur une photo, ou sur la couverture par défaut de sa couleur. */}
            {etiquettes.map((t) => (
              <Tag key={t.label} tone={t.tone} className="ring-2 ring-white">
                {t.label}
              </Tag>
            ))}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col px-[19px] pt-4 pb-[17px]">
        <Titre id={`${id}-titre`} title={title} className="m-0 truncate text-base leading-6 font-semibold text-encre">
          {title}
        </Titre>
        <p className="mt-[11px] mb-0 line-clamp-2 h-10 text-xs leading-5 text-discret">{description}</p>
        {children}
      </div>
    </>
  );
  if (!href) return <div className={classes}>{contenu}</div>;
  return (
    <Link
      href={href}
      aria-labelledby={etiquettes.length > 0 ? `${id}-titre ${id}-etiquette` : `${id}-titre`}
      aria-describedby={describedBy}
      className={cn(classes, "focus-etudium transition-colors hover:border-bordure-champ")}
    >
      {contenu}
    </Link>
  );
}

type CourseCardProps = {
  /** Sans adresse, la carte n'est pas un lien. */
  href: string | null;
  title: string;
  description: string;
  parcours: Parcours;
  /** 0 à 100. */
  progress: number;
  /** « 2 h restantes », « 4 h 10 suivies », « Accès expiré ». */
  timeLabel: string;
  state: "enCours" | "terminee" | "aCommencer" | "verrouillee";
  /** Étiquette en haut à droite (« Populaire ») ; une carte verrouillée affiche toujours « Verrouillée ». */
  tag?: CardTag;
  /** Le badge du parcours (« Académique »), avant l'étiquette. */
  parcoursTag?: CardTag;
  /** Niveau du titre de la carte dans la page. */
  titleAs?: "h2" | "h3";
  /** Aucune étiquette, pas même « Verrouillée » : un bouton occupe le coin (cœur de la page Favoris). */
  sansEtiquette?: boolean;
  /** Adresse de l'image de couverture ; null : couverture par défaut du parcours. */
  couverture?: string | null;
};

/** Carte de formation : illustration, titre, deux lignes de description, progression. */
export function CourseCard({ href, title, description, parcours, progress, timeLabel, state, tag, parcoursTag, titleAs, sansEtiquette = false, couverture = null }: CourseCardProps) {
  const metaId = useId();
  const shownTag = sansEtiquette ? undefined : state === "verrouillee" ? { tone: "verrouillee" as const, label: "Verrouillée" } : tag;
  return (
    <CardShell
      href={href}
      title={title}
      description={description}
      parcours={parcours}
      tag={shownTag}
      parcoursTag={sansEtiquette ? undefined : parcoursTag}
      describedBy={metaId}
      titleAs={titleAs}
      couverture={couverture}
    >
      <ProgressBar value={progress} label={`Progression de ${title}`} className="mt-[17px] -ml-px" />
      <ProgressMeta id={metaId} value={progress} timeLabel={timeLabel} className="mt-2 flex-nowrap" />
    </CardShell>
  );
}
