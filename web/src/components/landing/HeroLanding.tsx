import type { ReactNode } from "react";
import { ArrowRight02Icon, Certificate01Icon, CheckmarkCircle02Icon, Video01Icon } from "@hugeicons/core-free-icons";
import { LienBlanc, LienContourBlanc, MOTIF_BLEU } from "@/components/catalogue/BlocsFiche";
import { Avatar, AvatarGroup } from "@/components/ui/Avatar";
import { CourseIllustration } from "@/components/ui/CourseIllustration";
import { Icon } from "@/components/ui/Icon";
import { IconTile } from "@/components/ui/IconTile";
import { ProgressBar, ProgressMeta } from "@/components/ui/Progress";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/lib/cn";
import { Pastille } from "./BlocsLanding";

const OMBRE_FLOTTANTE = "shadow-[0_22px_56px_rgba(4,10,80,0.3)]";

/** Les trois parcours du lancement (bande du hero) : texte fixe, comme « Trois parcours au lancement » (Q3). */
const PUCES_PARCOURS = [
  { nom: "Réussite académique", couleur: "bg-bleu-moyen" },
  { nom: "Compétences digitales", couleur: "bg-digital-clair" },
  { nom: "Business & revenus en ligne", couleur: "bg-business-clair" },
];

/** Une ligne de la liste de l'illustration : tuile, titre et sous-titre. */
function LigneIllustration({ tuile, titre, sousTitre, fin }: { tuile: ReactNode; titre: string; sousTitre: ReactNode; fin?: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center gap-3.5 px-1 py-3.5">
      {tuile}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] leading-[22px] font-medium text-encre">{titre}</span>
        <span className="text-[13px] leading-5 text-discret">{sousTitre}</span>
      </span>
      {fin}
    </div>
  );
}

/**
 * Illustration du hero (annexe §3.2) : une formation en cours, un certificat obtenu, un exercice validé et une session
 * live. Données inventées : décorative (non lue, sans lien), masquée sur téléphone où elle n'aurait pas la place.
 */
function IllustrationHero() {
  return (
    <div aria-hidden="true" className="mx-auto flex w-full max-w-[480px] flex-col pt-3 pb-2 text-texte">
      <div className={cn("box-border flex w-[82%] -rotate-3 flex-col rounded-carte border border-bordure-carte bg-panneau px-[19px] pt-[22px] pb-[17px]", OMBRE_FLOTTANTE)}>
        <div className="flex items-start justify-between gap-2">
          <span className="ml-1">
            <CourseIllustration parcours="academique" size={48} />
          </span>
          <Tag tone="academique">Académique</Tag>
        </div>
        <span className="mt-[21px] truncate text-base leading-6 font-semibold text-encre">Maîtriser Microsoft Excel</span>
        <span className="mt-[11px] text-xs leading-5 text-discret">Module 3 : les tableaux croisés dynamiques</span>
        <ProgressBar value={68} className="mt-[17px] -ml-px" />
        <ProgressMeta value={68} timeLabel="2 h restantes" className="mt-2 flex-nowrap" />
      </div>
      <div className={cn("relative -mt-3.5 flex rotate-2 items-center gap-3 self-end rounded-carte bg-panneau py-2.5 pr-[18px] pl-2.5", OMBRE_FLOTTANTE)}>
        <IconTile icon={Certificate01Icon} size={44} tone="reussite" />
        <span className="flex min-w-0 flex-col">
          <span className="text-sm leading-[22px] font-semibold text-encre">Certificat obtenu</span>
          <span className="text-[13px] leading-5 text-discret">Microsoft Word · vérifiable par QR Code</span>
        </span>
      </div>
      <div className={cn("box-border mt-[18px] mr-2.5 flex w-[86%] rotate-[1.5deg] flex-col self-end rounded-carte bg-panneau px-4 py-1", OMBRE_FLOTTANTE)}>
        <LigneIllustration tuile={<IconTile icon={CheckmarkCircle02Icon} size={44} tone="neutre" />} titre="Exercice validé" sousTitre="Corrigé par votre formatrice" />
        <div className="h-px bg-bordure-carte" />
        <LigneIllustration
          tuile={<IconTile icon={Video01Icon} size={44} tone="information" />}
          titre="Session live"
          sousTitre={
            <>
              <span className="block">Excel avancé : analyse de données</span>
              <span className="block">Samedi · 15 h 00 · en ligne</span>
            </>
          }
          fin={
            <AvatarGroup>
              <Avatar initials="RH" size={32} tone="violet" />
              <Avatar initials="FA" size={32} tone="bleu" />
              <Avatar initials="SD" size={32} tone="ambre" />
            </AvatarGroup>
          }
        />
      </div>
    </div>
  );
}

/** Hero de la landing (NdLanding §3) : la promesse, l'inscription, l'illustration et les trois parcours. */
export function HeroLanding() {
  return (
    <section
      aria-labelledby="titre-accueil"
      className={cn(
        "box-border min-w-0 rounded-panneau px-[clamp(28px,5vw,72px)] pt-[clamp(28px,5vw,72px)] pb-[clamp(24px,3vw,40px)] max-sm:px-5 max-sm:pt-7 max-sm:pb-6",
        MOTIF_BLEU,
      )}
    >
      <div className="flex flex-wrap items-center gap-14">
        <div className="min-w-0 flex-[999_1_420px]">
          <div className="flex flex-col gap-[22px] max-sm:gap-4">
            <Pastille ton="surBleu">Formation · Pratique · Accompagnement</Pastille>
            <h1
              id="titre-accueil"
              className="m-0 max-w-[760px] text-[clamp(38px,4.9vw,68px)] leading-[1.04] font-medium tracking-[-0.035em] text-balance text-white max-sm:text-[34px] max-sm:leading-[1.08]"
            >
              Les compétences qui comptent, pendant vos études et après.
            </h1>
            <p className="m-0 max-w-[620px] text-lg leading-[29px] text-pretty text-bleu-pale max-sm:text-base max-sm:leading-[26px]">
              Étudium accompagne les étudiants et les jeunes diplômés : outils universitaires, compétences digitales et activités en ligne. Vous
              apprenez, vous pratiquez, un formateur vous accompagne, et vous obtenez un certificat vérifiable.
            </p>
            <div className="mt-1.5 flex flex-wrap gap-3">
              <LienBlanc href="/inscription">
                <span>Créer mon compte gratuit</span>
                <Icon icon={ArrowRight02Icon} size={18} />
              </LienBlanc>
              <LienContourBlanc href="/formations" hauteur="min-h-[52px] px-[22px] py-3 text-base">
                Découvrir les formations
              </LienContourBlanc>
            </div>
            <p className="m-0 text-sm leading-[22px] text-bleu-bord">Compte gratuit, sans engagement. Paiement par Mobile Money quand vous êtes prêt.</p>
          </div>
        </div>
        <div className="min-w-0 flex-[1_1_440px] max-sm:hidden">
          <IllustrationHero />
        </div>
      </div>
      <div className="mt-[clamp(32px,4vw,56px)] flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-white/20 pt-6">
        <span className="mr-2 text-sm leading-[22px] text-bleu-bord">Trois parcours au lancement</span>
        {PUCES_PARCOURS.map((puce) => (
          <a
            key={puce.nom}
            href="#parcours"
            className="focus-blanc inline-flex min-h-10 items-center gap-[9px] rounded-full bg-white/12 py-2 pr-4 pl-3 text-sm leading-5 font-medium text-white no-underline transition-colors hover:bg-white/20 max-sm:min-h-9"
          >
            <span aria-hidden="true" className={cn("size-2.5 flex-none rounded-full", puce.couleur)} />
            {puce.nom}
          </a>
        ))}
      </div>
    </section>
  );
}
