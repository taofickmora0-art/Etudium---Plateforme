import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { FicheConnectee } from "@/components/catalogue/FicheConnectee";
import { FichePublique } from "@/components/catalogue/FichePublique";
import { Skeleton } from "@/components/ui/Skeleton";
import { lireAvis } from "@/lib/avis/data";
import { BandeauApercu } from "@/components/lecon/BandeauApercu";
import { ficheApercu, lienModifierLecons } from "@/lib/catalogue/apercu";
import { avecBrouillonFormation } from "@/lib/editeur/apercu";
import { Banner } from "@/components/ui/Banner";
import { getFiche, lireMonetisation, listCatalogue } from "@/lib/catalogue/data";
import { monetisationDe } from "@/lib/catalogue/monetisation";
import { metadonneesFiche } from "@/lib/catalogue/partage";
import type { FicheFormation } from "@/lib/catalogue/types";
import { renvoyerFormateur } from "@/lib/catalogue/garde-formateur";
import { compteConnecte } from "@/lib/catalogue/visiteur";
import { lireFavoris } from "@/lib/favoris/data";
import { lireProgression } from "@/lib/progression/data";
import { etatFormation } from "@/lib/progression/regles";
import { lireMesScores } from "@/lib/quiz/data";
import { lireStatutsExercices } from "@/lib/exercices/data";

type Params = { params: Promise<{ slug: string }> };

/** Titre, description et image du lien partagé (spec du lot 1, §9). */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  try {
    return metadonneesFiche(await getFiche(slug));
  } catch {
    return metadonneesFiche(null);
  }
}

async function Fiche({ params }: Params) {
  const [compte, { slug }] = await Promise.all([compteConnecte(), params]);
  let fiche: FicheFormation | null;
  let apercu = false;
  try {
    fiche = await getFiche(slug);
    // « Voir comme un étudiant » : une formation non publiée, pour l'équipe et son formateur (refonte des formations, §3.5).
    if (!fiche && compte) {
      fiche = await ficheApercu(slug);
      apercu = fiche !== null;
    }
  } catch (erreur) {
    return siTablesAbsentes(erreur);
  }
  // Brouillon (hors aperçu), formation archivée ou adresse inconnue : page introuvable.
  if (!fiche) notFound();
  // Un formateur ne lit que ses formations (restructuration R1) : l'éditeur de la sienne, sinon son tableau de bord.
  await renvoyerFormateur(compte, fiche.id);
  // Le lien compétence → monétisation (0048 ; restructuration, §5.3) : « À suivre d'abord », « Et ensuite ? ».
  const [liens, cartes] = await Promise.all([lireMonetisation(), listCatalogue()]);
  const monetisation = monetisationDe(fiche.id, liens, cartes);
  // Avis (1.11), progression (1.7) et favoris (1.9) : absents tant que leurs migrations ne sont pas appliquées.
  if (!compte) return <FichePublique fiche={fiche} avis={await lireAvis(fiche.id)} monetisation={monetisation} />;
  // L'équipe ou le formateur voit les informations générales du brouillon (fin du lot 4).
  const vue = await avecBrouillonFormation(fiche);
  // Le meilleur score de chaque quiz, dans le programme (lot 3).
  const aDes = (type: string) => fiche.modules.some((m) => m.lecons.some((l) => l.type === type));
  const [lignes, favoris, avis, lienModifier, scores, statuts] = await Promise.all([
    lireProgression(),
    lireFavoris(),
    lireAvis(fiche.id),
    lienModifierLecons(fiche.id),
    aDes("quiz") ? lireMesScores(fiche.id) : {},
    // Le dernier statut de chaque exercice (lot 3).
    aDes("exercice") ? lireStatutsExercices(fiche.id) : {},
  ]);
  const page = (
    <FicheConnectee
      fiche={vue.fiche}
      progression={lignes ? etatFormation(fiche, lignes) : null}
      favori={favoris ? favoris.some((f) => f.formationId === fiche.id) : null}
      avis={avis}
      lienModifier={lienModifier}
      scores={scores}
      statuts={statuts}
      monetisation={monetisation}
    />
  );
  const avecBrouillon = vue.brouillon ? (
    <div className="flex flex-col gap-4">
      <Banner tone="attention" title="Brouillon : vous voyez les informations modifiées.">
        Les étudiants voient encore la version en ligne, jusqu’à « Publier les modifications ».
      </Banner>
      {page}
    </div>
  ) : (
    page
  );
  return apercu ? (
    <div className="flex flex-col gap-4">
      <BandeauApercu apercu="formation" />
      {avecBrouillon}
    </div>
  ) : (
    avecBrouillon
  );
}

/** Fiche d'une formation (spec du lot 1, §2) : NdFormationPublic pour un visiteur, NdFormation pour un compte connecté. */
export default function Page({ params }: Params) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-panneau" />}>
      <Fiche params={params} />
    </Suspense>
  );
}
