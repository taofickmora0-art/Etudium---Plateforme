import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Route01Icon } from "@hugeicons/core-free-icons";
import { BoutonsOrdre } from "@/components/admin/BoutonsOrdre";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { List, ListRow } from "@/components/ui/ListRow";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tag } from "@/components/ui/Tag";
import { listParcours } from "@/lib/admin/data";
import type { ParcoursAdmin } from "@/lib/admin/types";
import { requireDomaine } from "@/lib/auth/require-domaine";

export const metadata: Metadata = { title: "Parcours · Back-office · Étudium" };

const NOUVEAU = (
  <Button asChild>
    <Link href="/admin/parcours/nouveau">Nouveau parcours</Link>
  </Button>
);

async function ListeParcours() {
  await requireDomaine("contenus");
  let parcours: ParcoursAdmin[];
  try {
    parcours = await listParcours();
  } catch (erreur) {
    return <PageAdmin titre="Parcours" fil={[{ label: "Parcours" }]}>{siTablesAbsentes(erreur)}</PageAdmin>;
  }
  return (
    <PageAdmin titre="Parcours" description="Leur ordre ici est celui du catalogue." fil={[{ label: "Parcours" }]} action={NOUVEAU}>
      {parcours.length === 0 ? (
        <EmptyState icon={Route01Icon} title="Aucun parcours pour le moment" description="Créez le premier parcours : les formations s'y rangeront." />
      ) : (
        <List label="Parcours" className="max-w-[680px]">
          {parcours.map((p, index) => (
            <ListRow
              key={p.id}
              leading={<IconTile icon={Route01Icon} />}
              title={
                <Link href={`/admin/parcours/${p.id}`} className="focus-etudium text-inherit no-underline hover:underline">
                  {p.nom}
                </Link>
              }
              subtitle={p.description || p.nomCourt}
              trailing={
                <span className="flex flex-none items-center gap-2">
                  {!p.actif && <Tag tone="enAttente">Désactivé</Tag>}
                  <BoutonsOrdre table="parcours" id={p.id} nom={p.nom} premier={index === 0} dernier={index === parcours.length - 1} />
                </span>
              }
            />
          ))}
        </List>
      )}
    </PageAdmin>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-60 max-w-[680px] rounded-carte" />}>
      <ListeParcours />
    </Suspense>
  );
}
