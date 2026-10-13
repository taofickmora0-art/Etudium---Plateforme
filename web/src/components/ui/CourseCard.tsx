import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import Link from "next/link";
import { CourseIllustration, type Parcours } from "./CourseIllustration";
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
  children: ReactNode;
}) {
  const id = useId();
  const etiquettes = [parcoursTag, tag].filter((t): t is CardTag => Boolean(t));
  const classes = "box-border flex min-w-0 flex-col rounded-carte border border-bordure-carte bg-panneau px-[19px] pt-[22px] pb-[17px] text-inherit no-underline";
  const contenu = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="ml-1">
          <CourseIllustration parcours={parcours} />
        </span>
        {etiquettes.length > 0 && (
          <span id={`${id}-etiquette`} className="flex flex-wrap justify-end gap-1.5">
            {etiquettes.map((t) => (
              <Tag key={t.label} tone={t.tone}>
                {t.label}
              </Tag>
            ))}
          </span>
        )}
      </div>
      <Titre id={`${id}-titre`} title={title} className="mt-[21px] mb-0 truncate text-base leading-6 font-semibold text-encre">
        {title}
      </Titre>
      <p className="mt-[11px] mb-0 line-clamp-2 h-10 text-xs leading-5 text-discret">{description}</p>
      {children}
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
  /** Niveau du titre de la carte dans la page. */
  titleAs?: "h2" | "h3";
  /** Aucune étiquette, pas même « Verrouillée » : un bouton occupe le coin (cœur de la page Favoris). */
  sansEtiquette?: boolean;
};

/** Carte de formation : illustration, titre, deux lignes de description, progression. */
export function CourseCard({ href, title, description, parcours, progress, timeLabel, state, tag, titleAs, sansEtiquette = false }: CourseCardProps) {
  const metaId = useId();
  const shownTag = sansEtiquette ? undefined : state === "verrouillee" ? { tone: "verrouillee" as const, label: "Verrouillée" } : tag;
  return (
    <CardShell href={href} title={title} description={description} parcours={parcours} tag={shownTag} describedBy={metaId} titleAs={titleAs}>
      <ProgressBar value={progress} label={`Progression de ${title}`} className="mt-[17px] -ml-px" />
      <ProgressMeta id={metaId} value={progress} timeLabel={timeLabel} className="mt-2 flex-nowrap" />
    </CardShell>
  );
}
