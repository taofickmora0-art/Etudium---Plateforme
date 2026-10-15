import Link from "next/link";
import { ArrowLeft02Icon, AssignmentsIcon, Certificate01Icon, CheckmarkCircle02Icon, Clock01Icon, PlayCircleIcon, Quiz01Icon, SquareLock02Icon } from "@hugeicons/core-free-icons";
import { adresseLecon } from "@/components/catalogue/ProgrammeFiche";
import { Couverture } from "@/components/ui/Couverture";
import { Icon } from "@/components/ui/Icon";
import { Tag } from "@/components/ui/Tag";
import { ProgressBar } from "@/components/ui/Progress";
import { formatDuree } from "@/lib/admin/duree";
import { dureeLisible, estLeconDeContenu, libelleExercice, libelleQuiz, parcoursPrincipal } from "@/lib/catalogue/regles";
import type { StatutRendu } from "@/lib/exercices/types";
import type { FicheFormation, LeconFiche } from "@/lib/catalogue/types";
import { cn } from "@/lib/cn";
import { urlCouverture } from "@/lib/couvertures/adresse";
import { etatLigne, tempsRestant, type EtatLigne } from "@/lib/lecon/regles";
import { ModulesRepliables } from "./ModulesRepliables";

type Props = {
  fiche: FicheFormation;
  leconId: string;
  connecte: boolean;
  terminees: ReadonlySet<string>;
  /** Le meilleur score du compte à chaque quiz (lot 3). */
  scores?: Readonly<Record<string, number>>;
  /** Le dernier statut du compte à chaque exercice (lot 3). */
  statuts?: Readonly<Record<string, StatutRendu>>;
};

// Ligne du panneau : le style des entrées de la barre latérale (48 px, rayon 14, icône 20, texte 16).
const LIGNE = "focus-etudium flex h-12 items-center gap-2.5 rounded-bouton px-3 text-base font-medium no-underline transition-colors";

const ICONES = { courante: PlayCircleIcon, "a-venir": PlayCircleIcon, terminee: CheckmarkCircle02Icon, verrouillee: SquareLock02Icon };

function Ligne({ fiche, lecon, etat, meilleur, statut }: { fiche: FicheFormation; lecon: LeconFiche; etat: EtatLigne; meilleur?: number; statut?: StatutRendu }) {
  const quiz = lecon.type === "quiz";
  const exercice = lecon.type === "exercice";
  const duree = quiz ? libelleQuiz(meilleur) : exercice ? libelleExercice(statut) : formatDuree(lecon.dureeSecondes);
  const contenu = (
    <>
      <span className={cn("flex flex-none", etat === "terminee" && "text-reussite-texte")}>
        <Icon icon={etat === "verrouillee" ? ICONES[etat] : quiz ? Quiz01Icon : exercice ? AssignmentsIcon : ICONES[etat]} size={20} />
      </span>
      <span title={lecon.titre} className="min-w-0 truncate">
        {lecon.titreCourt ?? lecon.titre}
      </span>
      <span className="ml-auto flex flex-none items-center gap-2">
        {/* Une leçon en brouillon : seuls l'équipe et le formateur la voient (0027). */}
        {lecon.publiee === false && <Tag tone="enAttente">Brouillon</Tag>}
        {duree && <span className="text-[13px] leading-5 font-normal text-ardoise tabular-nums">{duree}</span>}
      </span>
    </>
  );
  if (etat === "verrouillee") {
    return (
      <span aria-disabled="true" className={cn(LIGNE, "text-ardoise")}>
        {contenu}
      </span>
    );
  }
  return (
    <Link
      href={adresseLecon(fiche.slug, lecon.id)}
      aria-current={etat === "courante" ? "page" : undefined}
      className={cn(LIGNE, etat === "courante" ? "bg-panneau text-bleu shadow-pastille" : "text-texte hover:bg-white/55")}
    >
      {contenu}
    </Link>
  );
}

/**
 * La progression du cours : la barre, « 8 % terminé », le temps restant, et le lien vers ce qui reste pour le
 * certificat (bas du programme, bas du tiroir ; compte connecté seulement).
 */
export function ProgressionCours({ fiche, terminees }: { fiche: FicheFormation; terminees: ReadonlySet<string> }) {
  // Les quiz ne comptent pas dans la progression (R17).
  const lecons = fiche.modules.flatMap((m) => m.lecons).filter(estLeconDeContenu);
  const faites = lecons.filter((l) => terminees.has(l.id)).length;
  const pourcentage = lecons.length ? Math.round((100 * faites) / lecons.length) : 0;
  const restant = dureeLisible(tempsRestant(fiche.modules, terminees));
  return (
    <div className="flex flex-col">
      <ProgressBar value={pourcentage} label="Progression de la formation" />
      <div className="mt-2 flex flex-wrap items-center gap-[7px] text-xs leading-[18px] text-ardoise">
        <span>{pourcentage} % terminé</span>
        {restant && (
          <>
            <span aria-hidden="true" className="size-[3px] flex-none rounded-full bg-ardoise" />
            <span className="flex items-center gap-1">
              <Icon icon={Clock01Icon} size={18} className="-mx-[1.5px]" />
              <span>{restant} restantes</span>
            </span>
          </>
        )}
      </div>
      <Link
        href={`/formations/${fiche.slug}/validation`}
        className="focus-etudium mt-3 flex items-center gap-2 self-start rounded-champ text-[13px] leading-5 font-medium text-bleu no-underline hover:underline"
      >
        <Icon icon={Certificate01Icon} size={16} />
        <span>Validation et certificat</span>
      </Link>
    </div>
  );
}

/**
 * Panneau « Programme de la formation » (NdLecon §2.2), à la place de la barre latérale sur ordinateur : retour et
 * formation, puis les modules, repliables (celui de la leçon en cours ouvert), avec la durée de chaque leçon. Il défile
 * seul ; la progression (compte connecté) reste en bas (refonte des formations, spec §1.4).
 */
export function ProgrammeLecon({ fiche, leconId, connecte, terminees, scores = {}, statuts = {} }: Props) {
  const enCours = fiche.modules.find((m) => m.lecons.some((l) => l.id === leconId)) ?? fiche.modules[0];
  return (
    <>
      <div className="-m-1 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-1">
        <Link href={connecte ? "/mes-formations" : "/formations"} className={cn(LIGNE, "flex-none text-texte hover:bg-white/55")}>
          <Icon icon={ArrowLeft02Icon} size={20} />
          <span>{connecte ? "Mes formations" : "Toutes les formations"}</span>
        </Link>
        <div className="flex flex-none flex-col px-3 pt-1.5 pb-1">
          <Couverture src={urlCouverture(fiche.couverture)} parcours={parcoursPrincipal(fiche)} sizes="280px" className="mb-3 rounded-[12px]" />
          <Link href={`/formations/${fiche.slug}`} className="focus-etudium text-base leading-6 font-semibold text-encre no-underline hover:underline">
            {fiche.titre}
          </Link>
        </div>
        <ModulesRepliables
          ouverts={enCours ? [enCours.id] : []}
          sections={fiche.modules.map((module, index) => ({
            cle: module.id,
            titre: `${index + 1} · ${module.titre}`,
            contenu: (
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {module.lecons.map((lecon) => (
                  <li key={lecon.id} className="flex min-w-0 flex-col">
                    <Ligne fiche={fiche} lecon={lecon} etat={etatLigne(lecon, leconId, terminees)} meilleur={scores[lecon.id]} statut={statuts[lecon.id]} />
                  </li>
                ))}
              </ul>
            ),
          }))}
        />
      </div>
      {connecte && (
        <div className="flex-none border-t border-[#DAE0EE] px-3 pt-4">
          <ProgressionCours fiche={fiche} terminees={terminees} />
        </div>
      )}
    </>
  );
}
