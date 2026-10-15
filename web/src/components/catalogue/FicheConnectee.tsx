import Link from "next/link";
import { ArrowRight01Icon, ArrowRight02Icon, Clock01Icon, SquareLock02Icon, StarIcon } from "@hugeicons/core-free-icons";
import { SectionAvis } from "@/components/avis/SectionAvis";
import { buttonVariants } from "@/components/ui/Button";
import { Couverture } from "@/components/ui/Couverture";
import { urlCouverture } from "@/lib/couvertures/adresse";
import { BoutonFavori } from "@/components/favoris/BoutonFavori";
import { Icon, type IconSvgElement } from "@/components/ui/Icon";
import { MetaDot, ProgressBar } from "@/components/ui/Progress";
import { Tag, type TagTone } from "@/components/ui/Tag";
import { Heading, Lead } from "@/components/ui/Text";
import { dureeLisible, estLeconDeContenu, etatAcces, leconsApercu, nombreDeLecons, nombreDeQuiz, parcoursPrincipal, premiereLeconOuverte } from "@/lib/catalogue/regles";
import { formatNote, libelleNombreAvis, peutDonnerAvis } from "@/lib/avis/regles";
import type { AvisFormation } from "@/lib/avis/types";
import type { FicheFormation, LeconFiche } from "@/lib/catalogue/types";
import { cn } from "@/lib/cn";
import { formatDuree } from "@/lib/admin/duree";
import { libelleNiveau } from "@/lib/contenus/libelles";
import type { EtatProgression } from "@/lib/progression/regles";
import { CarteFormateur, elementsInclus, ListeCochee } from "./BlocsFiche";
import { adresseLecon, ProgrammeFiche, resumeProgramme } from "./ProgrammeFiche";

const CARTE = "box-border flex min-w-0 flex-col rounded-carte border border-bordure-carte bg-panneau p-5";
const BOUTON_PRINCIPAL =
  "focus-etudium mt-[18px] inline-flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-bleu px-[18px] text-base leading-none font-medium whitespace-nowrap text-white no-underline transition-colors hover:bg-bleu-survol";

function EnTeteSection({ titre, id, suite }: { titre: string; id?: string; suite?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 id={id} className="m-0 text-xl leading-7 font-semibold text-encre">
        {titre}
      </h2>
      {suite && <span className="text-[13px] leading-5 text-discret">{suite}</span>}
    </div>
  );
}

/**
 * « Progression du cours » (NdFormation §6.4 ; refonte des formations, §2) : pourcentage, barre, « Terminé 3 sur 22 » et
 * temps restant.
 */
function EnTeteProgression({ fiche, progression }: { fiche: FicheFormation; progression: EtatProgression }) {
  const restant = dureeLisible(progression.restantSecondes);
  // Les quiz ne comptent pas dans la progression (R17).
  const lecons = fiche.modules.flatMap((m) => m.lecons).filter(estLeconDeContenu);
  const faites = lecons.filter((l) => progression.terminees.has(l.id)).length;
  return (
    <>
      <div className="flex items-end justify-between gap-3">
        <span className="text-sm leading-[22px] font-medium text-discret">Progression du cours</span>
        <span className="flex-none text-[28px] leading-8 font-medium tracking-[-0.01em] whitespace-nowrap text-titre">{progression.pourcentage} %</span>
      </div>
      <ProgressBar value={progression.pourcentage} label="Progression de la formation" className="mt-3" />
      <div className="mt-2 flex flex-wrap items-center gap-[7px] text-xs leading-[18px] text-discret">
        <span>{`Terminé ${faites} sur ${lecons.length}`}</span>
        {restant && (
          <>
            <MetaDot />
            <span className="flex items-center gap-1">
              <Icon icon={Clock01Icon} size={18} className="-mx-[1.5px]" />
              <span>{restant} restantes</span>
            </span>
          </>
        )}
      </div>
    </>
  );
}

/**
 * Le bouton du haut de la page, à droite du titre sur ordinateur (refonte des formations, §2) : « Poursuivre le cours »
 * vers la leçon où reprendre, ou « Commencer le cours » d'une formation ouverte pas encore commencée.
 */
function appelDuHaut(fiche: FicheFormation, progression: EtatProgression | null): { libelle: string; lecon: LeconFiche } | null {
  const suivie = progression?.commencee ? progression : null;
  if (suivie) return suivie.aReprendre ? { libelle: "Poursuivre le cours", lecon: suivie.aReprendre } : null;
  const premiere = premiereLeconOuverte(fiche);
  return etatAcces(fiche, true) === "gratuite" && premiere ? { libelle: "Commencer le cours", lecon: premiere } : null;
}

/** « Prochaine leçon » et « Poursuivre le cours », ou « Formation terminée » et « Revoir la formation ». */
function Reprise({ fiche, progression }: { fiche: FicheFormation; progression: EtatProgression }) {
  const lecon = progression.aReprendre;
  const rang = lecon ? fiche.modules.findIndex((m) => m.lecons.some((l) => l.id === lecon.id)) : -1;
  const premiere = premiereLeconOuverte(fiche);
  const cible = lecon ?? (progression.terminee ? premiere : null);
  if (!cible) return null;
  return (
    <>
      <div className="mt-[18px] flex flex-col gap-0.5 border-t border-bordure-carte pt-4">
        {lecon ? (
          <>
            <span className="text-xs leading-[18px] text-discret">Prochaine leçon</span>
            <span className="text-[15px] leading-[22px] font-medium text-encre">{lecon.titre}</span>
            <span className="text-[13px] leading-5 text-discret">{[`Module ${rang + 1}`, formatDuree(lecon.dureeSecondes)].filter(Boolean).join(" · ")}</span>
          </>
        ) : (
          <span className="text-[15px] leading-[22px] font-medium text-reussite-texte">Formation terminée</span>
        )}
      </div>
      <Link href={adresseLecon(fiche.slug, cible.id)} className={BOUTON_PRINCIPAL}>
        <span>{lecon ? "Poursuivre le cours" : "Revoir la formation"}</span>
        <Icon icon={ArrowRight02Icon} size={20} />
      </Link>
    </>
  );
}

/**
 * Carte d'accès (à droite). Formation commencée (1.7) : la progression, puis « Poursuivre le cours ». Sinon : commencer une
 * formation ouverte, voir l'aperçu, ou savoir qu'elle est verrouillée. Les favoris arrivent en 1.9, les formules au lot 2.
 */
function CarteAcces({ fiche, progression, favori }: { fiche: FicheFormation; progression: EtatProgression | null; favori: boolean | null }) {
  const etat = etatAcces(fiche, true);
  const parcours = [...fiche.parcours].sort((a, b) => a.ordre - b.ordre)[0];
  const premiere = premiereLeconOuverte(fiche);
  const apercus = leconsApercu(fiche);
  const suivie = progression?.commencee ? progression : null;
  const reprise = suivie && (suivie.aReprendre || suivie.terminee);
  return (
    <div className={CARTE}>
      {suivie && <EnTeteProgression fiche={fiche} progression={suivie} />}
      {reprise && <Reprise fiche={fiche} progression={suivie} />}
      {!reprise && etat === "gratuite" && (
        <>
          <span className="text-sm leading-[22px] font-medium text-discret">Votre formation</span>
          <p className="m-0 mt-2 text-sm leading-[22px] text-texte">Formation gratuite : toutes les leçons sont ouvertes.</p>
          {premiere && (
            <Link href={adresseLecon(fiche.slug, premiere.id)} className={BOUTON_PRINCIPAL}>
              <span>Commencer</span>
              <Icon icon={ArrowRight02Icon} size={20} />
            </Link>
          )}
        </>
      )}
      {!reprise && etat === "apercu" && (
        <>
          <span className="text-sm leading-[22px] font-medium text-discret">Aperçu gratuit</span>
          <p className="m-0 mt-2 text-sm leading-[22px] text-texte">
            {apercus.length > 1 ? `${apercus.length} leçons sont ouvertes en aperçu.` : "Une leçon est ouverte en aperçu."}
          </p>
          <p className="m-0 mt-1 text-sm leading-[22px] text-texte">Incluse dans les formules Basique, Standard et Premium.</p>
          {apercus[0] && (
            <Link href={adresseLecon(fiche.slug, apercus[0].id)} className={BOUTON_PRINCIPAL}>
              <span>Voir l’aperçu gratuit</span>
              <Icon icon={ArrowRight02Icon} size={20} />
            </Link>
          )}
        </>
      )}
      {!reprise && etat === "verrouillee" && (
        <>
          <span className="flex items-center gap-2 text-base leading-6 font-semibold text-encre">
            <Icon icon={SquareLock02Icon} size={18} />
            Formation verrouillée
          </span>
          <p className="m-0 mt-2 text-sm leading-[22px] text-texte">Incluse dans les formules Basique, Standard et Premium.</p>
        </>
      )}
      {/* Favoris (tâche 1.9) : absent tant que la table n'est pas dans la base (null). */}
      {favori !== null && (
        <div className="mt-2 flex">
          <BoutonFavori formationId={fiche.id} favoriInitial={favori} />
        </div>
      )}
      {parcours && <p className="m-0 mt-3.5 text-center text-xs leading-[18px] text-pretty text-discret">Incluse dans le parcours {parcours.nom}.</p>}
    </div>
  );
}

/**
 * Fiche formation pour un compte connecté (NdFormation) : en-tête, programme avec cadenas, carte d'accès. Avec la
 * progression du compte (1.7) : « Progression du cours », « Poursuivre le cours », leçons terminées et « Vous êtes ici ».
 * Pour l'équipe et le formateur de la formation : « Modifier les leçons » (refonte des formations, §2).
 */
export function FicheConnectee({
  fiche,
  progression = null,
  favori = null,
  avis = null,
  lienModifier = null,
  scores = {},
}: {
  fiche: FicheFormation;
  progression?: EtatProgression | null;
  /** Formation dans les favoris du compte ; null sans la table des favoris (migration 0009). */
  favori?: boolean | null;
  /** Avis de la formation ; null sans la migration 0010. */
  avis?: AvisFormation | null;
  /** L'onglet « Leçons » de l'éditeur, pour l'équipe et le formateur de la formation. */
  lienModifier?: string | null;
  /** Le meilleur score du compte à chaque quiz (lot 3). */
  scores?: Readonly<Record<string, number>>;
}) {
  const parcours = [...fiche.parcours].sort((a, b) => a.ordre - b.ordre)[0];
  const duree = dureeLisible(fiche.dureeSecondes);
  // La note vient des avis lus pour ce compte quand ils sont là : son avis masqué y compte pour lui seul, il ne doit
  // pas le voir disparaître de la note (spec des notifications, §5). Sinon, la note de la formation.
  const note = avis ? avis.resume.moyenne : fiche.note;
  const nbAvis = avis ? avis.resume.total : fiche.nbAvis;
  const meta = [
    nbAvis > 0 && note !== null && { icone: StarIcon, marge: "-mx-px", texte: `${formatNote(note)} (${libelleNombreAvis(nbAvis)})` },
    duree && { icone: Clock01Icon, marge: "-mx-[1.5px]", texte: duree },
    { texte: libelleNiveau(fiche.niveau) },
    fiche.nbLecons > 0 && { texte: nombreDeLecons(fiche.nbLecons) },
    Boolean(fiche.nbQuiz) && { texte: nombreDeQuiz(fiche.nbQuiz) },
    fiche.formateur && { texte: fiche.formateur.nom },
  ].filter(Boolean) as { icone?: IconSvgElement; marge?: string; texte: string }[];
  const appel = appelDuHaut(fiche, progression);

  return (
    <div className="flex flex-col">
      <nav aria-label="Fil d’Ariane" className="mb-3.5 flex flex-wrap items-center gap-1.5 text-sm leading-5">
        <Link href="/formations" className="focus-etudium text-discret no-underline hover:text-texte">
          Toutes les formations
        </Link>
        {parcours && (
          <>
            <span className="flex text-discret">
              <Icon icon={ArrowRight01Icon} size={14} />
            </span>
            <Link href={`/formations?parcours=${parcours.slug}`} className="focus-etudium text-discret no-underline hover:text-texte">
              {parcours.nom}
            </Link>
          </>
        )}
        <span className="flex text-discret">
          <Icon icon={ArrowRight01Icon} size={14} />
        </span>
        <span aria-current="page" className="font-medium text-encre">
          {fiche.titre}
        </span>
      </nav>
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <Heading level="page">{fiche.titre}</Heading>
          {(fiche.description || fiche.resume) && <Lead className="mt-2.5">{fiche.description || fiche.resume}</Lead>}
        </div>
        {appel && (
          <Link href={adresseLecon(fiche.slug, appel.lecon.id)} className={cn(buttonVariants({ size: "lg" }), "flex-none max-lg:hidden")}>
            <span>{appel.libelle}</span>
            <Icon icon={ArrowRight02Icon} size={20} />
          </Link>
        )}
      </div>
      <div className="mt-[21px] flex flex-wrap items-center gap-3">
        {parcours && <Tag tone={parcoursPrincipal(fiche) as TagTone}>{parcours.nomCourt}</Tag>}
        <div className="flex flex-wrap items-center gap-[7px] text-sm leading-[22px] text-discret">
          {meta.flatMap(({ icone, marge, texte }, index) => {
            const element = icone ? (
              <span key={texte} className="flex items-center gap-1">
                <Icon icon={icone} size={18} className={marge} />
                {texte}
              </span>
            ) : (
              <span key={texte}>{texte}</span>
            );
            return index === 0 ? [element] : [<MetaDot key={`point-${texte}`} />, element];
          })}
        </div>
      </div>
      <div aria-hidden="true" className="mt-5 h-px bg-[#DBE0EB]" />

      {/* Sur un écran étroit, la colonne de droite (accès) passe au-dessus du contenu (wrap-reverse, comme le design). */}
      <div className="mt-8 flex flex-wrap-reverse items-end gap-8">
        <div className="flex min-w-0 flex-[999_1_420px] flex-col gap-9">
          {(fiche.objectifs.length > 0 || fiche.competences.length > 0) && (
            <div className="flex min-w-0 flex-col gap-4">
              <EnTeteSection titre="Ce que vous allez apprendre" />
              <div className="flex min-w-0 flex-col gap-[18px]">
                <ListeCochee
                  elements={fiche.objectifs}
                  couleur="text-reussite-texte"
                  taille="text-sm"
                  colonnes="grid-cols-[repeat(auto-fill,minmax(min(100%,max(240px,calc((100%-12px)/2))),1fr))] gap-3"
                />
                {fiche.competences.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] leading-5 font-medium text-discret">Compétences acquises</span>
                    {fiche.competences.map((c) => (
                      <Tag key={c} tone="enAttente">
                        {c}
                      </Tag>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <section aria-labelledby="programme-titre" className="flex min-w-0 flex-col gap-4">
            <EnTeteSection titre="Programme" id="programme-titre" suite={fiche.modules.length > 0 ? resumeProgramme(fiche) : undefined} />
            <ProgrammeFiche fiche={fiche} variante="connecte" progression={progression?.commencee ? progression : null} lienModifier={lienModifier} scores={scores} />
          </section>
          <SectionAvis
            variante="connecte"
            formation={{ id: fiche.id, titre: fiche.titre }}
            donnees={avis}
            peutNoter={progression ? peutDonnerAvis(progression) : false}
          />
        </div>
        <div className="min-w-0 flex-[1_1_300px]">
          <div data-couverture-fiche="" className="mb-4">
            <Couverture src={urlCouverture(fiche.couverture)} parcours={parcoursPrincipal(fiche)} sizes="(max-width: 1024px) 100vw, 400px" prioritaire className="rounded-carte" />
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,max(216px,calc((100%-32px)/3))),1fr))] gap-4">
            <CarteAcces fiche={fiche} progression={progression} favori={favori} />
            {fiche.formateur && <CarteFormateur formateur={fiche.formateur} variante="connecte" />}
            <div className={CARTE}>
              <h3 className="m-0 text-base leading-6 font-semibold text-encre">Inclus dans la formation</h3>
              <div className="mt-3.5 flex flex-col gap-3">
                {elementsInclus(fiche).map((element) => (
                  <div key={element.texte} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex flex-none text-texte">
                      <Icon icon={element.icone} size={18} />
                    </span>
                    <span className="text-sm leading-[22px] text-texte">{element.texte}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
