import { Suspense } from "react";
import type { Metadata } from "next";
import { ContenuLanding, FormationsDepuisBase, ParcoursDepuisBase } from "@/components/landing/ContenuLanding";
import { SectionParcours } from "@/components/landing/SectionParcours";
import { CadrePublic } from "@/components/site/CadrePublic";

export const metadata: Metadata = {
  title: "Étudium · Les compétences qui comptent, pendant vos études et après",
  description:
    "Étudium accompagne les étudiants et les jeunes diplômés : outils universitaires, compétences digitales et activités en ligne. Vous apprenez, vous pratiquez, un formateur vous accompagne, et vous obtenez un certificat vérifiable.",
};

/**
 * La racine : la landing publique pour un visiteur (spec du lot 1, §2 et §9). Un compte connecté n'arrive jamais ici,
 * le proxy l'envoie vers l'accueil. Parcours et formations sont lus en base pendant que le reste s'affiche.
 */
export default function Racine() {
  return (
    <CadrePublic>
      <ContenuLanding
        parcours={
          <Suspense fallback={<SectionParcours parcours={[]} />}>
            <ParcoursDepuisBase />
          </Suspense>
        }
        formations={
          <Suspense fallback={null}>
            <FormationsDepuisBase />
          </Suspense>
        }
      />
    </CadrePublic>
  );
}
