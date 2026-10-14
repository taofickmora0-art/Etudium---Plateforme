import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { TableauDeBord } from "@/components/accueil/TableauDeBord";
import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { SessionGuard } from "@/components/layout/SessionGuard";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Heading, Lead } from "@/components/ui/Text";
import { tableauDeBord } from "@/lib/accueil/regles";
import { getShellUser } from "@/lib/auth/current-user";
import { listCatalogue, listFiches } from "@/lib/catalogue/data";
import { formationsSuivies } from "@/lib/mes-formations/regles";
import { lireProgression } from "@/lib/progression/data";
import { lireProchaineSession } from "@/lib/sessions/data";

export const metadata: Metadata = { title: "Accueil · Étudium" };

// Titre de page plus petit sur téléphone (NdMobAccueil : 28/36).
const TITRE = "max-sm:text-[28px] max-sm:leading-9";

async function Salutation() {
  const prenom = (await getShellUser())?.prenom;
  return (
    <Heading level="page" className={TITRE}>
      {prenom ? `Bonjour, ${prenom}` : "Bonjour"}
    </Heading>
  );
}

/** La prochaine session live (0018) ; null avant la migration, ou si la lecture échoue : l'accueil ne casse jamais. */
async function prochaineSession() {
  try {
    const lecture = await lireProchaineSession();
    return lecture.migrationAbsente ? null : lecture.donnees;
  } catch (erreur) {
    // Les interruptions de Next (pré-rendu, rendu dynamique) ne sont pas des échecs : elles repartent.
    unstable_rethrow(erreur);
    console.error("Lecture de la prochaine session impossible :", erreur instanceof Error ? erreur.message : erreur);
    return null;
  }
}

async function Contenu() {
  let donnees;
  const session = prochaineSession();
  try {
    // Sans les tables de progression (0007, 0008), aucune formation n'est encore commencée.
    const [lignes, cartes] = await Promise.all([lireProgression(), listCatalogue()]);
    const ids = [...new Set((lignes ?? []).map((l) => l.formationId))];
    donnees = tableauDeBord(formationsSuivies(await listFiches(ids), lignes ?? [], new Set()), cartes);
  } catch (erreur) {
    return siTablesAbsentes(erreur);
  }
  return <TableauDeBord donnees={donnees} session={await session} />;
}

/** Accueil de l'espace connecté (NdAccueil, NdMobAccueil) : tableau de bord, version de base (spec du lot 1, §8). */
export default function AccueilPage() {
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-[1_1_320px]">
          <Suspense
            fallback={
              <Heading level="page" className={TITRE}>
                Bonjour
              </Heading>
            }
          >
            <Salutation />
          </Suspense>
          <Lead className="mt-2.5 max-sm:hidden">Continuez votre apprentissage et atteignez vos objectifs.</Lead>
        </div>
        <Button asChild variant="contour" className="max-sm:hidden">
          <Link href="/formations">Explorer le catalogue</Link>
        </Button>
      </div>
      <div aria-hidden="true" className="mt-5 h-px bg-separateur max-sm:hidden" />
      <div className="mt-8 max-sm:mt-6">
        <Suspense fallback={<Skeleton className="h-96 rounded-panneau" />}>
          <Contenu />
        </Suspense>
      </div>
      <Suspense fallback={null}>
        <SessionGuard />
      </Suspense>
    </div>
  );
}
