import { Accordion } from "@/components/ui/Accordion";
import { QUESTIONS_FREQUENTES } from "@/lib/site/faq";
import { EnTeteSection, SECTION_NUE } from "./BlocsLanding";

/** Les 7 questions fréquentes dans leur boîte blanche (§14), la première dépliée : landing et page Aide. */
export function BoiteQuestions() {
  return (
    <div className="rounded-bloc bg-panneau px-[clamp(18px,3vw,32px)] pt-1.5 pb-2.5">
      <Accordion items={QUESTIONS_FREQUENTES.map((q) => ({ question: q.question, answer: q.reponse }))} defaultOpen={[0]} />
    </div>
  );
}

/** Questions fréquentes (NdLanding §14), cible de « Questions fréquentes » dans le pied de page. */
export function SectionFaq() {
  return (
    <section id="faq" aria-labelledby="titre-faq" className={SECTION_NUE}>
      <div className="flex flex-wrap items-start gap-14 max-sm:gap-6">
        <div className="min-w-0 flex-[1_1_380px]">
          <EnTeteSection pastille="Questions fréquentes" ton="blanc" titre="Tout ce qu’il faut savoir avant de commencer" idTitre="titre-faq" />
        </div>
        <div className="min-w-0 flex-[999_1_420px]">
          <BoiteQuestions />
        </div>
      </div>
    </section>
  );
}
