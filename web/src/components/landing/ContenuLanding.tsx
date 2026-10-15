import type { ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import { BandeAppelAction } from "@/components/catalogue/BlocsFiche";
import { listCatalogue, listParcoursCatalogue } from "@/lib/catalogue/data";
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

/** Les parcours actifs ; une lecture impossible laisse la section sans cartes (son ancre reste valable). */
export async function ParcoursDepuisBase() {
  return <SectionParcours parcours={await lireOuRien(listParcoursCatalogue, "parcours")} />;
}

/** « Pour bien commencer » ; une lecture impossible retire la section (comme une base sans formation publiée). */
export async function FormationsDepuisBase() {
  return <SectionFormations cartes={await lireOuRien(listCatalogue, "formations")} />;
}

/**
 * La landing (NdLanding, spec du lot 1 §9), dans l'ordre du design. Témoignages et chiffres sont absents tant qu'il
 * n'y a ni vrais témoignages ni chiffres parlants (Q11). Les sections lues en base arrivent en propriétés (Suspense).
 */
export function ContenuLanding({ parcours, formations }: { parcours: ReactNode; formations: ReactNode }) {
  return (
    <>
      <HeroLanding />
      <SectionProblemes />
      <SectionSolution />
      {parcours}
      <SectionEtapes />
      {formations}
      <SectionFormules />
      <SectionAccompagnement />
      <SectionCommunaute />
      <SectionFaq />
      <BandeAppelAction />
    </>
  );
}
