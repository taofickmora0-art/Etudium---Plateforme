import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { TeachingIcon } from "@hugeicons/core-free-icons";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { List, ListRow } from "@/components/ui/ListRow";
import { Skeleton } from "@/components/ui/Skeleton";
import { listFormateurs } from "@/lib/admin/data";
import type { FormateurAdmin } from "@/lib/admin/types";
import { requireSpace } from "@/lib/auth/require-space";

export const metadata: Metadata = { title: "Formateurs · Back-office · Étudium" };

const NOUVELLE = (
  <Button asChild>
    <Link href="/admin/formateurs/nouveau">Nouvelle fiche</Link>
  </Button>
);

async function ListeFormateurs() {
  await requireSpace("admin");
  let formateurs: FormateurAdmin[];
  try {
    formateurs = await listFormateurs();
  } catch (erreur) {
    return <PageAdmin titre="Formateurs" fil={[{ label: "Formateurs" }]}>{siTablesAbsentes(erreur)}</PageAdmin>;
  }
  return (
    <PageAdmin titre="Formateurs" description="Les fiches affichées sur les formations." fil={[{ label: "Formateurs" }]} action={NOUVELLE}>
      {formateurs.length === 0 ? (
        <EmptyState icon={TeachingIcon} title="Aucune fiche pour le moment" description="Créez la fiche d’un formateur pour l’associer à ses formations." />
      ) : (
        <List label="Formateurs" className="max-w-[680px]">
          {formateurs.map((f) => (
            <ListRow key={f.id} leading={<IconTile icon={TeachingIcon} />} title={f.nom} subtitle={f.titre || f.domaine} href={`/admin/formateurs/${f.id}`} />
          ))}
        </List>
      )}
    </PageAdmin>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-60 max-w-[680px] rounded-carte" />}>
      <ListeFormateurs />
    </Suspense>
  );
}
