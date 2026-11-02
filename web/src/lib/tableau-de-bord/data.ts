import { connection } from "next/server";
import { demoModeActive, getShellUser } from "@/lib/auth/current-user";
import { listCatalogue, listFiches } from "@/lib/catalogue/data";
import { estFonctionAbsente } from "@/lib/contenus/lecture";
import { DEMO_JEU } from "@/lib/demo-user";
import { lireInscriptions } from "@/lib/inscriptions/data";
import { formationsALire, formationsSuivies } from "@/lib/mes-formations/regles";
import { lireProgression } from "@/lib/progression/data";
import { lireProchaineSession } from "@/lib/sessions/data";
import { createClient } from "@/lib/supabase/server";
import { aFaire, continuer, indicateurs, versBaseTableau } from "./regles";
import type { BaseTableau, DonneesTableau } from "./types";

const DEMO_BASE: BaseTableau = { certificats: { nombre: 2, titres: ["Word", "Zotero"] }, aFaire: [], activite: [], jeu: DEMO_JEU, recommandations: [] };

/** mon_tableau_de_bord (0063) ; null si la migration manque (la page le dit). Une autre erreur remonte (« Réessayer »). */
async function lireBase(): Promise<BaseTableau | null> {
  if (demoModeActive()) return DEMO_BASE;
  const { data, error } = await (await createClient()).rpc("mon_tableau_de_bord");
  if (error) {
    if (estFonctionAbsente(error)) return null;
    throw new Error(`Lecture du tableau de bord impossible (${error.code ?? "?"}).`);
  }
  return versBaseTableau(data);
}

/**
 * Tout le tableau de bord de l'étudiant (lot 6 B, §1). Les formations suivies sont celles de « Mes formations » (les
 * inscrites, même à 0 % ; sans la 0069, les commencées) ; la prochaine session vient de prochaine_session ; le reste de
 * mon_tableau_de_bord. Une formation où l'on est inscrit n'est jamais recommandée ; sans la 0063, les recommandations
 * sont les premières formations du catalogue ni commencées ni inscrites.
 */
export async function lireTableauDeBord(): Promise<DonneesTableau> {
  // À chaque requête, jamais au prérendu : l'heure n'est lue qu'après (Next 16, cacheComponents).
  await connection();
  const maintenant = new Date();
  const [user, base, lignes, session, cartes, inscriptions] = await Promise.all([
    getShellUser(),
    lireBase(),
    lireProgression(),
    lireProchaineSession(),
    listCatalogue(),
    lireInscriptions(),
  ]);
  const aLire = formationsALire(lignes, inscriptions);
  const suivies = formationsSuivies(aLire.length > 0 ? await listFiches(aLire) : [], lignes ?? [], new Set(), inscriptions);
  const inscrites = new Set((inscriptions ?? []).map((i) => i.formationId));
  const dejaSuivies = new Set([...(lignes ?? []).map((l) => l.formationId), ...inscrites]);
  const parId = new Map(cartes.map((c) => [c.id, c]));
  const recommandees = base
    ? base.recommandations.filter((r) => !inscrites.has(r.id)).flatMap((r) => parId.get(r.id) ?? [])
    : cartes.filter((c) => !dejaSuivies.has(c.id)).slice(0, 3);
  const affichees = recommandees.slice(0, 3);
  // Le message de suite ne parle que d'une formation dont la carte est affichée.
  const suite = base?.recommandations.find((r) => r.message && affichees.some((c) => c.id === r.id));
  return {
    prenom: user?.prenom ?? "",
    indicateurs: indicateurs(suivies, lignes ?? [], maintenant),
    continuer: continuer(suivies),
    aFaire: aFaire(base?.aFaire ?? [], suivies),
    base,
    session: session.migrationAbsente ? undefined : session.donnees,
    recommandees: affichees,
    messageSuite: suite?.message ?? null,
    aucunePubliee: cartes.length === 0,
    maintenant: maintenant.toISOString(),
  };
}
