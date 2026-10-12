import { CourseIllustration, type Parcours } from "@/components/ui/CourseIllustration";

const PILES: { parcours: Parcours; decalage: string; rotation: string }[] = [
  { parcours: "academique", decalage: "ml-0", rotation: "-rotate-7" },
  { parcours: "digital", decalage: "-ml-[13px]", rotation: "rotate-4" },
  { parcours: "business", decalage: "-ml-[13px]", rotation: "-rotate-3" },
];

export const SOUS_TITRE_CATALOGUE = "Réussite académique, compétences digitales et business en ligne. Chaque fiche propose un aperçu gratuit.";

/** Bandeau bleu du catalogue public (NdCataloguePublic) : pastille, titre, texte et les trois illustrations de parcours. */
export function HerosCatalogue() {
  return (
    <section className="box-border rounded-panneau bg-bleu bg-[radial-gradient(rgba(255,255,255,0.13)_1.2px,transparent_1.2px)] bg-size-[22px_22px] p-[clamp(28px,4.5vw,56px)] text-white">
      <div className="flex flex-wrap items-center justify-between gap-x-12 gap-y-7">
        <div className="min-w-0 flex-[1_1_420px]">
          <div className="flex max-w-[800px] flex-col gap-4">
            <span className="inline-flex items-center gap-2 self-start rounded-full bg-white/14 px-[13px] py-1.5 text-[13px] leading-[18px] font-semibold">
              Catalogue
            </span>
            <h1 className="m-0 text-[clamp(28px,3.5vw,44px)] leading-[1.08] font-medium tracking-[-0.028em] text-balance text-white">Toutes les formations</h1>
            <p className="m-0 max-w-[640px] text-[17px] leading-[27px] text-pretty text-[#DDE1FF]">{SOUS_TITRE_CATALOGUE}</p>
          </div>
        </div>
        <div className="flex-none px-3 py-2">
          <div aria-hidden="true" className="flex items-center">
            {PILES.map(({ parcours, decalage, rotation }) => (
              <span
                key={parcours}
                className={`flex size-[84px] items-center justify-center rounded-[24px] bg-white shadow-[0_10px_28px_rgba(4,10,80,0.22)] ${decalage} ${rotation}`}
              >
                <CourseIllustration parcours={parcours} size={52} />
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
