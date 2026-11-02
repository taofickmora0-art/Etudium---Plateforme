import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen01Icon, Certificate01Icon, Route01Icon, UserMultipleIcon } from "@hugeicons/core-free-icons";
import { GrilleParcours } from "@/components/admin/parcours/GrilleParcours";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { GRILLE_CHIFFRES, Tuile } from "@/components/tableau/Blocs";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { listParcours, lireStatistiquesParcours } from "@/lib/admin/data";
import type { StatistiquesParcours } from "@/lib/admin/parcours-chiffres";
import type { ParcoursAdmin } from "@/lib/admin/types";
import { requireDomaine } from "@/lib/auth/require-domaine";

export const metadata: Metadata = { title: "Parcours · Back-office · Étudium" };

const NOUVEAU = (
  <Button asChild>
    <Link href="/admin/parcours/nouveau">Nouveau parcours</Link>
  </Button>
);

const chiffre = (n: number) => n.toLocaleString("fr-FR");

/**
 * Les parcours (demande du 2 novembre 2026, option A) : les chiffres clés, puis une carte par parcours avec ses
 * formations, ses apprenants, ses certificats et sa part des apprenants. On les range en les faisant glisser.
 */
async function ListeParcours() {
  await requireDomaine("contenus");
  let parcours: ParcoursAdmin[];
  let stats: StatistiquesParcours | null;
  try {
    [parcours, stats] = await Promise.all([listParcours(), lireStatistiquesParcours()]);
  } catch (erreur) {
    return <PageAdmin titre="Parcours" fil={[{ label: "Parcours" }]}>{siTablesAbsentes(erreur)}</PageAdmin>;
  }
  return (
    <PageAdmin
      titre="Parcours"
      description="Leur ordre ici est celui du catalogue : faites glisser une carte pour le changer."
      fil={[{ label: "Parcours" }]}
      action={NOUVEAU}
    >
      {parcours.length === 0 ? (
        <EmptyState icon={Route01Icon} title="Aucun parcours pour le moment" description="Créez le premier parcours : les formations s'y rangeront." />
      ) : (
        <div className="flex flex-col gap-6">
          {stats ? (
            <div className={GRILLE_CHIFFRES}>
              <Tuile icon={Route01Icon} label="Parcours actifs" value={chiffre(stats.totaux.parcoursActifs)} />
              <Tuile icon={BookOpen01Icon} label="Formations publiées" value={chiffre(stats.totaux.formationsPubliees)} />
              <Tuile icon={UserMultipleIcon} label="Apprenants" value={chiffre(stats.totaux.apprenants)} />
              <Tuile icon={Certificate01Icon} tone="reussite" label="Certificats" value={chiffre(stats.totaux.certificats)} />
            </div>
          ) : (
            <Banner tone="attention" title="Les chiffres des parcours ne sont pas disponibles">
              Appliquez la migration 0065 (guide « Ce qui te revient », section 64).
            </Banner>
          )}
          <GrilleParcours parcours={parcours} stats={stats} />
        </div>
      )}
    </PageAdmin>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-60 rounded-carte" />}>
      <ListeParcours />
    </Suspense>
  );
}
