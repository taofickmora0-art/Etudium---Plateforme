import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LeconForm } from "@/components/admin/LeconForm";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { getLeconAdmin } from "@/lib/admin/data";
import type { LeconAdmin } from "@/lib/admin/types";
import { requireSpace } from "@/lib/auth/require-space";

export const metadata: Metadata = { title: "Leçon · Back-office · Étudium" };

type Params = { params: Promise<{ id: string; leconId: string }> };

async function FicheLecon({ params }: Params) {
  await requireSpace("admin");
  const { id, leconId } = await params;
  let lecon: LeconAdmin | null;
  try {
    lecon = await getLeconAdmin(leconId);
  } catch (erreur) {
    return siTablesAbsentes(erreur);
  }
  // Une leçon n'est ouverte que sous sa propre formation.
  if (!lecon || lecon.formationId !== id) notFound();
  const programme = `/admin/formations/${id}?onglet=programme`;
  return (
    <PageAdmin
      titre={lecon.titre}
      fil={[{ label: "Formations", href: "/admin/formations" }, { label: lecon.formationTitre, href: programme }, { label: lecon.titre }]}
      action={
        <Button asChild variant="contour">
          <Link href={programme}>Retour au programme</Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <LeconForm lecon={lecon} />
      </div>
    </PageAdmin>
  );
}

export default function Page({ params }: Params) {
  return (
    <Suspense fallback={<Skeleton className="h-96 max-w-[680px] rounded-carte" />}>
      <FicheLecon params={params} />
    </Suspense>
  );
}
