import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { FicheConnectee } from "@/components/catalogue/FicheConnectee";
import { FichePublique } from "@/components/catalogue/FichePublique";
import { Skeleton } from "@/components/ui/Skeleton";
import { getFiche } from "@/lib/catalogue/data";
import { metadonneesFiche } from "@/lib/catalogue/partage";
import type { FicheFormation } from "@/lib/catalogue/types";
import { compteConnecte } from "@/lib/catalogue/visiteur";
import { lireProgression } from "@/lib/progression/data";
import { etatFormation } from "@/lib/progression/regles";

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
  try {
    fiche = await getFiche(slug);
  } catch (erreur) {
    return siTablesAbsentes(erreur);
  }
  // Brouillon, formation archivée ou adresse inconnue : page introuvable, pour tout le monde.
  if (!fiche) notFound();
  if (!compte) return <FichePublique fiche={fiche} />;
  // Progression du compte (1.7) : absente tant que les migrations 0007 et 0008 ne sont pas appliquées.
  const lignes = await lireProgression();
  return <FicheConnectee fiche={fiche} progression={lignes ? etatFormation(fiche, lignes) : null} />;
}

/** Fiche d'une formation (spec du lot 1, §2) : NdFormationPublic pour un visiteur, NdFormation pour un compte connecté. */
export default function Page({ params }: Params) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-panneau" />}>
      <Fiche params={params} />
    </Suspense>
  );
}
