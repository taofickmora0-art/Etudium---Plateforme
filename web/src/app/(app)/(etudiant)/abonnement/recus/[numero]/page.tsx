import { Suspense } from "react";
import type { Metadata } from "next";
import { ContenuRecu } from "@/components/abonnement/ContenuRecu";
import { SessionGuard } from "@/components/layout/SessionGuard";
import { Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Reçu de paiement · Étudium" };

async function Contenu({ params }: { params: Promise<{ numero: string }> }) {
  const { numero } = await params;
  return <ContenuRecu numero={decodeURIComponent(numero)} />;
}

/** Le reçu imprimable d'un paiement réussi (lot 2, spec §6). */
export default function Page({ params }: { params: Promise<{ numero: string }> }) {
  return (
    <>
      <Suspense fallback={<Skeleton className="mx-auto h-96 max-w-[640px] rounded-carte" />}>
        <Contenu params={params} />
      </Suspense>
      <Suspense fallback={null}>
        <SessionGuard />
      </Suspense>
    </>
  );
}
