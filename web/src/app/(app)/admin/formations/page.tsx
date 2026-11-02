import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen01Icon } from "@hugeicons/core-free-icons";
import { FiltreStatut } from "@/components/admin/FiltreStatut";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { List, ListRow } from "@/components/ui/ListRow";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tag } from "@/components/ui/Tag";
import { listFormations } from "@/lib/admin/data";
import type { FormationResume } from "@/lib/admin/types";
import { requireDomaine } from "@/lib/auth/require-domaine";
import { correspondAuFiltre, ETATS, TON_ETAT, type FiltreEtat } from "@/lib/contenus/etat";
import { libelleNiveau } from "@/lib/contenus/libelles";
import { dateCourte } from "@/lib/utilisateurs/regles";

export const metadata: Metadata = { title: "Formations · Back-office · Étudium" };

type Recherche = { searchParams: Promise<{ statut?: string }> };

const NOUVELLE = (
  <Button asChild>
    <Link href="/admin/formations/nouvelle">Nouvelle formation</Link>
  </Button>
);

const FILTRES: FiltreEtat[] = ["en_attente", "brouillon", "publiee", "desactivee", "archivee"];

const sousTitre = (f: FormationResume) =>
  [
    f.parcours.join(", ") || "Sans parcours",
    libelleNiveau(f.niveau),
    `${f.nbLecons} ${f.nbLecons > 1 ? "leçons" : "leçon"}`,
    f.modifieeParFormateurLe && `Modifiée par le formateur le ${dateCourte(f.modifieeParFormateurLe)}`,
    f.modificationsNonPubliees && "Modifications non publiées",
  ]
    .filter(Boolean)
    .join(" · ");

async function ListeFormations({ searchParams }: Recherche) {
  await requireDomaine("contenus");
  const { statut } = await searchParams;
  const filtre = FILTRES.find((f) => f === statut) ?? null;
  let formations: FormationResume[];
  try {
    formations = await listFormations();
  } catch (erreur) {
    return <PageAdmin titre="Formations" fil={[{ label: "Formations" }]}>{siTablesAbsentes(erreur)}</PageAdmin>;
  }
  const affichees = filtre ? formations.filter((f) => correspondAuFiltre(f.etat, filtre)) : formations;
  return (
    <PageAdmin titre="Formations" description="Brouillons, formations publiées et archivées." fil={[{ label: "Formations" }]} action={NOUVELLE}>
      <div className="flex max-w-[680px] flex-col gap-4">
        <FiltreStatut valeur={filtre ?? "toutes"} />
        {affichees.length === 0 ? (
          <EmptyState
            icon={BookOpen01Icon}
            title="Aucune formation pour le moment"
            description="Créez une formation : elle naît en brouillon, visible seulement par l’équipe."
          />
        ) : (
          <List label="Formations">
            {affichees.map((f) => (
              <ListRow
                key={f.id}
                leading={<IconTile icon={BookOpen01Icon} />}
                title={f.titre}
                subtitle={sousTitre(f)}
                trailing={<Tag tone={TON_ETAT[f.etat]}>{ETATS[f.etat]}</Tag>}
                href={`/admin/formations/${f.id}`}
              />
            ))}
          </List>
        )}
      </div>
    </PageAdmin>
  );
}

export default function Page({ searchParams }: Recherche) {
  return (
    <Suspense fallback={<Skeleton className="h-60 max-w-[680px] rounded-carte" />}>
      <ListeFormations searchParams={searchParams} />
    </Suspense>
  );
}
