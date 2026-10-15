import type { ReactNode } from "react";
import {
  AssignmentsIcon,
  BubbleChatIcon,
  Certificate01Icon,
  CheckmarkCircle02Icon,
  PlayCircleIcon,
  QrCodeIcon,
  Quiz01Icon,
  Target02Icon,
  TeachingIcon,
  Video01Icon,
} from "@hugeicons/core-free-icons";
import { Avatar, AvatarGroup } from "@/components/ui/Avatar";
import { CourseIllustration } from "@/components/ui/CourseIllustration";
import { Icon, type IconSvgElement } from "@/components/ui/Icon";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/lib/cn";
import { ATOUTS, ETAPES, PROBLEMES } from "@/lib/landing/textes";
import { EnTeteSection, SECTION_BLANCHE, SECTION_NUE } from "./BlocsLanding";

// Sections à texte fixe de la landing (NdLanding §4, §5, §7, §10).

const TONS_TUILE = {
  bleu: "bg-bleu-pale text-bleu",
  business: "bg-[#FFEDD9] text-business-texte",
  digital: "bg-premium-fond text-premium-texte",
  reussite: "bg-reussite-fond text-reussite-texte",
} as const;

/** Tuile d'icône (TUILE) : 48 px (cartes « La solution ») ou 44 px (atouts), aux couleurs des parcours. */
function Tuile({ icon, taille, ton }: { icon: IconSvgElement; taille: 44 | 48; ton: keyof typeof TONS_TUILE }) {
  return (
    <span className={cn("flex flex-none items-center justify-center", taille === 48 ? "size-12 rounded-bouton" : "size-11 rounded-[13px]", TONS_TUILE[ton])}>
      <Icon icon={icon} size={taille === 48 ? 22 : 20} />
    </span>
  );
}

const NUMERO = (n: number) => String(n + 1).padStart(2, "0");

/** « Vous vous reconnaissez ? » (§4) : quatre difficultés, en liste numérotée. */
export function SectionProblemes() {
  return (
    <section aria-labelledby="titre-problemes" className={SECTION_BLANCHE}>
      <div className="flex flex-wrap items-start gap-16 max-sm:gap-6">
        <div className="min-w-0 flex-[1_1_420px]">
          <EnTeteSection
            pastille="Vous vous reconnaissez ?"
            ton="bleu"
            titre="Le diplôme ne suffit plus. Les outils et les compétences font la différence."
            idTitre="titre-problemes"
          />
        </div>
        <ol className="min-w-0 flex-[999_1_420px] list-none border-b border-separateur p-0">
          {PROBLEMES.map((probleme, i) => (
            <li key={probleme.titre} className="flex gap-[clamp(16px,2.4vw,28px)] border-t border-separateur py-[26px] max-sm:py-5">
              <span aria-hidden="true" className="w-[58px] flex-none text-[38px] leading-10 font-medium tracking-[-0.04em] text-bleu max-sm:w-10 max-sm:text-[28px] max-sm:leading-8">
                {NUMERO(i)}
              </span>
              <div className="min-w-0">
                <h3 className="mt-1 mb-0 text-xl leading-7 font-semibold tracking-[-0.01em] text-encre max-sm:mt-0.5 max-sm:text-lg max-sm:leading-[26px]">{probleme.titre}</h3>
                <p className="mt-2 mb-0 max-w-[560px] text-[15px] leading-6 text-pretty text-discret">{probleme.texte}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** Une ligne des illustrations de « La solution » (LIGNE-MINI) : icône, texte coupé, élément de fin. */
function LigneMini({ debut, texte, fin }: { debut: ReactNode; texte: string; fin: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center gap-3 text-sm leading-[22px] text-texte [&+&]:border-t [&+&]:border-bordure-carte">
      {debut}
      <span className="min-w-0 flex-1 truncate font-medium">{texte}</span>
      {fin}
    </div>
  );
}

const icone = (icon: IconSvgElement, couleur: string) => (
  <span className={cn("flex flex-none", couleur)}>
    <Icon icon={icon} size={20} />
  </span>
);
const discret = (texte: string) => <span className="text-[13px] text-discret">{texte}</span>;

const PILE_AVATARS = (
  <AvatarGroup>
    <Avatar initials="RH" size={32} tone="violet" />
    <Avatar initials="FA" size={32} tone="bleu" />
    <Avatar initials="SD" size={32} tone="ambre" />
  </AvatarGroup>
);

/** Les quatre cartes de « La solution » (§5) : texte, tuile et une illustration (inventée, non lue). */
const SOLUTIONS: { icon: IconSvgElement; ton: keyof typeof TONS_TUILE; titre: string; texte: string; teinte: string; illustration: ReactNode }[] = [
  {
    icon: Video01Icon,
    ton: "bleu",
    titre: "Des formations courtes",
    texte: "Des vidéos découpées en leçons, des ressources à télécharger et une progression toujours visible.",
    teinte: "bg-bleu-clair",
    illustration: (
      <>
        <LigneMini debut={icone(CheckmarkCircle02Icon, "text-bleu")} texte="Trier et filtrer" fin={discret("08:12")} />
        <LigneMini debut={icone(PlayCircleIcon, "text-bleu")} texte="Les tableaux croisés dynamiques" fin={discret("12:40")} />
        <LigneMini debut={icone(PlayCircleIcon, "text-discret")} texte="Les graphiques avancés" fin={discret("10:05")} />
      </>
    ),
  },
  {
    icon: AssignmentsIcon,
    ton: "business",
    titre: "De la pratique",
    texte: "Des quiz et des exercices corrigés par un formateur pour vérifier que vous savez faire.",
    teinte: "bg-[#FFF3E6]",
    illustration: (
      <>
        <LigneMini debut={icone(Quiz01Icon, "text-business-texte")} texte="Quiz du module 3" fin={<Tag tone="reussi">Réussi</Tag>} />
        <LigneMini debut={icone(AssignmentsIcon, "text-business-texte")} texte="Exercice pratique" fin={<Tag tone="valide">Validé</Tag>} />
        <LigneMini debut={icone(AssignmentsIcon, "text-discret")} texte="Exercice : nettoyer une enquête" fin={<Tag tone="aCorriger">À rendre</Tag>} />
      </>
    ),
  },
  {
    icon: TeachingIcon,
    ton: "digital",
    titre: "Un accompagnement",
    texte: "Des sessions live, une messagerie avec votre formateur et une communauté qui s’entraide.",
    teinte: "bg-[#F3F0FE]",
    illustration: (
      <>
        <LigneMini debut={<Avatar initials="MA" size={32} />} texte="Dr Mireille Adjovi" fin={discret("Votre formatrice")} />
        <LigneMini debut={icone(Video01Icon, "text-premium-texte")} texte="Session live · samedi · 15 h 00" fin={PILE_AVATARS} />
        <LigneMini debut={icone(BubbleChatIcon, "text-premium-texte")} texte="Espace Académique" fin={discret("24 réponses")} />
      </>
    ),
  },
  {
    icon: Certificate01Icon,
    ton: "reussite",
    titre: "Des certificats vérifiables",
    texte: "Chaque certificat porte un QR Code : un recruteur peut vérifier son authenticité en un instant.",
    teinte: "bg-[#EAF7EF]",
    illustration: null,
  },
];

/** L'illustration de la carte « Des certificats vérifiables » : un certificat et son QR Code. */
function CertificatIllustre() {
  return (
    <div className="flex items-center gap-4 rounded-[14px] bg-panneau p-[18px] max-sm:gap-3 max-sm:p-3.5">
      {/* La pile laisse la place au texte sur les plus petits écrans. */}
      <span className="flex flex-none max-[400px]:hidden">
        <CourseIllustration parcours="academique" size={52} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs leading-[18px] tracking-[0.04em] text-discret uppercase">Certificat de réussite</span>
        <span className="text-base leading-6 font-semibold text-encre">Maîtriser Microsoft Excel</span>
        <span className="text-[13px] leading-5 text-discret">ET-2026-EXC-4821</span>
      </span>
      <span className="flex size-[60px] flex-none items-center justify-center rounded-champ bg-[#EAF7EF] text-[#15803D] max-sm:size-12">
        <Icon icon={QrCodeIcon} size={36} />
      </span>
    </div>
  );
}

/** « La solution » (§5) : quatre cartes sur deux colonnes, illustrées. */
export function SectionSolution() {
  return (
    <section aria-labelledby="titre-solution" className={SECTION_NUE}>
      <EnTeteSection
        pastille="La solution"
        ton="blanc"
        titre="Un seul endroit pour apprendre, pratiquer et être accompagné"
        idTitre="titre-solution"
        chapeau="Étudium n’est pas une simple bibliothèque de vidéos. Chaque formation combine cours, exercices corrigés, accompagnement et certification."
        centre
      />
      <div className="mt-10 grid grid-cols-[repeat(auto-fill,minmax(min(100%,max(320px,calc((100%-20px)/2))),1fr))] gap-5 max-sm:mt-6 max-sm:gap-3">
        {SOLUTIONS.map((solution) => (
          <div key={solution.titre} className="box-border flex min-w-0 flex-col rounded-bloc bg-panneau p-[clamp(22px,2.6vw,32px)] max-sm:p-5">
            <Tuile icon={solution.icon} taille={48} ton={solution.ton} />
            <h3 className="mt-[22px] mb-0 text-[22px] leading-[30px] font-semibold tracking-[-0.015em] text-encre max-sm:mt-4 max-sm:text-xl max-sm:leading-7">{solution.titre}</h3>
            <p className="mt-2 mb-0 max-w-[480px] text-[15px] leading-6 text-pretty text-discret">{solution.texte}</p>
            <div aria-hidden="true" className="mt-[26px] flex flex-1 items-end max-sm:mt-5">
              <div className={cn("box-border w-full rounded-[20px] p-3.5 max-sm:p-2.5", solution.teinte)}>
                {solution.illustration ? <div className="rounded-[14px] bg-panneau px-4 py-1 max-sm:px-3">{solution.illustration}</div> : <CertificatIllustre />}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** « Comment ça marche » (§7) : quatre étapes numérotées sur fond bleu nuit. */
export function SectionEtapes() {
  return (
    <section aria-labelledby="titre-etapes" className="box-border min-w-0 rounded-panneau bg-bleu-nuit trame-points p-[clamp(28px,5vw,64px)] text-white max-sm:px-5 max-sm:py-7">
      <EnTeteSection pastille="Comment ça marche" ton="surBleu" titre="Quatre étapes, de l’inscription au certificat" idTitre="titre-etapes" blanc />
      <ol className="mt-11 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,max(210px,calc((100%-72px)/4))),1fr))] gap-6 p-0 max-sm:mt-7 max-sm:gap-5">
        {ETAPES.map((etape, i) => (
          <li key={etape.titre} className="flex min-w-0 flex-col border-t border-white/24 pt-6 max-sm:pt-4">
            <span aria-hidden="true" className="text-[60px] leading-[60px] font-medium tracking-[-0.05em] text-bleu-moyen max-sm:text-[40px] max-sm:leading-10">
              {NUMERO(i)}
            </span>
            <h3 className="mt-6 mb-0 text-[19px] leading-[27px] font-semibold text-white max-sm:mt-3 max-sm:text-lg max-sm:leading-[26px]">{etape.titre}</h3>
            <p className="mt-2 mb-0 pr-3 text-[15px] leading-6 text-pretty text-bleu-bord">{etape.texte}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

const TUILES_ATOUTS: { icon: IconSvgElement; ton: keyof typeof TONS_TUILE }[] = [
  { icon: Video01Icon, ton: "bleu" },
  { icon: AssignmentsIcon, ton: "business" },
  { icon: BubbleChatIcon, ton: "digital" },
  { icon: Target02Icon, ton: "reussite" },
];

/** « Vous n’apprenez jamais seul » (§10) : le texte à gauche, quatre atouts dans une boîte bleu clair. */
export function SectionAccompagnement() {
  return (
    <section aria-labelledby="titre-accompagnement" className={SECTION_BLANCHE}>
      <div className="flex flex-wrap items-center gap-16 max-sm:gap-6">
        <div className="min-w-0 flex-[1_1_400px]">
          <EnTeteSection
            pastille="Accompagnement"
            ton="bleu"
            titre="Vous n’apprenez jamais seul"
            idTitre="titre-accompagnement"
            chapeau="Un formateur suit votre progression, corrige vos exercices et répond à vos questions."
          />
        </div>
        <div className="min-w-0 flex-[999_1_420px] rounded-panneau bg-bleu-clair p-3.5 max-sm:p-2.5">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,max(220px,calc((100%-14px)/2))),1fr))] gap-3.5 max-sm:gap-2.5">
            {ATOUTS.map((atout, i) => (
              <div key={atout.titre} className="box-border flex min-w-0 flex-col rounded-menu bg-panneau p-[22px] max-sm:p-[18px]">
                <Tuile icon={TUILES_ATOUTS[i].icon} taille={44} ton={TUILES_ATOUTS[i].ton} />
                <h3 className="mt-[18px] mb-0 text-[17px] leading-6 font-semibold text-encre max-sm:mt-3.5 max-sm:text-base">{atout.titre}</h3>
                <p className="mt-1.5 mb-0 text-sm leading-[22px] text-pretty text-discret">{atout.texte}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
