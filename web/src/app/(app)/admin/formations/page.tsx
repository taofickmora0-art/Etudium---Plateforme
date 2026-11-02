import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen01Icon, Clock01Icon, PencilEdit02Icon, UserMultipleIcon } from "@hugeicons/core-free-icons";
import { FiltreStatut } from "@/components/admin/FiltreStatut";
import { chiffresDesEtats, GrilleFormationsAdmin } from "@/components/admin/formations/GrilleFormationsAdmin";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { GRILLE_CHIFFRES, Tuile } from "@/components/tableau/Blocs";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import type { ChiffresFormations } from "@/lib/admin/cartes-chiffres";
import { lireChiffresFormations, listFormations } from "@/lib/admin/data";
import type { FormationResume } from "@/lib/admin/types";
import { requireDomaine } from "@/lib/auth/require-domaine";
import { correspondAuFiltre, type FiltreEtat } from "@/lib/contenus/etat";

export const metadata: Metadata = { title: "Formations · Back-office · Étudium" };

type Recherche = { searchParams: Promise<{ statut?: string }> };

const NOUVELLE = (
  <Button asChild>
    <Link href="/admin/formations/nouvelle">Nouvelle formation</Link>
  </Button>
);

const FILTRES: FiltreEtat[] = ["en_attente", "brouillon", "publiee", "desactivee", "archivee"];

const chiffre = (n: number) => n.toLocaleString("fr-FR");

/**
 * Les formations, au style de l'espace étudiant (demande du 2 novembre 2026) : les chiffres clés, le filtre par statut,
 * puis une carte par formation avec sa couverture, son parcours, son état, ses apprenants et ce qui l'attend.
 */
async function ListeFormations({ searchParams }: Recherche) {
  await requireDomaine("contenus");
  const { statut } = await searchParams;
  const filtre = FILTRES.find((f) => f === statut) ?? null;
  let formations: FormationResume[];
  let chiffres: ChiffresFormations | null;
  try {
    [formations, chiffres] = await Promise.all([listFormations(), lireChiffresFormations()]);
  } catch (erreur) {
    return <PageAdmin titre="Formations" fil={[{ label: "Formations" }]}>{siTablesAbsentes(erreur)}</PageAdmin>;
  }
  const affichees = filtre ? formations.filter((f) => correspondAuFiltre(f.etat, filtre)) : formations;
  const etats = chiffresDesEtats(formations);
  return (
    <PageAdmin titre="Formations" description="Brouillons, formations publiées, désactivées et archivées." fil={[{ label: "Formations" }]} action={NOUVELLE}>
      {formations.length === 0 ? (
        <EmptyState
          icon={BookOpen01Icon}
          title="Aucune formation pour le moment"
          description="Créez une formation : elle naît en brouillon, visible seulement par l’équipe."
        />
      ) : (
        <div className="flex flex-col gap-6">
          <div className={GRILLE_CHIFFRES}>
            <Tuile icon={BookOpen01Icon} tone="reussite" label="Publiées" value={chiffre(etats.publiees)} />
            <Tuile icon={Clock01Icon} tone="attention" label="En attente de validation" value={chiffre(etats.enAttente)} />
            <Tuile icon={PencilEdit02Icon} label="Brouillons" value={chiffre(etats.brouillons)} />
            <Tuile icon={UserMultipleIcon} tone="information" label="Apprenants" value={chiffres ? chiffre(chiffres.apprenantsTotal) : "—"} />
          </div>
          {!chiffres && (
            <Banner tone="attention" title="Les chiffres des formations ne sont pas disponibles">
              Appliquez la migration 0068 (guide « Ce qui te revient », section 67).
            </Banner>
          )}
          <FiltreStatut valeur={filtre ?? "toutes"} />
          {affichees.length === 0 ? (
            <EmptyState icon={BookOpen01Icon} title="Aucune formation avec ce statut" description="Choisissez un autre filtre, ou « Toutes »." />
          ) : (
            <GrilleFormationsAdmin formations={affichees} chiffres={chiffres} />
          )}
        </div>
      )}
    </PageAdmin>
  );
}

export default function Page({ searchParams }: Recherche) {
  return (
    <Suspense fallback={<Skeleton className="h-60 rounded-carte" />}>
      <ListeFormations searchParams={searchParams} />
    </Suspense>
  );
}
