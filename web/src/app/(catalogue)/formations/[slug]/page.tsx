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
import { lireFavoris } from "@/lib/favoris/data";
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
  // Progression (1.7) et favoris (1.9) du compte : absents tant que leurs migrations ne sont pas appliquées.
  const [lignes, favoris] = await Promise.all([lireProgression(), lireFavoris()]);
  return (
    <FicheConnectee
      fiche={fiche}
      progression={lignes ? etatFormation(fiche, lignes) : null}
      favori={favoris ? favoris.some((f) => f.formationId === fiche.id) : null}
    />
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
