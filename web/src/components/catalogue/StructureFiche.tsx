import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight01Icon, BookOpen01Icon, StarIcon } from "@hugeicons/core-free-icons";
import { AvatarFormateur } from "@/components/formateurs/AvatarFormateur";
import { CarteFormateurSurvol } from "@/components/formateurs/CarteFormateurSurvol";
import { ReseauxFormateur } from "@/components/formateurs/ReseauxFormateur";
import { Icon } from "@/components/ui/Icon";
import { MetaDot } from "@/components/ui/Progress";
import { Tag, type TagTone } from "@/components/ui/Tag";
import { Heading, Lead } from "@/components/ui/Text";
import { formatNote, libelleNombreAvis } from "@/lib/avis/regles";
import { parcoursPrincipal } from "@/lib/catalogue/regles";
import type { FicheFormation } from "@/lib/catalogue/types";
import { libelleNiveau } from "@/lib/contenus/libelles";
import { nombreDeFormations } from "@/lib/formateurs/regles";
import type { ApercuFormateur } from "@/lib/formateurs/types";
import { CarteFormateur, elementsInclus, ListeCochee } from "./BlocsFiche";
import { resumeProgramme } from "./ProgrammeFiche";
import { TagFormateur } from "@/components/formateurs/TagFormateur";

// La structure de la fiche d'une formation, la même pour un visiteur et pour un compte connecté (spec du 2 novembre 2026,
// §5) : en haut, le fil et un seul bouton ; à gauche, le titre, « Contenus du cours » et la suite ; à droite, le
// formateur, l'accès et « Inclus dans la formation ». La couverture n'y est plus (elle reste sur la carte du catalogue).

export const CARTE_FICHE = "box-border flex min-w-0 flex-col rounded-carte border border-bordure-carte bg-panneau p-5 max-sm:p-4";
const TITRE_SECTION = "m-0 text-xl leading-7 font-semibold text-encre max-sm:text-lg max-sm:leading-[26px]";
export const TITRE_CARTE = "m-0 text-base leading-6 font-semibold text-encre max-sm:text-[15px] max-sm:leading-[22px]";

/** Le bouton du haut : plus petit sur téléphone, où il passe en pleine largeur sous le fil. */
export const BOUTON_FICHE = "max-sm:h-11 max-sm:w-full max-sm:px-4 max-sm:text-[15px]";

/** En haut : le fil « Formations / Titre » et, à droite, le bouton d'action (sous le fil, en pleine largeur, si la place manque). */
export function EnTeteFiche({ fiche, action }: { fiche: Pick<FicheFormation, "titre">; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <nav aria-label="Fil d’Ariane" className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm leading-5 max-sm:text-[13px]">
        <Link href="/formations" className="focus-etudium text-discret no-underline hover:text-texte">
          Formations
        </Link>
        <span className="flex text-discret">
          <Icon icon={ArrowRight01Icon} size={14} />
        </span>
        <span aria-current="page" className="min-w-0 font-medium text-encre">
          {fiche.titre}
        </span>
      </nav>
      {action && <div className="ml-auto flex flex-none max-sm:w-full">{action}</div>}
    </div>
  );
}

/** Le titre, « 4 modules • 12 leçons • 2 h 20 », la description, puis le parcours, la note et le niveau. */
export function TitreFiche({ fiche, note, nbAvis }: { fiche: FicheFormation; note: number | null; nbAvis: number }) {
  const parcours = [...fiche.parcours].sort((a, b) => a.ordre - b.ordre)[0];
  const meta = [nbAvis > 0 && note !== null && { etoile: true, texte: `${formatNote(note)} (${libelleNombreAvis(nbAvis)})` }, { etoile: false, texte: libelleNiveau(fiche.niveau) }].filter(Boolean) as {
    etoile: boolean;
    texte: string;
  }[];
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <Heading level="page">{fiche.titre}</Heading>
      {fiche.modules.length > 0 && <p className="m-0 text-[15px] leading-[22px] font-medium text-texte max-sm:text-sm max-sm:leading-5">{resumeProgramme(fiche)}</p>}
      {(fiche.description || fiche.resume) && <Lead className="text-discret">{fiche.description || fiche.resume}</Lead>}
      <div className="mt-1 flex flex-wrap items-center gap-3">
        {parcours && <Tag tone={parcoursPrincipal(fiche) as TagTone}>{parcours.nomCourt}</Tag>}
        <div className="flex flex-wrap items-center gap-[7px] text-sm leading-[22px] text-discret max-sm:text-[13px] max-sm:leading-5">
          {meta.flatMap(({ etoile, texte }, index) => {
            const element = etoile ? (
              <span key={texte} className="flex items-center gap-1">
                <Icon icon={StarIcon} size={18} className="-mx-px" />
                {texte}
              </span>
            ) : (
              <span key={texte}>{texte}</span>
            );
            return index === 0 ? [element] : [<MetaDot key={`point-${texte}`} />, element];
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * La mise en page : le titre et le contenu à gauche, la colonne à droite. Quand la place manque (téléphone, tablette),
 * une seule colonne : le titre, la colonne de droite (formateur, accès), puis le contenu.
 */
export function MiseEnPageFiche({ entete, titre, cote, children }: { entete: ReactNode; titre: ReactNode; cote: ReactNode; children: ReactNode }) {
  return (
    <div className="@container flex min-w-0 flex-col">
      {entete}
      <div aria-hidden="true" className="mt-4 h-px bg-[#DBE0EB] max-sm:mt-3.5" />
      <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-8 max-sm:mt-5 max-sm:gap-y-6 @3xl:grid-cols-[minmax(0,1fr)_300px] @3xl:grid-rows-[auto_1fr] @5xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 @3xl:col-start-1 @3xl:row-start-1">{titre}</div>
        <div className="min-w-0 @3xl:col-start-2 @3xl:row-span-2 @3xl:row-start-1">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,max(216px,calc((100%-32px)/3))),1fr))] gap-4">{cote}</div>
        </div>
        <div className="flex min-w-0 flex-col gap-9 max-sm:gap-7 @3xl:col-start-1 @3xl:row-start-2">{children}</div>
      </div>
    </div>
  );
}

/** Le titre d'une section de la colonne principale. */
export function TitreSection({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className={TITRE_SECTION}>
      {children}
    </h2>
  );
}

/** « Ce que vous allez apprendre » et « Compétences acquises » (sous « Contenus du cours »). */
export function ApprentissagesFiche({ fiche }: { fiche: Pick<FicheFormation, "objectifs" | "competences"> }) {
  if (fiche.objectifs.length === 0 && fiche.competences.length === 0) return null;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <TitreSection>Ce que vous allez apprendre</TitreSection>
      <div className="flex min-w-0 flex-col gap-[18px]">
        <ListeCochee
          elements={fiche.objectifs}
          couleur="text-reussite-texte"
          taille="text-sm max-sm:text-[13px]"
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
  );
}

/** « Inclus dans la formation », en bas de la colonne de droite. */
export function CarteInclus({ fiche }: { fiche: FicheFormation }) {
  return (
    <section aria-labelledby="inclus-titre" className={CARTE_FICHE}>
      <h2 id="inclus-titre" className={TITRE_CARTE}>
        Inclus dans la formation
      </h2>
      <ul className="m-0 mt-3.5 flex list-none flex-col gap-3 p-0">
        {elementsInclus(fiche).map((element) => (
          <li key={element.texte} className="flex items-start gap-2.5">
            <span className="mt-0.5 flex flex-none text-texte">
              <Icon icon={element.icone} size={18} />
            </span>
            <span className="text-sm leading-[22px] text-texte max-sm:text-[13px] max-sm:leading-5">{element.texte}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * « Formateur du cours » (spec du 2 novembre 2026, §5) : photo ou initiales, nom (lien vers son profil, carte au survol),
 * « Formateur », « N formations », présentation et réseaux. Sans la migration 0070 (ou si sa fiche ne se lit pas) : le
 * bloc d'avant, sans survol ni « Message ». Formation sans formateur : rien.
 */
export function FormateurDuCours({ fiche, formateur }: { fiche: Pick<FicheFormation, "formateur">; formateur: ApercuFormateur | null }) {
  if (!formateur) return fiche.formateur ? <CarteFormateur formateur={fiche.formateur} /> : null;
  return (
    <section aria-labelledby="formateur-titre" className={CARTE_FICHE}>
      <h2 id="formateur-titre" className={TITRE_CARTE}>
        Formateur du cours
      </h2>
      <div className="mt-3.5 flex items-center gap-3">
        <AvatarFormateur nom={formateur.nom} photoUrl={formateur.photoUrl} taille={52} className="max-sm:size-11 max-sm:text-base" />
        <div className="flex min-w-0 flex-col items-start gap-1">
          <CarteFormateurSurvol formateur={formateur} className="text-[15px] leading-[22px] font-semibold max-sm:text-sm max-sm:leading-5" />
          {formateur.titre && <span className="text-[13px] leading-5 text-discret max-sm:text-xs max-sm:leading-[18px]">{formateur.titre}</span>}
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <TagFormateur id={formateur.id} />
            <span className="flex items-center gap-1 text-[13px] leading-5 text-discret max-sm:text-xs">
              <Icon icon={BookOpen01Icon} size={16} />
              <span>{nombreDeFormations(formateur.nbFormations)}</span>
            </span>
          </div>
        </div>
      </div>
      {formateur.presentation && <p className="m-0 mt-3 text-sm leading-[22px] text-pretty text-texte max-sm:text-[13px] max-sm:leading-5">{formateur.presentation}</p>}
      <ReseauxFormateur nom={formateur.nom} reseaux={formateur.reseaux} className="mt-3.5" />
    </section>
  );
}
