import Link from "next/link";
import { ArrowRight01Icon, ArrowRight02Icon, Clock01Icon, SquareLock02Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/Icon";
import { MetaDot } from "@/components/ui/Progress";
import { Tag, type TagTone } from "@/components/ui/Tag";
import { Heading, Lead } from "@/components/ui/Text";
import { dureeLisible, etatAcces, leconsApercu, nombreDeLecons, parcoursPrincipal, premiereLeconOuverte } from "@/lib/catalogue/regles";
import type { FicheFormation } from "@/lib/catalogue/types";
import { libelleNiveau } from "@/lib/contenus/libelles";
import { AvisVides, CarteFormateur, elementsInclus, ListeCochee } from "./BlocsFiche";
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
 * Carte d'accès (à droite) : commencer une formation ouverte, voir l'aperçu, ou savoir qu'elle est verrouillée.
 * La progression (« 68 % », « Continuer ») arrive en 1.7, les favoris en 1.9, les formules au lot 2.
 */
function CarteAcces({ fiche }: { fiche: FicheFormation }) {
  const etat = etatAcces(fiche, true);
  const parcours = [...fiche.parcours].sort((a, b) => a.ordre - b.ordre)[0];
  const premiere = premiereLeconOuverte(fiche);
  const apercus = leconsApercu(fiche);
  return (
    <div className={CARTE}>
      {etat === "gratuite" && (
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
      {etat === "apercu" && (
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
      {etat === "verrouillee" && (
        <>
          <span className="flex items-center gap-2 text-base leading-6 font-semibold text-encre">
            <Icon icon={SquareLock02Icon} size={18} />
            Formation verrouillée
          </span>
          <p className="m-0 mt-2 text-sm leading-[22px] text-texte">Incluse dans les formules Basique, Standard et Premium.</p>
        </>
      )}
      {parcours && <p className="m-0 mt-3.5 text-center text-xs leading-[18px] text-pretty text-discret">Incluse dans le parcours {parcours.nom}.</p>}
    </div>
  );
}

/** Fiche formation pour un compte connecté (NdFormation) : en-tête, programme avec cadenas, carte d'accès. */
export function FicheConnectee({ fiche }: { fiche: FicheFormation }) {
  const parcours = [...fiche.parcours].sort((a, b) => a.ordre - b.ordre)[0];
  const duree = dureeLisible(fiche.dureeSecondes);
  const meta = [duree, libelleNiveau(fiche.niveau), fiche.nbLecons > 0 ? nombreDeLecons(fiche.nbLecons) : "", fiche.formateur?.nom ?? ""].filter(Boolean);

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
      <div className="min-w-0">
        <Heading level="page">{fiche.titre}</Heading>
        {(fiche.description || fiche.resume) && <Lead className="mt-2.5">{fiche.description || fiche.resume}</Lead>}
      </div>
      <div className="mt-[21px] flex flex-wrap items-center gap-3">
        {parcours && <Tag tone={parcoursPrincipal(fiche) as TagTone}>{parcours.nomCourt}</Tag>}
        <div className="flex flex-wrap items-center gap-[7px] text-sm leading-[22px] text-discret">
          {meta.flatMap((texte, index) => {
            const element =
              index === 0 && duree ? (
                <span key={texte} className="flex items-center gap-1">
                  <Icon icon={Clock01Icon} size={18} className="-mx-[1.5px]" />
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
            <ProgrammeFiche fiche={fiche} variante="connecte" />
          </section>
          <div className="flex min-w-0 flex-col gap-4">
            <EnTeteSection titre="Avis des étudiants" />
            <AvisVides variante="connecte" />
          </div>
        </div>
        <div className="min-w-0 flex-[1_1_300px]">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,max(216px,calc((100%-32px)/3))),1fr))] gap-4">
            <CarteAcces fiche={fiche} />
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
