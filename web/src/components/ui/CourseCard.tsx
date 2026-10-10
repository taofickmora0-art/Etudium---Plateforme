import { useId, type ReactNode } from "react";
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
  describedBy,
  children,
}: {
  href: string;
  title: string;
  description: string;
  parcours: Parcours;
  tag?: CardTag;
  describedBy?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <Link
      href={href}
      aria-labelledby={tag ? `${id}-titre ${id}-etiquette` : `${id}-titre`}
      aria-describedby={describedBy}
      className="focus-etudium box-border flex min-w-0 flex-col rounded-carte border border-bordure-carte bg-panneau px-[19px] pt-[22px] pb-[17px] text-inherit no-underline transition-colors hover:border-bordure-champ"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="ml-1">
          <CourseIllustration parcours={parcours} />
        </span>
        {tag && (
          <span id={`${id}-etiquette`}>
            <Tag tone={tag.tone}>{tag.label}</Tag>
          </span>
        )}
      </div>
      <h3 id={`${id}-titre`} title={title} className="mt-[21px] mb-0 truncate text-base leading-6 font-semibold text-encre">
        {title}
      </h3>
      <p className="mt-[11px] mb-0 line-clamp-2 h-10 text-xs leading-5 text-discret">{description}</p>
      {children}
    </Link>
  );
}

type CourseCardProps = {
  href: string;
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
};

/** Carte de formation : illustration, titre, deux lignes de description, progression. */
export function CourseCard({ href, title, description, parcours, progress, timeLabel, state, tag }: CourseCardProps) {
  const metaId = useId();
  const shownTag = state === "verrouillee" ? { tone: "verrouillee" as const, label: "Verrouillée" } : tag;
  return (
    <CardShell href={href} title={title} description={description} parcours={parcours} tag={shownTag} describedBy={metaId}>
      <ProgressBar value={progress} label={`Progression de ${title}`} className="mt-[17px] -ml-px" />
      <ProgressMeta id={metaId} value={progress} timeLabel={timeLabel} className="mt-2 flex-nowrap" />
    </CardShell>
  );
}
