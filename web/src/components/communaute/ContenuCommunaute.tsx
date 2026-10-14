import { unstable_rethrow } from "next/navigation";
import { demoModeActive, getAuthUser, getShellUser } from "@/lib/auth/current-user";
import { lireEspaces, lireFil, lireMembresActifs } from "@/lib/communaute/data";
import type { MoiCommunaute } from "@/lib/communaute/types";
import { lireProchaineSession } from "@/lib/sessions/data";
import { MigrationCommunauteAbsente } from "./cadre";
import { ColonneCommunaute } from "./ColonneCommunaute";
import { PageCommunaute } from "./PageCommunaute";

/** La prochaine session live (0018) ; null avant la migration, ou si la lecture échoue : la page ne casse pas pour elle. */
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

/** Le compte connecté : son avatar, et son dossier pour les fichiers joints. */
export async function moiCommunaute(): Promise<MoiCommunaute> {
  const [shell, compte] = await Promise.all([getShellUser(), demoModeActive() ? null : getAuthUser()]);
  return { compteId: compte?.id ?? "", prenom: shell?.prenom ?? "", nom: shell?.nom ?? "", initiales: shell?.initials ?? "", photoUrl: shell?.photoUrl ?? null };
}

/** Les espaces, le fil « Général » et la colonne de droite ; avant la migration 0019, un bandeau. */
export async function ContenuCommunaute() {
  const [espaces, fil, membres, session, moi] = await Promise.all([lireEspaces(), lireFil("tous"), lireMembresActifs(), prochaineSession(), moiCommunaute()]);
  if (espaces.migrationAbsente || fil.migrationAbsente) return <MigrationCommunauteAbsente />;
  return (
    <PageCommunaute
      espaces={espaces.donnees}
      initial={fil.donnees}
      moi={moi}
      maintenant={new Date().toISOString()}
      colonne={<ColonneCommunaute session={session} membres={membres.migrationAbsente ? [] : membres.donnees} espaces={espaces.donnees} />}
    />
  );
}
