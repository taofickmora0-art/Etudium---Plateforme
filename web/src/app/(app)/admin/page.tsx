import { Suspense } from "react";
import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { TableauDeBordAdmin } from "@/components/admin/TableauDeBordAdmin";
import { Skeleton } from "@/components/ui/Skeleton";
import { lireStatistiques } from "@/lib/admin/statistiques";
import { requireSpace } from "@/lib/auth/require-space";
import { lireSessionsEquipe } from "@/lib/sessions/data";

export const metadata: Metadata = { title: "Back-office · Étudium" };

/** Le nombre de sessions live programmées à venir (0018) ; null avant la migration ou si la lecture échoue. */
async function sessionsAVenir(): Promise<number | null> {
  try {
    const lecture = await lireSessionsEquipe();
    return lecture.migrationAbsente ? null : lecture.donnees.aVenir.filter((s) => s.statut === "programmee").length;
  } catch (erreur) {
    // Les interruptions de Next (pré-rendu, rendu dynamique) ne sont pas des échecs : elles repartent.
    unstable_rethrow(erreur);
    console.error("Lecture des sessions live impossible :", erreur instanceof Error ? erreur.message : erreur);
    return null;
  }
}

async function AccueilAdmin() {
  await requireSpace("admin");
  const [stats, sessions] = await Promise.all([lireStatistiques(), sessionsAVenir()]);
  return (
    <PageAdmin titre="Tableau de bord" description="Vue d’ensemble de la plateforme : inscriptions, apprentissage et, à partir du lot 2, revenus.">
      <TableauDeBordAdmin stats={stats} sessionsAVenir={sessions} />
    </PageAdmin>
  );
}

/** Accueil du back-office (spec du lot 1, §10) : réservé à l'équipe, rien n'est rendu avant la vérification du rôle. */
export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-60 max-w-[680px] rounded-carte" />}>
      <AccueilAdmin />
    </Suspense>
  );
}
