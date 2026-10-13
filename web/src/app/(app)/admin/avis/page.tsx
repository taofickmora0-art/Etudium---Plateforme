import { Suspense } from "react";
import type { Metadata } from "next";
import { ListeAvis } from "@/components/admin/ListeAvis";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { Banner } from "@/components/ui/Banner";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireSpace } from "@/lib/auth/require-space";
import { lireAvisEquipe } from "@/lib/avis/data";

export const metadata: Metadata = { title: "Avis · Back-office · Étudium" };

async function Avis() {
  await requireSpace("admin");
  const avis = await lireAvisEquipe();
  return (
    <PageAdmin titre="Avis" description="Masquez un avis inapproprié : il disparaît de la fiche et ne compte plus dans la note." fil={[{ label: "Avis" }]}>
      {avis === null ? (
        <Banner tone="attention" title="Les avis ne sont pas encore dans la base.">
          Appliquez la migration 0010 (guide « Ce qui te revient », section 15).
        </Banner>
      ) : (
        <ListeAvis avis={avis} />
      )}
    </PageAdmin>
  );
}

/** Modération des avis (spec du lot 1, §10) : réservée à l'équipe, rien n'est rendu avant la vérification du rôle. */
export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-60 max-w-[760px] rounded-carte" />}>
      <Avis />
    </Suspense>
  );
}
