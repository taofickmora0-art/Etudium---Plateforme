import { unstable_rethrow } from "next/navigation";
import { formationsDisponibles, nouvellesFormations } from "@/lib/accueil/fil";
import { demoModeActive, getAuthUser, getShellUser } from "@/lib/auth/current-user";
import { canAccess } from "@/lib/auth/permissions";
import { listCatalogue } from "@/lib/catalogue/data";
import type { CarteCatalogue } from "@/lib/catalogue/types";
import { lireAnnonce } from "@/lib/communaute/annonce";
import { lireActivites, lireAnalyseActive, lireEspaces, lireFil, lireTendances } from "@/lib/communaute/data";
import { UUID } from "@/lib/communaute/regles";
import type { MoiCommunaute } from "@/lib/communaute/types";
import { lireProchaineSession } from "@/lib/sessions/data";
import type { Lecture } from "@/lib/utilisateurs/types";
import { MigrationCommunauteAbsente } from "./cadre";
import { ColonneCommunaute } from "./ColonneCommunaute";
import { PageCommunaute } from "./PageCommunaute";

/**
 * Une lecture secondaire (la colonne de droite) : null avant sa migration, ou si elle échoue. La page ne casse pas pour
 * elle ; les interruptions de Next (pré-rendu, rendu dynamique) ne sont pas des échecs : elles repartent.
 */
async function facultatif<T>(quoi: string, lire: () => Promise<Lecture<T>>): Promise<T | null> {
  try {
    const lecture = await lire();
    return lecture.migrationAbsente ? null : lecture.donnees;
  } catch (erreur) {
    unstable_rethrow(erreur);
    console.error(`Lecture ${quoi} impossible :`, erreur instanceof Error ? erreur.message : erreur);
    return null;
  }
}

/** Le catalogue, pour les nouvelles formations du fil et « Formations disponibles » ; vide s'il ne se lit pas. */
async function catalogue(): Promise<CarteCatalogue[]> {
  try {
    return await listCatalogue();
  } catch (erreur) {
    unstable_rethrow(erreur);
    console.error("Lecture du catalogue impossible :", erreur instanceof Error ? erreur.message : erreur);
    return [];
  }
}

/** Le compte connecté : son avatar, son dossier pour les fichiers joints, et s'il est de l'équipe. */
export async function moiCommunaute(): Promise<MoiCommunaute> {
  const [shell, compte] = await Promise.all([getShellUser(), demoModeActive() ? null : getAuthUser()]);
  return {
    compteId: compte?.id ?? "",
    prenom: shell?.prenom ?? "",
    nom: shell?.nom ?? "",
    initiales: shell?.initials ?? "",
    photoUrl: shell?.photoUrl ?? null,
    equipe: shell ? canAccess("admin", shell.roles) : false,
  };
}

/**
 * L'Accueil (spec du nouvel Accueil) : les espaces, le fil de l'onglet demandé (`?espace=tous|general|<parcours>`, Actualités par défaut), l'annonce et la
 * colonne de droite, les formations du catalogue ; avant la migration 0019, un bandeau.
 */
export async function ContenuCommunaute({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> } = {}) {
  const brut = (await searchParams)?.espace;
  const demande = typeof brut === "string" && (brut === "tous" || brut === "general" || UUID.test(brut)) ? brut : "tous";
  const [espaces, filDemande, tendances, activites, session, moi, analyseActive, annonce, cartes] = await Promise.all([
    lireEspaces(),
    lireFil(demande),
    facultatif("des tendances", lireTendances),
    facultatif("des activités", lireActivites),
    facultatif("de la prochaine session", lireProchaineSession),
    moiCommunaute(),
    lireAnalyseActive(),
    lireAnnonce(),
    catalogue(),
  ]);
  if (espaces.migrationAbsente || filDemande.migrationAbsente) return <MigrationCommunauteAbsente />;
  // Un parcours inconnu (ou qui n'est plus actif) : les Actualités.
  const connu = !UUID.test(demande) || espaces.donnees.some((e) => e.id === demande);
  const onglet = connu ? demande : "tous";
  const fil = connu ? filDemande : await lireFil("tous");
  if (fil.migrationAbsente) return <MigrationCommunauteAbsente />;
  const maintenant = new Date();
  return (
    <PageCommunaute
      // Pas de `key` : un autre espace choisi dans le menu ≡ change l'adresse, que la page suit (useSearchParams) ; une
      // relecture du serveur (après un commentaire, une publication) garde l'onglet, le tri et le fil déjà chargés.
      ongletInitial={onglet}
      espaces={espaces.donnees}
      initial={fil.donnees}
      moi={moi}
      annonce={annonce}
      analyseActive={analyseActive}
      maintenant={maintenant.toISOString()}
      sessionsAVenir={session !== null}
      titre={moi.prenom ? `Bonjour, ${moi.prenom}` : "Bonjour"}
      nouvelles={nouvellesFormations(cartes, maintenant)}
      disponibles={formationsDisponibles(cartes)}
      colonne={<ColonneCommunaute session={session} tendances={tendances} activites={activites} maintenant={maintenant} />}
    />
  );
}
