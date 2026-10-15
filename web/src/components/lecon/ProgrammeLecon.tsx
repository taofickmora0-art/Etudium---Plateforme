import Link from "next/link";
import { ArrowLeft02Icon, CheckmarkCircle02Icon, Clock01Icon, PlayCircleIcon, SquareLock02Icon } from "@hugeicons/core-free-icons";
import { adresseLecon } from "@/components/catalogue/ProgrammeFiche";
import { Couverture } from "@/components/ui/Couverture";
import { Icon } from "@/components/ui/Icon";
import { Tag } from "@/components/ui/Tag";
import { ProgressBar } from "@/components/ui/Progress";
import { dureeLisible, parcoursPrincipal } from "@/lib/catalogue/regles";
import type { FicheFormation, LeconFiche } from "@/lib/catalogue/types";
import { cn } from "@/lib/cn";
import { urlCouverture } from "@/lib/couvertures/adresse";
import { etatLigne, tempsRestant, type EtatLigne } from "@/lib/lecon/regles";

type Props = { fiche: FicheFormation; leconId: string; connecte: boolean; terminees: ReadonlySet<string> };

// Ligne du panneau : le style des entrées de la barre latérale (48 px, rayon 14, icône 20, texte 16).
const LIGNE = "focus-etudium flex h-12 items-center gap-2.5 rounded-bouton px-3 text-base font-medium no-underline transition-colors";

const ICONES = { courante: PlayCircleIcon, "a-venir": PlayCircleIcon, terminee: CheckmarkCircle02Icon, verrouillee: SquareLock02Icon };

function Ligne({ fiche, lecon, etat }: { fiche: FicheFormation; lecon: LeconFiche; etat: EtatLigne }) {
  const contenu = (
    <>
      <span className={cn("flex flex-none", etat === "terminee" && "text-reussite-texte")}>
        <Icon icon={ICONES[etat]} size={20} />
      </span>
      <span title={lecon.titre} className="min-w-0 truncate">
        {lecon.titreCourt ?? lecon.titre}
      </span>
      {/* Une leçon en brouillon : seuls l'équipe et le formateur la voient (0027). */}
      {lecon.publiee === false && (
        <Tag tone="enAttente" className="ml-auto flex-none">
          Brouillon
        </Tag>
      )}
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
 * Panneau « Programme de la formation » (NdLecon §2.2), à la place de la barre latérale sur ordinateur : retour,
 * formation et progression (compte connecté), puis tous les modules, dépliés.
 */
export function ProgrammeLecon({ fiche, leconId, connecte, terminees }: Props) {
  const lecons = fiche.modules.flatMap((m) => m.lecons);
  const faites = lecons.filter((l) => terminees.has(l.id)).length;
  const pourcentage = lecons.length ? Math.round((100 * faites) / lecons.length) : 0;
  const restant = dureeLisible(tempsRestant(fiche.modules, terminees));
  return (
    <>
      <Link href={connecte ? "/mes-formations" : "/formations"} className={cn(LIGNE, "text-texte hover:bg-white/55")}>
        <Icon icon={ArrowLeft02Icon} size={20} />
        <span>{connecte ? "Mes formations" : "Toutes les formations"}</span>
      </Link>
      <div className="flex flex-col px-3 pt-1.5 pb-2.5">
        <Couverture src={urlCouverture(fiche.couverture)} parcours={parcoursPrincipal(fiche)} sizes="280px" className="mb-3 rounded-[12px]" />
        <Link href={`/formations/${fiche.slug}`} className="focus-etudium text-base leading-6 font-semibold text-encre no-underline hover:underline">
          {fiche.titre}
        </Link>
        {connecte && (
          <>
            <ProgressBar value={pourcentage} label="Progression de la formation" className="mt-3" />
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
          </>
        )}
      </div>
      {fiche.modules.map((module, index) => (
        <div key={module.id} className="flex flex-col gap-3">
          <div className="flex h-12 items-center gap-2.5 pr-1 pl-3">
            <span className="text-[13.5px] tracking-[0.04em] whitespace-nowrap text-ardoise uppercase">{`${index + 1} · ${module.titre}`}</span>
            <span aria-hidden="true" className="h-px flex-1 bg-[#DAE0EE]" />
          </div>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {module.lecons.map((lecon) => (
              <li key={lecon.id} className="flex min-w-0 flex-col">
                <Ligne fiche={fiche} lecon={lecon} etat={etatLigne(lecon, leconId, terminees)} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}
