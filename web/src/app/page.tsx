import { Suspense } from "react";
import type { Metadata } from "next";
import { ContenuLanding, FormationsDepuisBase } from "@/components/landing/ContenuLanding";
import { FormationsEnAttente } from "@/components/landing/SectionFormations";
import { CadrePublic } from "@/components/site/CadrePublic";

export const metadata: Metadata = {
  title: "Étudium · Les compétences qui comptent, pendant vos études et après",
  description:
    "Étudium accompagne les étudiants et les jeunes diplômés : outils universitaires, compétences digitales et activités en ligne. Vous apprenez, vous pratiquez, un formateur vous accompagne, et vous obtenez un certificat vérifiable.",
};

/**
 * La racine : la landing publique pour un visiteur (spec du lot 1, §2 et §9). Un compte connecté n'arrive jamais ici,
 * le proxy l'envoie vers l'accueil. Les formations sont lues en base pendant que le reste s'affiche, leur place
 * réservée.
 */
export default function Racine() {
  return (
    <CadrePublic>
      <ContenuLanding
        formations={
          <Suspense fallback={<FormationsEnAttente />}>
            <FormationsDepuisBase />
          </Suspense>
        }
      />
    </CadrePublic>
  );
}
