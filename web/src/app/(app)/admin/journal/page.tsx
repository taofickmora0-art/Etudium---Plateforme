import { Suspense } from "react";
import type { Metadata } from "next";
import { PageJournal } from "@/components/admin/journal/PageJournal";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { Banner } from "@/components/ui/Banner";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireDomaine } from "@/lib/auth/require-domaine";
import { lireAuteursJournal, lireJournal } from "@/lib/journal/data";
import { estCategorieJournal, estPeriodeJournal, joursDe } from "@/lib/journal/types";

export const metadata: Metadata = { title: "Journal · Back-office · Étudium" };

type Params = { searchParams: Promise<{ categorie?: string; auteur?: string; periode?: string }> };

async function Journal({ searchParams }: Params) {
  await requireDomaine("journal");
  const recherche = await searchParams;
  const filtres = {
    categorie: estCategorieJournal(recherche.categorie) ? recherche.categorie : null,
    auteur: recherche.auteur && /^[0-9a-f-]{36}$/i.test(recherche.auteur) ? recherche.auteur : null,
    periode: estPeriodeJournal(recherche.periode) ? recherche.periode : ("30" as const),
  };
  const [page, auteurs] = await Promise.all([
    lireJournal({ categorie: filtres.categorie, auteur: filtres.auteur, jours: joursDe(filtres.periode) }),
    lireAuteursJournal(),
  ]);
  return (
    <PageAdmin titre="Journal des actions" description="Ce que l’équipe a fait dans le back-office." fil={[{ label: "Journal" }]}>
      {page ? (
        <PageJournal key={JSON.stringify(filtres)} initial={page} filtres={filtres} auteurs={auteurs} />
      ) : (
        <Banner tone="attention" title="Le journal n’est pas disponible">
          Appliquez la migration 0061 (guide « Ce qui te revient », section 61).
        </Banner>
      )}
    </PageAdmin>
  );
}

/** Le journal des actions de l'équipe (lot 6 A, spec §2.3) : le super admin seul. */
export default function Page(props: Params) {
  return (
    <Suspense fallback={<Skeleton className="h-60 max-w-[760px] rounded-carte" />}>
      <Journal {...props} />
    </Suspense>
  );
}
