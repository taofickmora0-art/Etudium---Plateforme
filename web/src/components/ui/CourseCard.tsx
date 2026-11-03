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
  sousTitre,
  horsLien,
  coinGaucheOccupe = false,
  formatCouverture = "formation",
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
  /** Une ligne entre le titre et la description (« 4 modules • 12 leçons » du catalogue). */
  sousTitre?: ReactNode;
  /**
   * Un élément interactif posé sur la carte mais hors de son lien (le cœur favori du catalogue) : il se place lui-même
   * (position absolue dans la carte). Jamais un bouton dans un lien.
   */
  horsLien?: ReactNode;
  /**
   * L'élément hors lien occupe le coin haut gauche de la couverture (menu ⋮ du back-office) : les étiquettes, alignées à
   * droite, lui laissent sa place même quand elles remplissent la ligne.
   */
  coinGaucheOccupe?: boolean;
  /** « livre » : la couverture d'un livre de la Bibliothèque, montrée entière (voir Couverture). */
  formatCouverture?: "formation" | "livre";
  children: ReactNode;
}) {
  const id = useId();
  const etiquettes = [parcoursTag, tag].filter((t): t is CardTag => Boolean(t));
  const classes = "box-border flex min-w-0 flex-col overflow-hidden rounded-carte border border-bordure-carte bg-panneau text-inherit no-underline";
  const contenu = (
    <>
      {/* La couverture en haut, sur toute la largeur ; les étiquettes posées dessus (spec des couvertures). */}
      <div data-couverture="" className="relative">
        <Couverture src={couverture} parcours={parcours} sizes="(max-width: 640px) 100vw, 360px" format={formatCouverture} />
        {etiquettes.length > 0 && (
          <span id={`${id}-etiquette`} className={cn("absolute top-3 right-3 left-3 flex flex-wrap justify-end gap-1.5", coinGaucheOccupe && "left-[58px]")}>
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
        <Titre id={`${id}-titre`} title={title} className="m-0 line-clamp-2 min-h-12 text-base leading-6 font-semibold text-encre wrap-anywhere max-sm:min-h-11 max-sm:text-[15px] max-sm:leading-[22px]">
          {title}
        </Titre>
        {sousTitre}
        <p className={cn("mb-0 line-clamp-2 h-10 text-xs leading-5 text-discret", sousTitre ? "mt-2" : "mt-[11px]")}>{description}</p>
        {children}
      </div>
    </>
  );
  const carte = !href ? (
    <div className={cn(classes, horsLien && "flex-1")}>{contenu}</div>
  ) : (
    <Link
      href={href}
      aria-labelledby={etiquettes.length > 0 ? `${id}-titre ${id}-etiquette` : `${id}-titre`}
      aria-describedby={describedBy}
      className={cn(classes, "group focus-etudium transition-colors hover:border-bordure-champ", horsLien && "flex-1")}
    >
      {contenu}
    </Link>
  );
  if (!horsLien) return carte;
  // Le lien et l'élément posé dessus sont frères : la carte garde un seul lien, et le bouton n'y est pas imbriqué.
  return (
    <div className="relative flex min-w-0 flex-col">
      {carte}
      {horsLien}
    </div>
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
  /** L'étiquette d'une carte verrouillée (« Indisponible » pour une formation désactivée) ; par défaut « Verrouillée ». */
  lockLabel?: string;
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
export function CourseCard({
  href,
  title,
  description,
  parcours,
  progress,
  timeLabel,
  state,
  tag,
  lockLabel = "Verrouillée",
  parcoursTag,
  titleAs,
  sansEtiquette = false,
  couverture = null,
}: CourseCardProps) {
  const metaId = useId();
  const shownTag = sansEtiquette ? undefined : state === "verrouillee" ? { tone: "verrouillee" as const, label: lockLabel } : tag;
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
