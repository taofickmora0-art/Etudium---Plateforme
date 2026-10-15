import Link from "next/link";
import { BoiteQuestions } from "@/components/landing/SectionFaq";
import { buttonVariants } from "@/components/ui/Button";
import { Heading, Lead } from "@/components/ui/Text";

/**
 * Page Aide de l'espace connecté (aucune maquette) : les questions fréquentes de la landing, puis où poser une autre
 * question. Le contact par e-mail viendra avec l'adresse de contact.
 */
export function PageAide() {
  return (
    <div className="flex max-w-[960px] min-w-0 flex-col gap-6">
      <div>
        <Heading level="page">Aide</Heading>
        <Lead className="mt-2.5">Les réponses aux questions les plus fréquentes sur Étudium.</Lead>
      </div>
      <section aria-labelledby="titre-questions-aide" className="flex min-w-0 flex-col gap-3">
        <h2 id="titre-questions-aide" className="m-0 text-xl leading-7 font-semibold text-encre max-sm:text-lg max-sm:leading-[26px]">
          Questions fréquentes
        </h2>
        <BoiteQuestions className="rounded-carte border border-bordure-carte" />
      </section>
      <section aria-labelledby="titre-autre-question" className="flex min-w-0 flex-col gap-3 rounded-carte border border-bordure-carte bg-panneau p-6 max-sm:p-4">
        <h2 id="titre-autre-question" className="m-0 text-xl leading-7 font-semibold text-encre max-sm:text-lg max-sm:leading-[26px]">
          Une autre question ?
        </h2>
        <p className="m-0 text-sm leading-[22px] text-pretty text-texte">
          Posez-la dans la communauté : un espace général ouvert à tous, et un espace pour chaque parcours.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/accueil" className={buttonVariants()}>
            Aller à la communauté
          </Link>
          <Link href="/verifier" className={buttonVariants({ variant: "contour" })}>
            Vérifier un certificat
          </Link>
        </div>
      </section>
    </div>
  );
}
