import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft01Icon, ArrowRight01Icon, Clock01Icon, PencilEdit02Icon, TeachingIcon } from "@hugeicons/core-free-icons";
import { adresseLecon } from "@/components/catalogue/ProgrammeFiche";
import { iconButtonVariants } from "@/components/ui/IconButton";
import { Tag } from "@/components/ui/Tag";
import { Icon } from "@/components/ui/Icon";
import { MetaDot } from "@/components/ui/Progress";
import { formatDuree } from "@/lib/admin/duree";
import { titreModule } from "@/lib/catalogue/regles";
import type { FicheFormation, TypeLecon } from "@/lib/catalogue/types";
import { rangDansFormation, situation, voisines } from "@/lib/lecon/regles";
import type { LeconDetail } from "@/lib/lecon/types";

const META = "flex flex-wrap items-center gap-[7px] text-sm leading-[22px] text-discret";

/** Une suite d'éléments séparés par des points. */
function Meta({ elements, className }: { elements: ReactNode[]; className: string }) {
  const visibles = elements.filter(Boolean);
  if (visibles.length === 0) return null;
  return (
    <div className={className}>
      {visibles.map((element, i) => (
        <span key={i} className="contents">
          {i > 0 && <MetaDot />}
          {element}
        </span>
      ))}
    </div>
  );
}

/** Une flèche ‹ › vers une voisine ; grisée quand il n'y en a pas. */
function Fleche({ vers, icone, nom }: { vers: string | null; icone: typeof ArrowLeft01Icon; nom: string }) {
  const classes = iconButtonVariants({ variant: "discret", size: "sm" });
  if (!vers) {
    return (
      <span aria-hidden="true" className={`${classes} cursor-default opacity-45`}>
        <Icon icon={icone} size={16} />
      </span>
    );
  }
  return (
    <Link href={vers} aria-label={nom} className={`${classes} no-underline`}>
      <Icon icon={icone} size={16} />
    </Link>
  );
}

/**
 * En-tête de la leçon : un seul h1, 32/40 sur ordinateur (NdLecon §2.5), 20/28 sur téléphone (NdMobLecon §3.3).
 * Au-dessus (refonte des formations, §1.3) : « Leçon 4 sur 22 », les flèches ‹ › et, pour l'équipe et le formateur de la
 * formation, « Modifier la leçon ». Ordinateur : module, puis formateur et durée. Téléphone : module et formateur.
 */
export function EnTeteLecon({ fiche, lecon, lienModifier = null, type = "lecon" }: { fiche: FicheFormation; lecon: LeconDetail; lienModifier?: string | null; type?: TypeLecon }) {
  const ou = situation(fiche.modules, lecon.id);
  const rang = rangDansFormation(fiche.modules, lecon.id);
  const { precedente, suivante } = voisines(fiche.modules, lecon.id);
  const nomModule = ou ? titreModule(ou.numero, ou.titreModule) : "";
  const formateur = fiche.formateur?.nom ?? "";
  // Le même format court que dans les programmes (« 12:40 ») : une seule écriture de la durée d'une leçon.
  const duree = formatDuree(lecon.dureeSecondes);
  return (
    <div>
      {(rang || lienModifier) && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          {rang && (
            <div className="-ml-2 flex items-center gap-1 text-sm leading-[22px] text-discret max-sm:text-[13px]">
              <Fleche vers={precedente && adresseLecon(fiche.slug, precedente.id)} icone={ArrowLeft01Icon} nom="Aller à la leçon précédente" />
              <span>{`Leçon ${rang.rang} sur ${rang.total}`}</span>
              <Fleche vers={suivante && adresseLecon(fiche.slug, suivante.id)} icone={ArrowRight01Icon} nom="Aller à la leçon suivante" />
            </div>
          )}
          {lienModifier && (
            <Link
              href={lienModifier}
              className="focus-etudium ml-auto flex items-center gap-1.5 rounded-champ text-sm leading-[22px] font-medium text-bleu no-underline hover:underline max-sm:text-[13px]"
            >
              <Icon icon={PencilEdit02Icon} size={16} />
              <span>{type === "quiz" ? "Modifier le quiz" : type === "exercice" ? "Modifier l’exercice" : "Modifier la leçon"}</span>
            </Link>
          )}
        </div>
      )}
      {nomModule && <p className="m-0 text-sm leading-[22px] text-pretty text-discret max-lg:hidden">{nomModule}</p>}
      {lecon.brouillon && (
        <p className="m-0 mb-1.5 flex flex-wrap items-center gap-2 text-[13px] leading-5 text-discret">
          <Tag tone="aCorriger">Brouillon</Tag>
          <span>Les étudiants voient encore la version en ligne.</span>
        </p>
      )}
      <h1 className="m-0 text-xl leading-7 font-semibold text-balance text-encre lg:mt-1 lg:text-[32px] lg:leading-10 lg:font-medium lg:tracking-[-0.01em] lg:text-titre">
        {lecon.titre}
      </h1>
      <Meta
        className={`${META} mt-2.5 max-lg:hidden`}
        elements={[
          formateur && (
            <span className="flex items-center gap-1">
              <Icon icon={TeachingIcon} size={18} />
              <span>{formateur}</span>
            </span>
          ),
          duree && (
            <span className="flex items-center gap-1">
              <Icon icon={Clock01Icon} size={18} className="-mx-[1.5px]" />
              <span>{duree}</span>
            </span>
          ),
        ]}
      />
      <Meta className={`${META} mt-1 lg:hidden`} elements={[nomModule && <span>{nomModule}</span>, formateur && <span>{formateur}</span>]} />
    </div>
  );
}
