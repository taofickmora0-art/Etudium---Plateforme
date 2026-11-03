import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ListeCertificats } from "@/components/certificats/ListeCertificats";
import { SessionGuard } from "@/components/layout/SessionGuard";
import { BandeauIndisponible } from "@/components/ui/BandeauIndisponible";
import { buttonVariants } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Heading, Lead } from "@/components/ui/Text";
import { lireMesCertificats } from "@/lib/certificats/data";

export const metadata: Metadata = { title: "Certificats · Étudium" };

async function Contenu() {
  const lecture = await lireMesCertificats();
  if (lecture.migrationAbsente) {
    return <BandeauIndisponible />;
  }
  return <ListeCertificats page={lecture.donnees} />;
}

/** Certificats (lot 3, étape C ; NdCertificats) : obtenus, et en préparation. */
export default function Page() {
  return (
    <div className="flex max-w-[960px] min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 basis-[260px]">
          <Heading level="page">Certificats</Heading>
          <Lead className="mt-2.5">Chaque certificat porte un QR Code qui permet de vérifier son authenticité.</Lead>
        </div>
        <Link href="/verifier" className={buttonVariants({ variant: "contour" })}>
          Vérifier un certificat
        </Link>
      </div>
      <Suspense fallback={<Skeleton className="h-60 rounded-carte" />}>
        <Contenu />
      </Suspense>
      <Suspense fallback={null}>
        <SessionGuard />
      </Suspense>
    </div>
  );
}
