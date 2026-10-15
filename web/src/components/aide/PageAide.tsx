"use client";

import { useId, useState } from "react";
import { Accordion } from "@/components/ui/Accordion";
import { SearchInput } from "@/components/ui/SearchInput";
import { Heading, Lead } from "@/components/ui/Text";
import { QUESTIONS_FORMULES, QUESTIONS_FREQUENTES } from "@/lib/site/faq";
import { ContacterEquipe } from "./ContacterEquipe";

type Question = { question: string; reponse: string };

/** Sans accents ni majuscules : « prélèvement » se trouve en tapant « prelevement ». */
const simplifier = (texte: string) =>
  texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Un groupe de questions (titre et accordéon) ; rien s'il n'en reste aucune après la recherche. */
function Groupe({ titre, questions, premiereOuverte, cle }: { titre: string; questions: Question[]; premiereOuverte: boolean; cle: string }) {
  const id = useId();
  if (questions.length === 0) return null;
  return (
    <section aria-labelledby={`${id}-titre`} className="flex min-w-0 flex-col">
      <h2 id={`${id}-titre`} className="m-0 mb-1.5 text-xl leading-7 font-semibold text-encre max-sm:text-lg max-sm:leading-[26px]">
        {titre}
      </h2>
      <Accordion key={cle} items={questions.map((q) => ({ question: q.question, answer: q.reponse }))} defaultOpen={premiereOuverte ? [0] : []} />
    </section>
  );
}

/**
 * La page Aide (NdAide) : une recherche, les questions fréquentes (les mêmes que la landing) et celles sur les formules,
 * puis « Contacter l’équipe », dont la réponse arrive dans les messages.
 */
export function PageAide() {
  const [recherche, setRecherche] = useState("");
  const terme = simplifier(recherche.trim());
  const garder = (q: Question) => !terme || simplifier(`${q.question} ${q.reponse}`).includes(terme);
  const frequentes = QUESTIONS_FREQUENTES.filter(garder);
  const formules = QUESTIONS_FORMULES.filter(garder);
  return (
    <div className="flex min-w-0 flex-col">
      <div className="min-w-0">
        <Heading level="page">Aide</Heading>
        <Lead className="mt-2.5">Trouvez une réponse dans les questions fréquentes ou écrivez à l’équipe Étudium.</Lead>
      </div>
      <div className="mt-[21px] max-w-[520px]">
        <SearchInput value={recherche} onChange={(e) => setRecherche(e.target.value)} aria-label="Rechercher dans l’aide" placeholder="Rechercher dans l’aide…" />
      </div>
      <div className="mt-5 h-px bg-separateur" />
      <div className="mt-8 flex flex-wrap items-start gap-6 max-sm:mt-6">
        <div className="flex min-w-0 flex-[999_1_420px] flex-col gap-9 max-sm:gap-7">
          <Groupe titre="Questions fréquentes" questions={frequentes} premiereOuverte={!terme} cle={terme} />
          <Groupe titre="Questions sur les formules" questions={formules} premiereOuverte={false} cle={terme} />
          {frequentes.length === 0 && formules.length === 0 && (
            <p className="m-0 text-sm leading-[22px] text-discret">Aucune question ne correspond.</p>
          )}
        </div>
        <div className="min-w-0 flex-[1_1_300px]">
          <ContacterEquipe />
        </div>
      </div>
    </div>
  );
}
