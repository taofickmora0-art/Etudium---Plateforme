import { Suspense } from "react";
import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { VueEnsemble } from "@/components/admin/statistiques/VueEnsemble";
import { TableauModerateur } from "@/components/admin/TableauModerateur";
import { Banner } from "@/components/ui/Banner";
import { Skeleton } from "@/components/ui/Skeleton";
import { aDomaine } from "@/lib/auth/domaines";
import { requireSpace } from "@/lib/auth/require-space";
import { compterMessagesNonLus } from "@/lib/messages/actions";
import { lireNombreAExaminer } from "@/lib/moderation/data";
import { lireSessionsEquipe } from "@/lib/sessions/data";
import { lireVueEnsemble } from "@/lib/statistiques/data";

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

/** Les contenus de la file de modération (0020) ; null avant la migration ou si la lecture échoue. */
async function aExaminer(): Promise<number | null> {
  try {
    return await lireNombreAExaminer();
  } catch (erreur) {
    unstable_rethrow(erreur);
    console.error("Lecture de la file de modération impossible :", erreur instanceof Error ? erreur.message : erreur);
    return null;
  }
}

/** Les conversations d'assistance non lues ; null si la lecture échoue. */
async function messagesNonLus(): Promise<number | null> {
  try {
    return await compterMessagesNonLus("equipe");
  } catch (erreur) {
    unstable_rethrow(erreur);
    return null;
  }
}

async function AccueilAdmin() {
  const user = await requireSpace("admin");
  // Sans le domaine « statistiques » (le modérateur, lot 6 A) : seulement ce qu'il a à traiter.
  if (!aDomaine(user.roles, "statistiques")) {
    const [moderation, messages, sessions] = await Promise.all([aExaminer(), messagesNonLus(), sessionsAVenir()]);
    return (
      <PageAdmin titre="Tableau de bord" description="Ce qui attend l’équipe de la communauté.">
        <TableauModerateur aExaminer={moderation} messagesNonLus={messages} sessionsAVenir={sessions} />
      </PageAdmin>
    );
  }
  // La vue d'ensemble du design (NdAdmin ; lot 6 A, migration 0062).
  const vue = await lireVueEnsemble();
  return (
    <PageAdmin titre="Back-office" description="Vue d’ensemble de la plateforme.">
      {vue ? (
        <VueEnsemble donnees={vue} />
      ) : (
        <Banner tone="attention" title="La vue d’ensemble n’est pas disponible">
          Appliquez la migration 0062 (guide « Ce qui te revient », section 61).
        </Banner>
      )}
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
