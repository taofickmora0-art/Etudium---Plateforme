import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SessionGuard } from "@/components/layout/SessionGuard";
import { PorteResultats } from "@/components/resultats/PorteResultats";
import { VueParcours } from "@/components/resultats/VueParcours";
import { Skeleton } from "@/components/ui/Skeleton";
import { Heading } from "@/components/ui/Text";
import { lireParcoursComplet } from "@/lib/resultats/data";

export const metadata: Metadata = { title: "Mes résultats · Étudium" };

type Adresse = { params: Promise<{ parcours: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function Vue({ id, semestre, pin }: { id: string; semestre: string | undefined; pin: boolean }) {
  const complet = await lireParcoursComplet(id);
  if (!complet) notFound();
  return <VueParcours complet={complet} semestreId={semestre} pin={pin} />;
}

async function Contenu({ params, searchParams }: Adresse) {
  const [{ parcours }, { semestre }] = await Promise.all([params, searchParams]);
  return <PorteResultats>{(etat) => <Vue id={parcours} semestre={typeof semestre === "string" ? semestre : undefined} pin={etat.pin} />}</PorteResultats>;
}

/** Un parcours de « Mes résultats » : son bilan, ses semestres, les UE et les ECUE du semestre affiché (?semestre=). */
export default function Page(adresse: Adresse) {
  return (
    <div className="flex max-w-[960px] min-w-0 flex-col gap-6">
      <Heading level="page">Mes résultats</Heading>
      <Suspense fallback={<Skeleton className="h-96 rounded-carte" />}>
        <Contenu {...adresse} />
      </Suspense>
      <Suspense fallback={null}>
        <SessionGuard />
      </Suspense>
    </div>
  );
}
