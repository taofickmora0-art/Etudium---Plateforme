import { versVueCarte, type VueCarteSuivie } from "@/components/mes-formations/CarteSuivie";
import { listFiches } from "@/lib/catalogue/data";
import { lireFavoris } from "@/lib/favoris/data";
import { lireInscriptions } from "@/lib/inscriptions/data";
import { lireProgression } from "@/lib/progression/data";
import { formationsALire, formationsSuivies } from "./regles";

/**
 * Ce que « Mes formations », sa rangée de la page Formations et les cartes du catalogue montrent du compte connecté
 * (spec du 2 novembre 2026, §2 et §4). Données simples : elles passent aux composants du navigateur.
 */
export type SuiviDuCompte = {
  /** Ses formations (inscrites, même à 0 %), de la plus récemment ouverte ou rejointe à la plus ancienne. */
  suivies: VueCarteSuivie[];
  /**
   * Les formations où il est inscrit, avec son pourcentage terminé (« 40 % terminé » sur la carte). Sans la 0069, ses
   * formations commencées en tiennent lieu (le rattrapage de la 0069 les inscrit de même).
   */
  inscrites: Record<string, number>;
  /** Ses favoris ; null sans la table des favoris (0009) : pas de cœur sur les cartes. */
  favoris: string[] | null;
};

/**
 * Lit en parallèle la progression, les favoris et les inscriptions du compte, puis les fiches de ses formations en une
 * seule requête : celles où il est inscrit. Un aperçu ouvert sans inscription n'en fait pas une de ses formations. Sans
 * les tables de progression (0007, 0008), aucune n'est commencée ; sans la 0069, ses formations sont celles qu'il a
 * commencées (comportement d'avant). Relance les erreurs.
 */
export async function lireSuiviDuCompte(): Promise<SuiviDuCompte> {
  const [lignes, favoris, inscriptions] = await Promise.all([lireProgression(), lireFavoris(), lireInscriptions()]);
  const ids = formationsALire(lignes, inscriptions);
  const favorisIds = favoris ? favoris.map((f) => f.formationId) : null;
  if (ids.length === 0) return { suivies: [], inscrites: {}, favoris: favorisIds };
  const suivies = formationsSuivies(await listFiches(ids), lignes ?? [], new Set(favorisIds ?? []), inscriptions);
  return {
    suivies: suivies.map(versVueCarte),
    inscrites: Object.fromEntries(suivies.map((s) => [s.fiche.id, s.progression.pourcentage])),
    favoris: favorisIds,
  };
}

/** Les formations suivies du compte (page « Mes formations »). Relance les erreurs. */
export async function lireFormationsSuivies(): Promise<VueCarteSuivie[]> {
  return (await lireSuiviDuCompte()).suivies;
}
