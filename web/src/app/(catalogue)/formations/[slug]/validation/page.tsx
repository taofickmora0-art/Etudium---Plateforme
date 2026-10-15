import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { ValidationFormation } from "@/components/certificats/ValidationFormation";
import { Banner } from "@/components/ui/Banner";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Skeleton } from "@/components/ui/Skeleton";
import { Heading, Lead } from "@/components/ui/Text";
import { lireValidation, MIGRATION_CERTIFICATS } from "@/lib/certificats/data";
import { ficheApercu } from "@/lib/catalogue/apercu";
import { getFiche } from "@/lib/catalogue/data";
import type { FicheFormation } from "@/lib/catalogue/types";
import { compteConnecte } from "@/lib/catalogue/visiteur";

export const metadata: Metadata = { title: "Validation de votre formation · Étudium", robots: { index: false } };

type Params = { params: Promise<{ slug: string }> };

async function Validation({ params }: Params) {
  const [compte, { slug }] = await Promise.all([compteConnecte(), params]);
  if (!compte) redirect(`/connexion?next=${encodeURIComponent(`/formations/${slug}/validation`)}`);
  let fiche: FicheFormation | null;
  let lecture: Awaited<ReturnType<typeof lireValidation>>;
  try {
    fiche = (await getFiche(slug)) ?? (await ficheApercu(slug));
    if (!fiche) notFound();
    lecture = await lireValidation(fiche.id);
  } catch (erreur) {
    return siTablesAbsentes(erreur);
  }
  const entete = (
    <div className="flex flex-col gap-4">
      <Breadcrumb items={[{ label: "Certificats", href: "/certificats" }, { label: fiche.titre, href: `/formations/${fiche.slug}` }, { label: "Validation" }]} />
      <div>
        <Heading level="page">Validation de votre formation</Heading>
        <Lead className="mt-2.5">{fiche.titre}</Lead>
      </div>
    </div>
  );
  if (lecture.migrationAbsente) {
    return (
      <div className="flex flex-col gap-6">
        {entete}
        <Banner tone="attention" title="Les certificats ne sont pas encore dans la base.">
          {MIGRATION_CERTIFICATS}
        </Banner>
      </div>
    );
  }
  if (!lecture.donnees) notFound();
  return (
    <div className="flex flex-col gap-6">
      {entete}
      <ValidationFormation etat={lecture.donnees} formation={{ titre: fiche.titre, slug: fiche.slug }} prenom={compte.prenom} />
    </div>
  );
}

/** « Validation de votre formation » (NdCertificat) : ce qui reste pour le certificat, ou le certificat délivré. */
export default function Page({ params }: Params) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-panneau" />}>
      <Validation params={params} />
    </Suspense>
  );
}
