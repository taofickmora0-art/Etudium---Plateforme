import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// Briques communes aux sections de la landing (NdLanding, annexe 1.12 §0.2).

/** Section sur fond blanc (SECTION-BLANCHE). */
export const SECTION_BLANCHE = "box-border min-w-0 rounded-panneau bg-panneau p-[clamp(28px,5vw,64px)] max-sm:px-5 max-sm:py-7";
/** Section posée sur le fond gris-bleu de la page (SECTION-NUE). */
export const SECTION_NUE = "box-border min-w-0 rounded-panneau px-[clamp(4px,2.5vw,36px)] py-[clamp(28px,4.5vw,56px)]";

const TONS_PASTILLE = {
  /** Sur fond bleu (PASTILLE-W). */
  surBleu: "bg-white/14 text-white",
  /** Sur fond blanc (PASTILLE-BLEU). */
  bleu: "bg-bleu-clair text-bleu",
  /** Sur le fond gris-bleu ou bleu clair (PASTILLE-BLANC). */
  blanc: "bg-panneau text-bleu",
} as const;

export type TonPastille = keyof typeof TONS_PASTILLE;

/** Surtitre de section (PASTILLE). */
export function Pastille({ ton, className, children }: { ton: TonPastille; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 self-start rounded-full px-[13px] py-1.5 text-[13px] leading-[18px] font-semibold max-sm:px-3 max-sm:py-1 max-sm:text-xs",
        TONS_PASTILLE[ton],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Titre de section (H2-SECTION) : 44 px à 28 px ; 26 px sur téléphone. */
export const TITRE_SECTION = "m-0 text-[clamp(28px,3.5vw,44px)] leading-[1.08] font-medium tracking-[-0.028em] text-balance max-sm:text-[26px]";

/**
 * En-tête d'une section (EN-TÊTE-SECTION) : pastille, titre (h2, relié à la section par `idTitre`) et chapeau.
 * `centre` : centré au-dessus d'une grille ; `blanc` : sur fond bleu nuit.
 */
export function EnTeteSection({
  pastille,
  ton,
  titre,
  idTitre,
  chapeau,
  centre = false,
  blanc = false,
}: {
  pastille: string;
  ton: TonPastille;
  titre: string;
  idTitre: string;
  chapeau?: string;
  centre?: boolean;
  blanc?: boolean;
}) {
  return (
    <div className={cn("flex max-w-[800px] min-w-0 flex-col gap-4 max-sm:gap-3", centre && "mx-auto items-center text-center")}>
      <Pastille ton={ton} className={cn(centre && "self-center")}>
        {pastille}
      </Pastille>
      <h2 id={idTitre} className={cn(TITRE_SECTION, blanc ? "text-white" : "text-titre")}>
        {titre}
      </h2>
      {chapeau && (
        <p className="m-0 max-w-[640px] text-[17px] leading-[27px] text-pretty text-ardoise max-sm:text-[15px] max-sm:leading-6">{chapeau}</p>
      )}
    </div>
  );
}
