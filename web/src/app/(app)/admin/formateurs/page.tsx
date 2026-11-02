import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen01Icon, StarIcon, TaskDone01Icon, TeachingIcon } from "@hugeicons/core-free-icons";
import { GrilleFormateurs } from "@/components/admin/formateurs/GrilleFormateurs";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { GRILLE_CHIFFRES, Tuile } from "@/components/tableau/Blocs";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { noteLisible, type ChiffresFormateurs } from "@/lib/admin/cartes-chiffres";
import { lireChiffresFormateurs, listFormateurs } from "@/lib/admin/data";
import type { FormateurAdmin } from "@/lib/admin/types";
import { requireDomaine } from "@/lib/auth/require-domaine";

export const metadata: Metadata = { title: "Formateurs · Back-office · Étudium" };

const NOUVELLE = (
  <Button asChild>
    <Link href="/admin/formateurs/nouveau">Nouvelle fiche</Link>
  </Button>
);

const chiffre = (n: number) => n.toLocaleString("fr-FR");

/**
 * Les formateurs, au style de l'espace étudiant (demande du 2 novembre 2026) : les chiffres clés, puis une carte par
 * fiche avec ses formations, ses apprenants, sa note, ses corrections en attente et son compte.
 */
async function ListeFormateurs() {
  await requireDomaine("contenus");
  let formateurs: FormateurAdmin[];
  let chiffres: ChiffresFormateurs | null;
  try {
    [formateurs, chiffres] = await Promise.all([listFormateurs(), lireChiffresFormateurs()]);
  } catch (erreur) {
    return <PageAdmin titre="Formateurs" fil={[{ label: "Formateurs" }]}>{siTablesAbsentes(erreur)}</PageAdmin>;
  }
  const note = chiffres?.totaux.noteMoyenne;
  return (
    <PageAdmin titre="Formateurs" description="Les fiches affichées sur les formations." fil={[{ label: "Formateurs" }]} action={NOUVELLE}>
      {formateurs.length === 0 ? (
        <EmptyState icon={TeachingIcon} title="Aucune fiche pour le moment" description="Créez la fiche d’un formateur pour l’associer à ses formations." />
      ) : (
        <div className="flex flex-col gap-6">
          {chiffres ? (
            <div className={GRILLE_CHIFFRES}>
              <Tuile icon={TeachingIcon} label="Formateurs" value={chiffre(chiffres.totaux.formateurs)} />
              <Tuile icon={BookOpen01Icon} tone="reussite" label="Formations publiées" value={chiffre(chiffres.totaux.formationsPubliees)} />
              <Tuile icon={TaskDone01Icon} tone="attention" label="Corrections en attente" value={chiffre(chiffres.totaux.aCorriger)} />
              <Tuile icon={StarIcon} tone="information" label="Note moyenne" value={note !== null && note !== undefined ? noteLisible(note) : "—"} />
            </div>
          ) : (
            <Banner tone="attention" title="Les chiffres des formateurs ne sont pas disponibles">
              Appliquez la migration 0068 (guide « Ce qui te revient », section 67).
            </Banner>
          )}
          <GrilleFormateurs formateurs={formateurs} chiffres={chiffres} />
        </div>
      )}
    </PageAdmin>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-60 rounded-carte" />}>
      <ListeFormateurs />
    </Suspense>
  );
}
