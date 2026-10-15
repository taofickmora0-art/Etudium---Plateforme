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
import { getFiche } from "@/lib/catalogue/data";
import { metadonneesFiche } from "@/lib/catalogue/partage";
import type { FicheFormation } from "@/lib/catalogue/types";
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
  // Avis (1.11), progression (1.7) et favoris (1.9) : absents tant que leurs migrations ne sont pas appliquées.
  if (!compte) return <FichePublique fiche={fiche} avis={await lireAvis(fiche.id)} />;
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
      fiche={fiche}
      progression={lignes ? etatFormation(fiche, lignes) : null}
      favori={favoris ? favoris.some((f) => f.formationId === fiche.id) : null}
      avis={avis}
      lienModifier={lienModifier}
      scores={scores}
      statuts={statuts}
    />
  );
  return apercu ? (
    <div className="flex flex-col gap-4">
      <BandeauApercu apercu="formation" />
      {page}
    </div>
  ) : (
    page
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
