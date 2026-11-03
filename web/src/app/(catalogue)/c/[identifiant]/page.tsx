import { Suspense } from "react";
import type { Metadata } from "next";
import { FormulaireVerification } from "@/components/certificats/FormulaireVerification";
import { ResultatVerification } from "@/components/certificats/ResultatVerification";
import { Banner } from "@/components/ui/Banner";
import { BandeauIndisponible } from "@/components/ui/BandeauIndisponible";
import { Skeleton } from "@/components/ui/Skeleton";
import { Heading, Lead } from "@/components/ui/Text";
import { identifiantDeLAdresse } from "@/lib/certificats/adresse";
import { verifierCertificat } from "@/lib/certificats/data";

// La page du résultat ne s'indexe pas : un identifiant n'a rien à faire dans un moteur de recherche.
export const metadata: Metadata = { title: "Vérification d’un certificat · Étudium", robots: { index: false, follow: false } };

type Params = { params: Promise<{ identifiant: string }> };

async function Resultat({ params }: Params) {
  const { identifiant } = await params;
  const saisie = identifiantDeLAdresse(identifiant);
  let lecture: Awaited<ReturnType<typeof verifierCertificat>>;
  try {
    lecture = await verifierCertificat(saisie);
  } catch {
    return <Banner tone="erreur" title="La vérification n’a pas pu se faire. Réessayez dans un instant." />;
  }
  if (lecture.migrationAbsente) {
    return <BandeauIndisponible />;
  }
  return (
    <>
      <ResultatVerification certificat={lecture.donnees} />
      <div className="rounded-carte border border-bordure-carte bg-panneau p-6 max-sm:p-4">
        <FormulaireVerification initial={lecture.donnees?.identifiant ?? saisie} />
      </div>
    </>
  );
}

/** Le résultat d'une vérification (NdVerificationValide) : l'adresse du QR Code ; ouverte à tous, sans compte. */
export default function Page({ params }: Params) {
  return (
    <div className="mx-auto flex w-full max-w-[720px] min-w-0 flex-col gap-6 py-6">
      <div>
        <Heading level="page">Vérifier un certificat</Heading>
        <Lead className="mt-2.5">Scannez le QR Code du certificat ou saisissez son identifiant. Aucun compte n’est nécessaire.</Lead>
      </div>
      <Suspense fallback={<Skeleton className="h-48 rounded-carte" />}>
        <Resultat params={params} />
      </Suspense>
    </div>
  );
}
