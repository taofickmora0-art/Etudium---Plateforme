import Link from "next/link";
import { CheckmarkCircle02Icon, PlayCircleIcon, SquareLock02Icon } from "@hugeicons/core-free-icons";
import { Accordion } from "@/components/ui/Accordion";
import { Icon } from "@/components/ui/Icon";
import { formatDuree } from "@/lib/admin/duree";
import { dureeLisible, nombreDeLecons } from "@/lib/catalogue/regles";
import type { FicheFormation, LeconFiche } from "@/lib/catalogue/types";
import { cn } from "@/lib/cn";
import { etatModule, type EtatProgression } from "@/lib/progression/regles";
import { Tag } from "@/components/ui/Tag";

export const adresseLecon = (slug: string, leconId: string) => `/formations/${slug}/lecons/${leconId}`;

/** « 4 modules · 12 leçons · 2 h 20 ». */
export function resumeProgramme(fiche: FicheFormation) {
  const n = fiche.modules.length;
  return [`${n} ${n > 1 ? "modules" : "module"}`, nombreDeLecons(fiche.nbLecons), dureeLisible(fiche.dureeSecondes)].filter(Boolean).join(" · ");
}

const metaModule = (lecons: LeconFiche[]) =>
  [nombreDeLecons(lecons.length), dureeLisible(lecons.reduce((t, l) => t + l.dureeSecondes, 0))].filter(Boolean).join(" · ");

/** Ligne d'une leçon, programme du visiteur (NdFormationPublic) : lien « Aperçu » sur les leçons d'aperçu seulement. */
function LeconPublique({ slug, lecon, premiere }: { slug: string; lecon: LeconFiche; premiere: boolean }) {
  return (
    <span className={cn("flex min-h-11 items-center gap-3 text-texte", !premiere && "border-t border-bordure-carte")}>
      <span className="flex flex-none text-discret">
        <Icon icon={PlayCircleIcon} size={18} />
      </span>
      <span className="min-w-0 flex-1">{lecon.titre}</span>
      {lecon.apercu && (
        <Link href={adresseLecon(slug, lecon.id)} aria-label="Aperçu" className="focus-etudium font-medium text-bleu no-underline hover:underline">
          Aperçu
        </Link>
      )}
      <span className="min-w-11 text-right text-[13px] text-discret">{formatDuree(lecon.dureeSecondes)}</span>
    </span>
  );
}

/**
 * Ligne d'une leçon, programme connecté (NdFormation) : lien si la leçon est ouverte, cadenas sinon. Avec la progression
 * (1.7) : coche verte sur une leçon terminée, « Vous êtes ici » sur la leçon où reprendre.
 */
function LeconConnectee({ slug, lecon, terminee = false, ici = false }: { slug: string; lecon: LeconFiche; terminee?: boolean; ici?: boolean }) {
  const icone = !lecon.accessible ? SquareLock02Icon : terminee ? CheckmarkCircle02Icon : PlayCircleIcon;
  const contenu = (
    <>
      <span className={cn("flex flex-none", !lecon.accessible ? "text-discret" : terminee ? "text-reussite-texte" : "text-texte")}>
        <Icon icon={icone} size={20} />
      </span>
      <span className={cn("min-w-0 flex-1 text-sm leading-5", lecon.accessible ? "text-encre" : "text-discret", ici && "font-semibold")}>
        {lecon.titre}
        {terminee && <span className="sr-only"> (terminée)</span>}
      </span>
      {ici && <Tag tone="nouveau">Vous êtes ici</Tag>}
      {lecon.publiee === false && <Tag tone="enAttente">Brouillon</Tag>}
      <span className="min-w-14 flex-none text-right text-[13px] leading-5 text-discret">{formatDuree(lecon.dureeSecondes)}</span>
    </>
  );
  const ligne = "flex min-h-11 items-center gap-3 border-t border-bordure-carte px-1";
  if (!lecon.accessible) {
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

/** Programme en accordéon : un module par ligne, le premier ouvert (NdFormationPublic §5.3, NdFormation §6.3 b). */
export function ProgrammeFiche({
  fiche,
  variante,
  progression = null,
}: {
  fiche: FicheFormation;
  variante: "public" | "connecte";
  /** Progression du compte connecté (1.7) ; null avant la première leçon ou sans progression en base. */
  progression?: EtatProgression | null;
}) {
  if (fiche.modules.length === 0) return <p className="m-0 text-sm leading-[22px] text-discret">Le programme arrive bientôt.</p>;
  const terminees = progression?.terminees ?? new Set<string>();
  const aReprendre = progression?.aReprendre ?? null;
  return (
    <Accordion
      defaultOpen={[0]}
      className="border-t border-bordure-carte"
      items={fiche.modules.map((module, rang) => ({
        cle: module.id,
        question: (
          <span className="flex flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-2">
              <span>
                Module {rang + 1} : {module.titre}
              </span>
              {progression && etatModule(module, terminees, aReprendre) === "termine" && <Tag tone="valide">Terminé</Tag>}
              {progression && etatModule(module, terminees, aReprendre) === "en-cours" && <Tag tone="nouveau">En cours</Tag>}
            </span>
            <span className="block text-[13px] leading-5 font-normal text-discret">{metaModule(module.lecons)}</span>
          </span>
        ),
        answer:
          module.lecons.length === 0 ? (
            <span>Les leçons de ce module arrivent bientôt.</span>
          ) : (
            <span className="flex flex-col">
              {module.lecons.map((lecon, index) =>
                variante === "public" ? (
                  <LeconPublique key={lecon.id} slug={fiche.slug} lecon={lecon} premiere={index === 0} />
                ) : (
                  <LeconConnectee key={lecon.id} slug={fiche.slug} lecon={lecon} terminee={terminees.has(lecon.id)} ici={aReprendre?.id === lecon.id} />
                ),
              )}
            </span>
          ),
      }))}
    />
  );
}
