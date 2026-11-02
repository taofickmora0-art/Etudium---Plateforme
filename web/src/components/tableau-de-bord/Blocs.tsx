import { useId, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight01Icon,
  Award01Icon,
  BookOpen01Icon,
  Certificate01Icon,
  CheckmarkCircle02Icon,
  FireIcon,
  PlayCircleIcon,
  QuizIcon,
  Target02Icon,
  Task01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { Icon, type IconSvgElement } from "@/components/ui/Icon";
import { IconTile, type IconTileTone } from "@/components/ui/IconTile";
import { ProgressBar, ProgressMeta } from "@/components/ui/Progress";
import { StatCard } from "@/components/ui/StatCard";
import { Tag, type TagTone } from "@/components/ui/Tag";
import { BADGES, estCodeBadge, jours } from "@/lib/engagement/regles";
import type { ProgressionJeu } from "@/lib/engagement/types";
import { quandActivite } from "@/lib/tableau-de-bord/regles";
import type { AContinuer, BaseTableau, ElementAFaire, Indicateurs as DonneesIndicateurs } from "@/lib/tableau-de-bord/types";

// Les blocs du tableau de bord de l'étudiant (design NdAccueil ; lot 6 B, §1).

const LIEN = "focus-etudium text-sm leading-[22px] font-medium text-bleu no-underline hover:underline";
const CARTE = "box-border flex min-w-0 flex-col rounded-carte border border-bordure-carte bg-panneau";
export const GRILLE_INDICATEURS = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,max(228px,calc((100%-60px)/4))),1fr))] gap-5";

/** Une section titrée (h2 de 20 px au-dessus de sa carte), avec un lien ou une pastille à côté du titre. */
export function Section({ titre, lien, pastille, children }: { titre: string; lien?: { href: string; texte: string }; pastille?: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 id={id} className="m-0 text-xl leading-7 font-semibold text-encre max-sm:text-lg max-sm:leading-[26px]">
            {titre}
          </h2>
          {pastille && <Tag tone="enAttente">{pastille}</Tag>}
        </div>
        {lien && (
          <Link href={lien.href} className={LIEN}>
            {lien.texte}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Indicateur({ children }: { children: ReactNode }) {
  return (
    <div data-testid="indicateur" className="flex min-w-0 flex-col">
      {children}
    </div>
  );
}

/** Où en suis-je : progression globale, formations en cours, certificats, série. */
export function Indicateurs({ indicateurs: i, base }: { indicateurs: DonneesIndicateurs; base: BaseTableau | null }) {
  const certificats = base?.certificats;
  const serie = base?.jeu.serie;
  return (
    <div className={GRILLE_INDICATEURS}>
      <Indicateur>
        <StatCard className="flex-1" icon={Target02Icon} label="Progression globale" value={`${i.progression} %`} hint={`+${i.progressionMois} % ce mois`} />
      </Indicateur>
      <Indicateur>
        <StatCard
          className="flex-1"
          icon={BookOpen01Icon}
          label="Formations en cours"
          value={i.enCours.toLocaleString("fr-FR")}
          hint={`Sur ${i.commencees.toLocaleString("fr-FR")} formation${i.commencees > 1 ? "s" : ""}`}
        />
      </Indicateur>
      <Indicateur>
        <StatCard
          className="flex-1"
          icon={Certificate01Icon}
          tone="reussite"
          label="Certificats obtenus"
          value={certificats ? certificats.nombre.toLocaleString("fr-FR") : "—"}
          hint={certificats ? (certificats.titres.length > 0 ? certificats.titres.join(" et ") : "Aucun pour l’instant") : undefined}
        />
      </Indicateur>
      <Indicateur>
        <StatCard
          className="flex-1"
          icon={FireIcon}
          tone="attention"
          label="Série d’apprentissage"
          value={serie === undefined ? "—" : jours(serie)}
          hint={serie === undefined ? undefined : serie > 0 ? "Continuez comme ça" : "Apprenez aujourd’hui pour la lancer"}
        />
      </Indicateur>
    </div>
  );
}

/** Que dois-je continuer : la formation en cours, sa leçon, sa progression. */
export function Continuer({ continuer: c }: { continuer: AContinuer | null }) {
  return (
    <Section titre="Continuer l’apprentissage" lien={{ href: "/mes-formations", texte: "Mes formations" }}>
      {c ? (
        <div className={`${CARTE} gap-4 px-[19px] pt-[22px] pb-[17px] max-sm:px-4 max-sm:pt-[18px]`}>
          <div className="flex items-start gap-4 max-sm:gap-3">
            <IconTile icon={PlayCircleIcon} size={44} tone="information" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <h3 className="m-0 text-base leading-6 font-semibold wrap-anywhere text-encre">{c.titre}</h3>
              <p className="m-0 text-[13px] leading-5 wrap-anywhere text-discret">{c.lecon}</p>
            </div>
            {c.parcours && <Tag tone={c.parcours.couleur as TagTone}>{c.parcours.nomCourt}</Tag>}
          </div>
          <div className="flex flex-col gap-2">
            <ProgressBar value={c.pourcentage} label={`Progression de ${c.titre}`} />
            <ProgressMeta value={c.pourcentage} timeLabel={c.temps || undefined} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={c.href}>Reprendre la leçon</Link>
            </Button>
            <Button variant="gris" asChild>
              <Link href={c.hrefFormation}>Voir le parcours</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className={`${CARTE} items-start gap-3 px-[19px] py-5 max-sm:px-4`}>
          <h3 className="m-0 text-base leading-6 font-semibold text-encre">Commencez votre première formation</h3>
          <p className="m-0 text-sm leading-[22px] text-texte">Choisissez une formation dans le catalogue : votre progression s’affichera ici.</p>
          <Button asChild>
            <Link href="/formations">Explorer le catalogue</Link>
          </Button>
        </div>
      )}
    </Section>
  );
}

const ICONES_A_FAIRE: Record<ElementAFaire["type"], { icon: IconSvgElement; tone: IconTileTone }> = {
  exercice: { icon: Task01Icon, tone: "attention" },
  quiz: { icon: QuizIcon, tone: "neutre" },
  lecon: { icon: PlayCircleIcon, tone: "neutre" },
};

/** Que dois-je faire maintenant : l'exercice à corriger, le quiz à repasser, la leçon suivante. */
export function AFaire({ elements }: { elements: ElementAFaire[] }) {
  return (
    <Section titre="À faire" pastille={elements.length > 0 ? `${elements.length} élément${elements.length > 1 ? "s" : ""}` : undefined}>
      <div className={`${CARTE} px-[15px] py-1 max-sm:px-3`}>
        {elements.length === 0 ? (
          <p className="m-0 px-1 py-4 text-sm leading-[22px] text-discret">Rien à faire pour l’instant.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {elements.map((e, i) => (
              <li key={e.href} className={i > 0 ? "border-t border-separateur" : undefined}>
                <Link href={e.href} className="focus-etudium flex min-h-12 items-center gap-3.5 px-1 py-3.5 text-encre no-underline hover:bg-page max-sm:gap-3">
                  <IconTile icon={ICONES_A_FAIRE[e.type].icon} size={44} tone={ICONES_A_FAIRE[e.type].tone} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[15px] leading-[22px] font-medium max-sm:text-sm max-sm:leading-5">{e.titre}</span>
                    <span className="text-[13px] leading-5 wrap-anywhere text-discret">{e.detail}</span>
                  </span>
                  {e.etiquette && <Tag tone="aCorriger">{e.etiquette}</Tag>}
                  <Icon icon={ArrowRight01Icon} size={18} className="flex-none text-discret" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

/** L'objectif de la semaine (Q3) : les jours d'apprentissage cochés, la barre, les points de la semaine et le niveau. */
export function ObjectifSemaine({ jeu }: { jeu: ProgressionJeu }) {
  const faits = jeu.joursSemaine.filter(Boolean).length;
  const atteint = faits >= jeu.objectifJours;
  return (
    <Section titre="Objectif de la semaine">
      <div className={`${CARTE} px-[19px] pt-[22px] pb-[17px] max-sm:px-4 max-sm:pt-[18px]`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="m-0 text-sm leading-[22px] text-texte">{`Apprendre ${jeu.objectifJours} jours cette semaine.`}</p>
          <Tag tone={atteint ? "reussi" : "compteur"}>{`${faits} / ${jeu.objectifJours} jours`}</Tag>
        </div>
        <ul aria-label="Jours de la semaine" className="m-0 mt-4 flex list-none gap-1.5 p-0">
          {JOURS.map((nom, i) => {
            const fait = jeu.joursSemaine[i] === true;
            return (
              <li
                key={nom}
                aria-label={fait ? `${nom}, jour d’apprentissage` : nom}
                className={`flex h-11 min-w-0 flex-1 items-center justify-center rounded-champ border text-sm font-semibold max-sm:h-10 ${
                  fait ? "border-reussite-fond bg-reussite-fond text-reussite-texte" : "border-bordure bg-panneau text-texte"
                }`}
              >
                <span aria-hidden="true">{nom[0]}</span>
              </li>
            );
          })}
        </ul>
        <ProgressBar className="mt-[18px]" value={Math.min(100, Math.round((100 * faits) / jeu.objectifJours))} label="Objectif de la semaine" />
        <div className="mt-2 flex flex-wrap items-center gap-[7px] text-xs leading-[18px] text-discret">
          <span>{`Points gagnés cette semaine : ${jeu.pointsSemaine.toLocaleString("fr-FR")}`}</span>
          <span aria-hidden="true" className="size-[3px] flex-none rounded-full bg-discret" />
          <span>{`Niveau ${jeu.niveau}`}</span>
        </div>
      </div>
    </Section>
  );
}

const ACTIVITES: Record<BaseTableau["activite"][number]["type"], { icon: IconSvgElement; tone: IconTileTone }> = {
  exercice: { icon: CheckmarkCircle02Icon, tone: "reussite" },
  quiz: { icon: QuizIcon, tone: "information" },
  certificat: { icon: Certificate01Icon, tone: "reussite" },
  badge: { icon: Award01Icon, tone: "attention" },
};

function libelleActivite(a: BaseTableau["activite"][number]): { titre: string; detail: string } | null {
  const detail = a.formation ? `${a.formation} · ${a.titre}` : a.titre;
  switch (a.type) {
    case "exercice":
      return { titre: "Exercice validé", detail };
    case "quiz":
      return { titre: a.score === null ? "Quiz réussi" : `Quiz réussi · ${a.score} %`, detail };
    case "certificat":
      return { titre: "Nouveau certificat", detail: a.titre };
    case "badge":
      return estCodeBadge(a.titre) ? { titre: "Nouveau badge", detail: BADGES[a.titre].nom } : null;
  }
}

/** Ses derniers événements : exercice validé, quiz réussi, certificat, badge (3 au plus). */
export function ActiviteRecente({ activite, maintenant }: { activite: BaseTableau["activite"]; maintenant: Date }) {
  const lignes = activite.flatMap((a) => {
    const libelle = libelleActivite(a);
    return libelle ? [{ ...a, ...libelle }] : [];
  });
  return (
    <Section titre="Activité récente">
      <div className={`${CARTE} px-[15px] py-1 max-sm:px-3`}>
        {lignes.length === 0 ? (
          <p className="m-0 px-1 py-4 text-sm leading-[22px] text-discret">Votre activité apparaîtra ici : quiz réussis, exercices validés, certificats et badges.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {lignes.slice(0, 3).map((a, i) => (
              <li key={`${a.type}-${a.quand}-${a.titre}`} className={`flex min-h-12 items-center gap-3.5 px-1 py-3.5 max-sm:gap-3 ${i > 0 ? "border-t border-separateur" : ""}`}>
                <IconTile icon={ACTIVITES[a.type].icon} size={44} tone={ACTIVITES[a.type].tone} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] leading-[22px] font-medium text-encre max-sm:text-sm max-sm:leading-5">{a.titre}</span>
                  <span className="text-[13px] leading-5 wrap-anywhere text-discret">{a.detail}</span>
                </span>
                <span className="text-xs leading-[18px] whitespace-nowrap text-discret">{quandActivite(a.quand, maintenant)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}
