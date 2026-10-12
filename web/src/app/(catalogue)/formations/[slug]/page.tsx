import { Suspense } from "react";
import { notFound } from "next/navigation";
import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { FicheConnectee } from "@/components/catalogue/FicheConnectee";
import { FichePublique } from "@/components/catalogue/FichePublique";
import { Skeleton } from "@/components/ui/Skeleton";
import { getFiche } from "@/lib/catalogue/data";
import type { FicheFormation } from "@/lib/catalogue/types";
import { compteConnecte } from "@/lib/catalogue/visiteur";

type Params = { params: Promise<{ slug: string }> };

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
  return compte ? <FicheConnectee fiche={fiche} /> : <FichePublique fiche={fiche} />;
}

/** Fiche d'une formation (spec du lot 1, §2) : NdFormationPublic pour un visiteur, NdFormation pour un compte connecté. */
export default function Page({ params }: Params) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-panneau" />}>
      <Fiche params={params} />
    </Suspense>
  );
}
