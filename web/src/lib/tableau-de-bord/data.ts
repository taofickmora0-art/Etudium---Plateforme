import { connection } from "next/server";
import { demoModeActive, getShellUser } from "@/lib/auth/current-user";
import { listCatalogue, listFiches } from "@/lib/catalogue/data";
import { estFonctionAbsente } from "@/lib/contenus/lecture";
import { DEMO_JEU } from "@/lib/demo-user";
import { formationsSuivies } from "@/lib/mes-formations/regles";
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
 * Tout le tableau de bord de l'étudiant (lot 6 B, §1). La progression des formations suit les règles de « Mes
 * formations » ; la prochaine session vient de prochaine_session ; le reste de mon_tableau_de_bord. Sans la 0063, les
 * recommandations sont les premières formations du catalogue pas encore commencées.
 */
export async function lireTableauDeBord(): Promise<DonneesTableau> {
  // À chaque requête, jamais au prérendu : l'heure n'est lue qu'après (Next 16, cacheComponents).
  await connection();
  const maintenant = new Date();
  const [user, base, lignes, session, cartes] = await Promise.all([getShellUser(), lireBase(), lireProgression(), lireProchaineSession(), listCatalogue()]);
  const commencees = [...new Set((lignes ?? []).map((l) => l.formationId))];
  const suivies = formationsSuivies(commencees.length > 0 ? await listFiches(commencees) : [], lignes ?? [], new Set());
  const parId = new Map(cartes.map((c) => [c.id, c]));
  const recommandees = base
    ? base.recommandations.flatMap((r) => parId.get(r.id) ?? [])
    : cartes.filter((c) => !commencees.includes(c.id)).slice(0, 3);
  return {
    prenom: user?.prenom ?? "",
    indicateurs: indicateurs(suivies, lignes ?? [], maintenant),
    continuer: continuer(suivies),
    aFaire: aFaire(base?.aFaire ?? [], suivies),
    base,
    session: session.migrationAbsente ? undefined : session.donnees,
    recommandees: recommandees.slice(0, 3),
    messageSuite: base?.recommandations.find((r) => r.message)?.message ?? null,
    maintenant: maintenant.toISOString(),
  };
}
