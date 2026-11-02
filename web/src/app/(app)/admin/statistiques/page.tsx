import { Suspense } from "react";
import type { Metadata } from "next";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { PageStatistiques } from "@/components/admin/statistiques/PageStatistiques";
import { Banner } from "@/components/ui/Banner";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireDomaine } from "@/lib/auth/require-domaine";
import { lireStatistiquesPeriode } from "@/lib/statistiques/data";
import { ONGLETS, type OngletStatistiques } from "@/lib/statistiques/types";

export const metadata: Metadata = { title: "Statistiques · Back-office · Étudium" };

type Params = { searchParams: Promise<{ periode?: string; onglet?: string }> };

async function Statistiques({ searchParams }: Params) {
  await requireDomaine("statistiques");
  const recherche = await searchParams;
  const periode = recherche.periode === "90" || recherche.periode === "365" ? recherche.periode : "30";
  const onglet: OngletStatistiques = ONGLETS.some((o) => o.value === recherche.onglet) ? (recherche.onglet as OngletStatistiques) : "etudiants";
  const donnees = await lireStatistiquesPeriode(Number(periode) as 30 | 90 | 365);
  return (
    <PageAdmin titre="Statistiques" description="Étudiants, formations et abonnements sur la période choisie." fil={[{ label: "Statistiques" }]}>
      {donnees ? (
        <PageStatistiques donnees={donnees} periode={periode} onglet={onglet} />
      ) : (
        <Banner tone="attention" title="Les statistiques ne sont pas disponibles">
          Appliquez la migration 0062 (guide « Ce qui te revient », section 61).
        </Banner>
      )}
    </PageAdmin>
  );
}

/** Les statistiques par période (lot 6 A, spec §4.2) : admins et super admin. */
export default function Page(props: Params) {
  return (
    <Suspense fallback={<Skeleton className="h-60 max-w-[760px] rounded-carte" />}>
      <Statistiques {...props} />
    </Suspense>
  );
}
