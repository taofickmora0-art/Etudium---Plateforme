import Link from "next/link";
import { AssignmentsIcon, PlayIcon, Quiz01Icon, SquareLock02Icon, Tick02Icon, Video01Icon } from "@hugeicons/core-free-icons";
import { adresseLecon } from "@/components/catalogue/ProgrammeFiche";
import { Icon, type IconSvgElement } from "@/components/ui/Icon";
import { Tag } from "@/components/ui/Tag";
import { formatDuree } from "@/lib/admin/duree";
import { estLeconDeContenu, libelleExercice, libelleQuiz, titreModule } from "@/lib/catalogue/regles";
import type { StatutRendu } from "@/lib/exercices/types";
import type { FicheFormation } from "@/lib/catalogue/types";
import { cn } from "@/lib/cn";
import { etatLigne, type EtatLigne, formationPartielle } from "@/lib/lecon/regles";

type Props = {
  fiche: FicheFormation;
  leconId: string;
  connecte: boolean;
  terminees: ReadonlySet<string>;
  /** Le meilleur score du compte à chaque quiz (lot 3). */
  scores?: Readonly<Record<string, number>>;
  /** Le dernier statut du compte à chaque exercice (lot 3). */
  statuts?: Readonly<Record<string, StatutRendu>>;
  /** Les compteurs « 1/4 » des modules ; par défaut pour un compte connecté. Jamais en aperçu (tâche 12). */
  progression?: boolean;
};

const TUILES: Record<EtatLigne, { classe: string; icone: IconSvgElement }> = {
  terminee: { classe: "bg-reussite-fond text-reussite-texte", icone: Tick02Icon },
  courante: { classe: "bg-bleu-pale text-bleu", icone: PlayIcon },
  "a-venir": { classe: "bg-coque text-texte", icone: Video01Icon },
  verrouillee: { classe: "bg-coque text-texte", icone: SquareLock02Icon },
};

const LIGNE = "flex min-h-12 items-center gap-3.5 px-1 py-3.5";

/**
 * Onglet « Programme » du téléphone (NdMobLecon §3.5). Tous les modules : rien ne se verrouille (spec du lot 3, choix 2).
 */
export function ProgrammeMobile({ fiche, leconId, connecte, terminees, scores = {}, statuts = {}, progression = connecte }: Props) {
  const partielle = formationPartielle(fiche);
  return (
    <div className="flex min-w-0 flex-col">
      {fiche.modules.map((module, index) => (
        <div key={module.id} className="flex min-w-0 flex-col">
          {index > 0 && <div aria-hidden="true" className="mt-1.5 mb-2.5 h-px bg-bordure-carte" />}
          <div className="flex items-center justify-between gap-3 px-1 pt-1.5 pb-0.5">
            <h3 className="m-0 text-base leading-6 font-semibold text-encre">{titreModule(index + 1, module.titre)}</h3>
            {progression && (
              <span className="text-xs leading-[18px] whitespace-nowrap text-discret">
                {`${module.lecons.filter((l) => estLeconDeContenu(l) && terminees.has(l.id)).length}/${module.lecons.filter(estLeconDeContenu).length}`}
              </span>
            )}
          </div>
          <ul className="m-0 flex list-none flex-col p-0 [&>li+li]:border-t [&>li+li]:border-bordure-carte">
            {module.lecons.map((lecon) => {
              const etat = etatLigne(lecon, leconId, terminees);
              const quiz = lecon.type === "quiz";
              const exercice = lecon.type === "exercice";
              const tuile =
                etat === "verrouillee" ? TUILES[etat] : quiz ? { ...TUILES[etat], icone: Quiz01Icon } : exercice ? { ...TUILES[etat], icone: AssignmentsIcon } : TUILES[etat];
              const duree = quiz ? libelleQuiz(scores[lecon.id]) : exercice ? libelleExercice(statuts[lecon.id]) : formatDuree(lecon.dureeSecondes);
              const corps = (
                <>
                  <span className={cn("flex size-10 flex-none items-center justify-center rounded-champ", tuile.classe)}>
                    <Icon icon={tuile.icone} size={18} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className={cn("text-[15px] leading-[22px] font-medium", etat === "verrouillee" ? "text-discret" : "text-encre")}>{lecon.titre}</span>
                    {(duree || etat === "courante" || lecon.publiee === false || (partielle && lecon.apercu)) && (
                      <span className="inline-flex flex-wrap items-center gap-2 text-[13px] leading-5 text-discret">
                        {duree && <span>{etat === "terminee" ? `${duree} · terminée` : duree}</span>}
                        {etat === "courante" && <Tag tone="nouveau">En cours</Tag>}
                        {/* Comme sur ordinateur : une leçon en brouillon (équipe, formateur), une leçon d'aperçu (tâche 12). */}
                        {lecon.publiee === false && <Tag tone="enAttente">Brouillon</Tag>}
                        {partielle && lecon.apercu && lecon.accessible && etat !== "courante" && <Tag tone="nouveau">Aperçu</Tag>}
                      </span>
                    )}
                  </span>
                </>
              );
              return (
                <li key={lecon.id}>
                  {etat === "verrouillee" ? (
                    <div aria-disabled="true" className={LIGNE}>
                      {corps}
                    </div>
                  ) : (
                    <Link
                      href={adresseLecon(fiche.slug, lecon.id)}
                      aria-current={etat === "courante" ? "page" : undefined}
                      className={cn(LIGNE, "focus-etudium text-inherit no-underline transition-colors hover:bg-page")}
                    >
                      {corps}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
