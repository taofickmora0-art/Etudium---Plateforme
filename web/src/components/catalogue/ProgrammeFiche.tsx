import Link from "next/link";
import { AssignmentsIcon, CheckmarkCircle02Icon, PlayCircleIcon, Quiz01Icon, SquareLock02Icon } from "@hugeicons/core-free-icons";
import { AccordeonProgramme } from "./AccordeonProgramme";
import { Icon } from "@/components/ui/Icon";
import { formatDuree } from "@/lib/admin/duree";
import { dureeLisible, estLeconDeContenu, libelleExercice, libelleQuiz, nombreDExercices, nombreDeLecons, nombreDeQuiz, titreModule } from "@/lib/catalogue/regles";
import type { StatutRendu } from "@/lib/exercices/types";
import type { FicheFormation, LeconFiche } from "@/lib/catalogue/types";
import { cn } from "@/lib/cn";
import { formationPartielle } from "@/lib/lecon/regles";
import { etatModule, type EtatProgression } from "@/lib/progression/regles";
import { Tag } from "@/components/ui/Tag";

export const adresseLecon = (slug: string, leconId: string) => `/formations/${slug}/lecons/${leconId}`;

/** « 4 modules • 12 leçons • 2 quiz • 2 h 20 » : la structure de la formation, sous son titre (spec du 2 novembre 2026, §5). */
export function resumeProgramme(fiche: FicheFormation) {
  const n = fiche.modules.length;
  // Pas de « 0 leçon » : une formation (ou une section) peut n'avoir que des quiz.
  return [`${n} ${n > 1 ? "modules" : "module"}`, fiche.nbLecons > 0 && nombreDeLecons(fiche.nbLecons), nombreDeQuiz(fiche.nbQuiz), nombreDExercices(fiche.nbExercices), dureeLisible(fiche.dureeSecondes)]
    .filter(Boolean)
    .join(" • ");
}

/** « 6 leçons • 1 quiz • 1 h 20 » : les quiz et les exercices sont comptés à part. */
const metaModule = (lecons: LeconFiche[]) => {
  const contenu = lecons.filter(estLeconDeContenu);
  const quiz = lecons.filter((l) => l.type === "quiz").length;
  const exercices = lecons.filter((l) => l.type === "exercice").length;
  return [contenu.length > 0 && nombreDeLecons(contenu.length), nombreDeQuiz(quiz), nombreDExercices(exercices), dureeLisible(contenu.reduce((t, l) => t + l.dureeSecondes, 0))]
    .filter(Boolean)
    .join(" • ");
};

type Repere = "rond" | "coche" | "cadenas";

/** Le repère d'une leçon : rond vide (pas encore terminée), coche verte (terminée) ou cadenas (fermée). */
function RepereLecon({ repere }: { repere: Repere }) {
  if (repere === "rond") {
    return (
      <span data-repere="rond" aria-hidden="true" className="flex size-5 flex-none items-center justify-center">
        <span className="size-[17px] rounded-full border-[1.5px] border-[#C3CAD9]" />
      </span>
    );
  }
  return (
    <span data-repere={repere} className={cn("flex flex-none", repere === "coche" ? "text-reussite-texte" : "text-discret")}>
      <Icon icon={repere === "coche" ? CheckmarkCircle02Icon : SquareLock02Icon} size={20} />
    </span>
  );
}

/**
 * Une leçon du programme (spec du 2 novembre 2026, §5) : son repère, son titre, puis à droite une icône et la durée (« Quiz »,
 * « Exercice » et leur résultat pour une activité). Ouverte, c'est un lien ; fermée, elle ne l'est pas. Avec la
 * progression : « Vous êtes ici » sur la leçon où reprendre.
 */
function LigneLecon({
  slug,
  lecon,
  terminee = false,
  ici = false,
  apercu = false,
  meilleur,
  statut,
}: {
  slug: string;
  lecon: LeconFiche;
  terminee?: boolean;
  ici?: boolean;
  /** Une leçon d'aperçu parmi des leçons fermées : l'étiquette « Aperçu ». */
  apercu?: boolean;
  meilleur?: number;
  statut?: StatutRendu;
}) {
  const quiz = lecon.type === "quiz";
  const exercice = lecon.type === "exercice";
  const ouverte = lecon.accessible;
  const duree = quiz ? libelleQuiz(meilleur) : exercice ? libelleExercice(statut) : formatDuree(lecon.dureeSecondes);
  const contenu = (
    <>
      <RepereLecon repere={!ouverte ? "cadenas" : terminee ? "coche" : "rond"} />
      {/* Les étiquettes passent sous le titre quand la ligne est étroite (320 px), au lieu de le recouvrir. */}
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        <span className={cn("min-w-0 text-sm leading-5 max-sm:text-[13px]", ouverte ? "text-encre" : "text-discret", ici && "font-semibold")}>
          {lecon.titre}
          {terminee && <span className="sr-only"> (terminée)</span>}
          {!ouverte && <span className="sr-only"> (verrouillée)</span>}
        </span>
        {ici && <Tag tone="nouveau">Vous êtes ici</Tag>}
        {apercu && <Tag tone="nouveau">Aperçu</Tag>}
        {lecon.publiee === false && <Tag tone="enAttente">Brouillon</Tag>}
      </span>
      {duree && (
        <span data-duree="" className="flex flex-none items-center gap-1.5 text-[13px] leading-5 text-discret tabular-nums max-sm:text-xs">
          <Icon icon={quiz ? Quiz01Icon : exercice ? AssignmentsIcon : PlayCircleIcon} size={16} />
          <span>{duree}</span>
        </span>
      )}
    </>
  );
  const ligne = "flex min-h-11 items-center gap-3 border-t border-bordure-carte px-1 py-2 max-sm:gap-2.5";
  if (!ouverte) {
    return (
      <span aria-disabled="true" className={ligne}>
        {contenu}
      </span>
    );
  }
  return (
    <Link href={adresseLecon(slug, lecon.id)} className={cn(ligne, "focus-etudium no-underline transition-colors hover:bg-page")}>
      {contenu}
    </Link>
  );
}

/**
 * « Contenus du cours » (spec du 2 novembre 2026, §5) : un accordéon par module, « Module N - Titre » et « N leçons •
 * durée », le premier ouvert ; « Tout déplier / Tout replier » et, pour l'équipe et le formateur de la formation,
 * « Modifier les leçons ». Le même pour un visiteur et pour un compte connecté : les leçons que la base n'ouvre pas ont un
 * cadenas.
 */
export function ProgrammeFiche({
  fiche,
  progression = null,
  lienModifier = null,
  scores = {},
  statuts = {},
}: {
  fiche: FicheFormation;
  /** Progression du compte connecté (1.7) ; null avant la première leçon, sans progression en base ou pour un visiteur. */
  progression?: EtatProgression | null;
  /** « Modifier les leçons », pour l'équipe et le formateur de la formation (refonte des formations, §2). */
  lienModifier?: string | null;
  /** Le meilleur score du compte à chaque quiz (lot 3). */
  scores?: Readonly<Record<string, number>>;
  /** Le dernier statut du compte à chaque exercice (lot 3). */
  statuts?: Readonly<Record<string, StatutRendu>>;
}) {
  if (fiche.modules.length === 0) return <p className="m-0 text-sm leading-[22px] text-discret">Le programme arrive bientôt.</p>;
  const terminees = progression?.terminees ?? new Set<string>();
  const aReprendre = progression?.aReprendre ?? null;
  // L'étiquette « Aperçu » n'a de sens qu'au milieu des cadenas (comme dans la page de la leçon).
  const partielle = formationPartielle(fiche);
  const items = fiche.modules.map((module, rang) => ({
    cle: module.id,
    question: (
      <span className="flex flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2 max-sm:text-[15px] max-sm:leading-[22px]">
          <span>{titreModule(rang + 1, module.titre)}</span>
          {progression && etatModule(module, terminees, aReprendre) === "termine" && <Tag tone="valide">Terminé</Tag>}
          {progression && etatModule(module, terminees, aReprendre) === "en-cours" && <Tag tone="nouveau">En cours</Tag>}
        </span>
        <span className="block text-[13px] leading-5 font-normal text-discret max-sm:text-xs max-sm:leading-[18px]">{metaModule(module.lecons)}</span>
      </span>
    ),
    answer:
      module.lecons.length === 0 ? (
        <span>Les leçons de ce module arrivent bientôt.</span>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {module.lecons.map((lecon) => (
            <li key={lecon.id} className="flex min-w-0 flex-col">
              <LigneLecon
                slug={fiche.slug}
                lecon={lecon}
                terminee={terminees.has(lecon.id)}
                ici={aReprendre?.id === lecon.id}
                apercu={partielle && lecon.apercu && lecon.accessible && estLeconDeContenu(lecon)}
                meilleur={scores[lecon.id]}
                statut={statuts[lecon.id]}
              />
            </li>
          ))}
        </ul>
      ),
  }));
  return <AccordeonProgramme items={items} lienModifier={lienModifier} />;
}
