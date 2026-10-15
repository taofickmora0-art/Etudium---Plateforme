import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight02Icon, Clock01Icon, PlayCircleIcon, Quiz01Icon, SmartPhone01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Avatar } from "@/components/ui/Avatar";
import { CourseIllustration } from "@/components/ui/CourseIllustration";
import { Icon, type IconSvgElement } from "@/components/ui/Icon";
import { dureeLisible, leconsApercu, nombreDeLecons, nombreDeQuiz } from "@/lib/catalogue/regles";
import type { FicheFormation, FormateurFiche } from "@/lib/catalogue/types";
import { cn } from "@/lib/cn";

/** Initiales d'un nom, sans les titres (« Dr Mireille Adjovi » → « MA »). */
export function initialesDe(nom: string) {
  const mots = nom
    .split(/\s+/)
    .filter((m) => m && !/^(dr|pr|me|mme|m)\.?$/i.test(m));
  return ((mots[0]?.[0] ?? "") + (mots.length > 1 ? (mots.at(-1)?.[0] ?? "") : "")).toUpperCase() || "?";
}

/** Ce que contient la formation, d'après ses données (le design liste aussi quiz, exercices, communauté et certificat : lots 3 et 5). */
export function elementsInclus(fiche: FicheFormation): { icone: IconSvgElement; texte: string }[] {
  const apercu = leconsApercu(fiche).length;
  const duree = dureeLisible(fiche.dureeSecondes);
  return [
    fiche.nbLecons > 0 && { icone: PlayCircleIcon, texte: duree ? `${nombreDeLecons(fiche.nbLecons)}, ${duree} au total` : nombreDeLecons(fiche.nbLecons) },
    Boolean(fiche.nbQuiz) && { icone: Quiz01Icon, texte: `${nombreDeQuiz(fiche.nbQuiz)} pour vérifier vos acquis` },
    apercu > 0 && { icone: Clock01Icon, texte: `${apercu} ${apercu > 1 ? "leçons" : "leçon"} en aperçu gratuit` },
    { icone: SmartPhone01Icon, texte: "Sur ordinateur et sur téléphone" },
  ].filter((e): e is { icone: IconSvgElement; texte: string } => Boolean(e));
}

/** Liste à coches (« Ce que vous allez apprendre », « Inclus dans la formation »). */
export function ListeCochee({ elements, couleur, taille = "text-[15px]", colonnes }: { elements: string[]; couleur: string; taille?: string; colonnes: string }) {
  return (
    <ul className={cn("m-0 grid list-none p-0", colonnes)}>
      {elements.map((element) => (
        <li key={element} className={cn("flex items-start gap-2.5 leading-[22px] text-texte", taille)}>
          <span className={cn("mt-0.5 flex flex-none", couleur)}>
            <Icon icon={Tick02Icon} size={18} />
          </span>
          <span>{element}</span>
        </li>
      ))}
    </ul>
  );
}

/** Formateur (carte de la fiche) ; absent si la formation n'en a pas. */
export function CarteFormateur({ formateur, variante }: { formateur: FormateurFiche; variante: "public" | "connecte" }) {
  const publique = variante === "public";
  return (
    <div className={cn("box-border flex min-w-0 flex-col rounded-carte", publique ? "bg-page p-[22px]" : "border border-bordure-carte bg-panneau p-5")}>
      <h3 className="m-0 text-base leading-6 font-semibold text-encre">Votre formateur·rice</h3>
      <div className={cn("flex items-center gap-3", publique ? "mt-4" : "mt-3.5")}>
        <Avatar initials={initialesDe(formateur.nom)} size={publique ? 52 : 44} />
        <span className="flex min-w-0 flex-col">
          <span className={cn("text-[15px] leading-[22px] text-encre", publique ? "font-semibold" : "font-medium")}>{formateur.nom}</span>
          <span className={cn("text-[13px] leading-5", publique ? "text-ardoise" : "text-discret")}>{publique ? formateur.domaine || formateur.titre : formateur.titre}</span>
        </span>
      </div>
      {formateur.presentation && (
        <p className={cn("m-0 text-sm leading-[22px] text-pretty", publique ? "mt-3.5 text-ardoise" : "mt-3 text-texte")}>{formateur.presentation}</p>
      )}
    </div>
  );
}

/** Pas encore d'avis : jamais de note inventée (spec §7). La phrase des 50 % s'efface quand le bouton est là. */
export function AvisVides({ variante, phrase = true }: { variante: "public" | "connecte"; phrase?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <p className={cn("m-0 font-medium text-encre", variante === "public" ? "text-lg leading-[26px]" : "text-base leading-6")}>Pas encore d’avis</p>
      {phrase && <p className="m-0 text-[13px] leading-5 text-pretty text-discret">Vous pourrez laisser un avis à partir de 50 % de progression.</p>}
    </div>
  );
}

/** Trois illustrations de parcours inclinées (bandeaux bleus). */
export function PilesParcours({ taille }: { taille: "md" | "lg" }) {
  const carre = taille === "lg" ? "size-[104px] rounded-[29px]" : "size-[84px] rounded-[24px]";
  const decalage = taille === "lg" ? "-ml-[17px]" : "-ml-[13px]";
  return (
    <div aria-hidden="true" className="flex items-center">
      {(
        [
          ["academique", "", "-rotate-7"],
          ["digital", decalage, "rotate-4"],
          ["business", decalage, "-rotate-3"],
        ] as const
      ).map(([parcours, marge, rotation]) => (
        <span key={parcours} className={cn("flex items-center justify-center bg-white shadow-[0_10px_28px_rgba(4,10,80,0.22)]", carre, marge, rotation)}>
          <CourseIllustration parcours={parcours} size={taille === "lg" ? 64 : 52} />
        </span>
      ))}
    </div>
  );
}

export const MOTIF_BLEU = "bg-bleu trame-points text-white";

/** Bande bleue d'appel à l'action, en bas des pages publiques (NdFormationPublic §5.5, NdLanding). */
export function BandeAppelAction() {
  return (
    <section className={cn("box-border rounded-panneau p-[clamp(28px,5vw,64px)]", MOTIF_BLEU)}>
      <div className="flex flex-wrap items-center justify-between gap-x-14 gap-y-8">
        <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-7">
          <div className="flex max-w-[800px] flex-col gap-4">
            <h2 className="m-0 text-[clamp(36px,4.8vw,62px)] leading-[1.08] font-medium tracking-[-0.028em] text-balance text-white">
              Commencez gratuitement dès aujourd’hui
            </h2>
            <p className="m-0 max-w-[640px] text-[17px] leading-[27px] text-pretty text-[#DDE1FF]">
              Créez votre compte en une minute, suivez les formations gratuites, puis choisissez votre formule quand vous êtes prêt.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/inscription"
              className="focus-blanc inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] bg-white px-[22px] py-3 text-center text-base leading-tight font-semibold text-bleu no-underline transition-colors hover:bg-bleu-clair"
            >
              <span>Créer mon compte gratuit</span>
              <Icon icon={ArrowRight02Icon} size={18} />
            </Link>
            <LienContourBlanc href="/formations" hauteur="min-h-[52px] px-[22px] py-3 text-base">
              Découvrir les formations
            </LienContourBlanc>
          </div>
        </div>
        {/* Les illustrations (près de 320 px de large) passent sous le texte : masquées sur petit écran pour ne pas déborder. */}
        <div data-illustrations className="flex-none px-5 py-3 max-sm:hidden">
          <PilesParcours taille="lg" />
        </div>
      </div>
    </section>
  );
}

/** Bouton contour blanc sur fond bleu (BTN-OUTLINE-W). */
export function LienContourBlanc({ href, hauteur, children }: { href: string; hauteur: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "focus-blanc box-border inline-flex items-center justify-center gap-2 rounded-[14px] border border-white/45 bg-transparent text-center leading-tight font-semibold text-white no-underline transition-colors hover:bg-white/14",
        hauteur,
      )}
    >
      {children}
    </Link>
  );
}
