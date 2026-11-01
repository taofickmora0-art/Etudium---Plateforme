import type { ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import { BandeAppelAction } from "@/components/catalogue/BlocsFiche";
import { lireFormules } from "@/lib/abonnement/data";
import { listCatalogue } from "@/lib/catalogue/data";
import { HeroLanding } from "./HeroLanding";
import { SectionCommunaute } from "./SectionCommunaute";
import { SectionFaq } from "./SectionFaq";
import { SectionFormations } from "./SectionFormations";
import { SectionFormules } from "./SectionFormules";
import { SectionParcours } from "./SectionParcours";
import { SectionAccompagnement, SectionEtapes, SectionProblemes, SectionSolution } from "./SectionsPresentation";

/**
 * Une lecture en base qui échoue donne une liste vide (et une trace), plutôt qu'une page en erreur. Les interruptions
 * de Next (pré-rendu, rendu dynamique) ne sont pas des échecs : elles repartent.
 */
async function lireOuRien<T>(lire: () => Promise<T[]>, quoi: string): Promise<T[]> {
  try {
    return await lire();
  } catch (erreur) {
    unstable_rethrow(erreur);
    console.error(`Landing : lecture des ${quoi} impossible`, erreur);
    return [];
  }
}

/** « Pour bien commencer » ; une lecture impossible retire la section (comme une base sans formation publiée). */
export async function FormationsDepuisBase() {
  return <SectionFormations cartes={await lireOuRien(listCatalogue, "formations")} />;
}

/** Les formules et leurs prix (lot 2) ; une lecture impossible les montre sans prix. */
export async function FormulesDepuisBase() {
  return <SectionFormules formules={await lireOuRien(lireFormules, "formules")} />;
}

/**
 * La landing (NdLanding, spec du lot 1 §9), dans l'ordre du design. Témoignages et chiffres sont absents tant qu'il
 * n'y a ni vrais témoignages ni chiffres parlants (Q11). Les formations et les prix des formules sont lus en base : ils
 * arrivent en propriété (Suspense).
 */
export function ContenuLanding({ formations, formules }: { formations: ReactNode; formules: ReactNode }) {
  return (
    <>
      <HeroLanding />
      <SectionProblemes />
      <SectionSolution />
      <SectionParcours />
      <SectionEtapes />
      {formations}
      {formules}
      <SectionAccompagnement />
      <SectionCommunaute />
      <SectionFaq />
      <BandeAppelAction />
    </>
  );
}
