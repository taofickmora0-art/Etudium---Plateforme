import Link from "next/link";
import { ArrowRight01Icon, ChartIncreaseIcon, Clock01Icon, PlayCircleIcon, StarIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import { SectionAvis } from "@/components/avis/SectionAvis";
import { formatNote, libelleNombreAvis } from "@/lib/avis/regles";
import type { AvisFormation } from "@/lib/avis/types";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { Tag, type TagTone } from "@/components/ui/Tag";
import { badgeDeCarte, dureeLisible, leconsApercu, nombreDeLecons, parcoursPrincipal } from "@/lib/catalogue/regles";
import type { FicheFormation } from "@/lib/catalogue/types";
import { libelleNiveau } from "@/lib/contenus/libelles";
import { cn } from "@/lib/cn";
import { BandeAppelAction, CarteFormateur, elementsInclus, initialesDe, LienContourBlanc, ListeCochee, MOTIF_BLEU } from "./BlocsFiche";
import { adresseLecon, ProgrammeFiche, resumeProgramme } from "./ProgrammeFiche";

const SECTION = "box-border rounded-panneau bg-panneau p-[clamp(24px,4vw,48px)]";
const TITRE_SECTION = "m-0 text-[clamp(28px,3.5vw,44px)] leading-[1.08] font-medium tracking-[-0.028em] text-balance text-titre";
const DEUX_COLONNES = "flex flex-wrap gap-14";
const GAUCHE = "min-w-0 flex-[999_1_420px]";
const DROITE = "min-w-0 flex-[1_1_360px]";

/** Carte d'offre du bandeau : ce que la personne obtient et comment (spec §3 ; prix et formules au lot 2). */
function CarteOffre({ fiche }: { fiche: FicheFormation }) {
  const parcours = [...fiche.parcours].sort((a, b) => a.ordre - b.ordre)[0];
  return (
    <div className="box-border flex min-w-0 flex-col rounded-[24px] bg-panneau p-[26px] text-texte shadow-[0_22px_56px_rgba(4,10,80,0.3)]">
      {fiche.gratuite ? (
        <>
          <h2 className="m-0 text-lg leading-[26px] font-semibold text-encre">Formation gratuite</h2>
          <p className="m-0 mt-1 text-sm leading-[22px] text-pretty text-discret">Toutes les leçons s’ouvrent avec un compte gratuit.</p>
        </>
      ) : (
        <>
          <span className="text-xs leading-[18px] text-discret">{parcours ? "Incluse dans le parcours" : "Formation"}</span>
          <h2 className="m-0 text-lg leading-[26px] font-semibold text-encre">{parcours ? parcours.nom : fiche.titre}</h2>
          <p className="m-0 mt-1 text-sm leading-[22px] text-pretty text-discret">Avec les formules Basique, Standard et Premium.</p>
        </>
      )}
      <Link
        href="/inscription"
        className="focus-etudium mt-[18px] inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-bleu px-[18px] py-3 text-center text-base leading-tight font-medium text-white no-underline transition-colors hover:bg-bleu-survol"
      >
        Créer mon compte gratuit
      </Link>
      {fiche.achatSepare && !fiche.gratuite && (
        <>
          <div aria-hidden="true" className="my-4 h-px bg-bordure-carte" />
          <p className="m-0 text-[13px] leading-5 text-pretty text-discret">Disponible aussi seule, en formation complémentaire.</p>
        </>
      )}
      <div aria-hidden="true" className="my-4 h-px bg-bordure-carte" />
      <h3 className="m-0 mb-3 text-[15px] leading-[22px] font-semibold text-encre">Inclus dans la formation</h3>
      <ul className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-2.5 p-0">
        {elementsInclus(fiche).map((element) => (
          <li key={element.texte} className="flex items-start gap-2.5 text-sm leading-[22px] text-texte">
            <span className="mt-0.5 flex flex-none text-bleu">
              <Icon icon={Tick02Icon} size={18} />
            </span>
            <span>{element.texte}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Fiche formation pour un visiteur (NdFormationPublic) : bandeau, apprentissages, programme, avis, appel à l'action. */
export function FichePublique({ fiche, avis = null }: { fiche: FicheFormation; /** Null sans la migration 0010. */ avis?: AvisFormation | null }) {
  const parcours = [...fiche.parcours].sort((a, b) => a.ordre - b.ordre)[0];
  const badge = badgeDeCarte(fiche);
  const apercus = leconsApercu(fiche);
  const premierApercu = apercus[0];
  const duree = dureeLisible(fiche.dureeSecondes);
  const meta = [
    fiche.nbAvis > 0 && fiche.note !== null && { icone: StarIcon, texte: `${formatNote(fiche.note)} (${libelleNombreAvis(fiche.nbAvis)})` },
    duree && { icone: Clock01Icon, texte: duree },
    fiche.nbLecons > 0 && { icone: PlayCircleIcon, texte: nombreDeLecons(fiche.nbLecons) },
    { icone: ChartIncreaseIcon, texte: libelleNiveau(fiche.niveau) },
  ].filter(Boolean) as { icone: typeof Clock01Icon; texte: string }[];

  return (
    <>
      <section className={cn("box-border rounded-panneau p-[clamp(24px,4vw,52px)]", MOTIF_BLEU)}>
        <nav aria-label="Fil d’Ariane" className="flex flex-wrap items-center gap-2 text-sm leading-[22px] text-[#C2C8FF]">
          <Link href="/formations" className="focus-blanc text-white no-underline hover:underline">
            Formations
          </Link>
          {parcours && (
            <>
              <Icon icon={ArrowRight01Icon} size={16} />
              <Link href={`/formations?parcours=${parcours.slug}`} className="focus-blanc text-white no-underline hover:underline">
                {parcours.nom}
              </Link>
            </>
          )}
          <Icon icon={ArrowRight01Icon} size={16} />
          <span aria-current="page">{fiche.titre}</span>
        </nav>
        <div className="mt-7 flex flex-wrap items-center gap-14">
          <div className={GAUCHE}>
            <div className="flex flex-col gap-5 pb-2">
              {(parcours || badge) && (
                <div className="flex flex-wrap items-center gap-2">
                  {parcours && <Tag tone={parcoursPrincipal(fiche) as TagTone}>{parcours.nom}</Tag>}
                  {badge && <Tag tone={badge.tone}>{badge.label}</Tag>}
                </div>
              )}
              <h1 className="m-0 text-[clamp(34px,4.4vw,58px)] leading-[1.06] font-medium tracking-[-0.03em] text-balance text-white">{fiche.titre}</h1>
              {(fiche.description || fiche.resume) && (
                <p className="m-0 max-w-[680px] text-[17px] leading-7 text-pretty text-[#DDE1FF]">{fiche.description || fiche.resume}</p>
              )}
              <div className="flex flex-wrap items-center gap-x-[22px] gap-y-2.5 text-[15px] leading-[22px] text-white">
                {meta.map((m) => (
                  <span key={m.texte} className="inline-flex items-center gap-2">
                    <span className="flex text-[#C2C8FF]">
                      <Icon icon={m.icone} size={18} />
                    </span>
                    {m.texte}
                  </span>
                ))}
              </div>
              {(fiche.formateur || premierApercu) && (
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-t border-white/20 pt-6">
                  {fiche.formateur ? (
                    <div className="flex items-center gap-3">
                      <Avatar initials={initialesDe(fiche.formateur.nom)} size={48} />
                      <span className="flex min-w-0 flex-col">
                        <span className="text-[15px] leading-[22px] font-semibold text-white">{fiche.formateur.nom}</span>
                        <span className="text-[13px] leading-5 text-[#C2C8FF]">{fiche.formateur.titre}</span>
                      </span>
                    </div>
                  ) : (
                    <span />
                  )}
                  {premierApercu && (
                    <LienContourBlanc href={adresseLecon(fiche.slug, premierApercu.id)} hauteur="min-h-11 px-4 py-2.5 text-sm">
                      <Icon icon={PlayCircleIcon} size={18} />
                      <span>Voir l’aperçu gratuit</span>
                    </LienContourBlanc>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className={DROITE}>
            <CarteOffre fiche={fiche} />
          </div>
        </div>
      </section>

      {(fiche.objectifs.length > 0 || fiche.competences.length > 0) && (
        <section className={SECTION}>
          <div className={cn(DEUX_COLONNES, "items-center")}>
            <div className={GAUCHE}>
              <h2 className={TITRE_SECTION}>Ce que vous allez apprendre</h2>
              <div className="mt-6">
                <ListeCochee elements={fiche.objectifs} couleur="text-bleu" colonnes="grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-x-6 gap-y-3.5" />
              </div>
            </div>
            {fiche.competences.length > 0 && (
              <div className={DROITE}>
                <div className="rounded-[24px] bg-bleu-clair p-6">
                  <h3 className="m-0 text-lg leading-[26px] font-semibold text-encre">Compétences acquises</h3>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {fiche.competences.map((c) => (
                      <span key={c} className="inline-flex h-9 items-center rounded-full bg-panneau px-3.5 text-sm font-medium text-bleu">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <section aria-labelledby="programme-titre" className={SECTION}>
        <div className={cn(DEUX_COLONNES, "items-start")}>
          <div className={GAUCHE}>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
              <h2 id="programme-titre" className={TITRE_SECTION}>
                Programme
              </h2>
              <p className="m-0 text-sm leading-[22px] text-discret">{resumeProgramme(fiche)}</p>
            </div>
            <ProgrammeFiche fiche={fiche} variante="public" />
          </div>
          {(fiche.formateur || premierApercu) && (
            <div className={DROITE}>
              <div className="flex min-w-0 flex-col gap-4">
                {fiche.formateur && <CarteFormateur formateur={fiche.formateur} variante="public" />}
                {premierApercu && (
                  <div className="box-border flex min-w-0 flex-col rounded-carte border border-bordure-carte bg-panneau px-[22px] pt-5 pb-[22px]">
                    <div className="flex items-center gap-3">
                      <span className="flex size-11 flex-none items-center justify-center rounded-[13px] bg-bleu-pale text-bleu">
                        <Icon icon={PlayCircleIcon} size={20} />
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="text-[15px] leading-[22px] font-semibold text-encre">Aperçu gratuit</span>
                        <span className="text-[13px] leading-5 text-discret">{nombreDeLecons(apercus.length)}</span>
                      </span>
                    </div>
                    <Link
                      href={adresseLecon(fiche.slug, premierApercu.id)}
                      className="focus-etudium mt-4 inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-champ border border-bordure bg-panneau px-[15px] text-sm leading-none font-medium whitespace-nowrap text-texte no-underline transition-colors hover:bg-page"
                    >
                      Voir l’aperçu gratuit
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className={SECTION}>
        <h2 className={TITRE_SECTION}>Avis des étudiants</h2>
        <div className="mt-7">
          <SectionAvis variante="public" formation={{ id: fiche.id, titre: fiche.titre }} donnees={avis} peutNoter={false} />
        </div>
      </section>

      <BandeAppelAction />
    </>
  );
}
