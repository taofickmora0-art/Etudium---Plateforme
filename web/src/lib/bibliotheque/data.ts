import { demoModeActive } from "@/lib/auth/current-user";
import { estFonctionAbsente } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";
import { versBibliothequeAdmin, versCartesLivres, versCatalogue, versCategoriesRangees, versFicheLivre } from "./conversion";
import { estUuid } from "./regles";
import type {
  BibliothequeAdmin,
  CarteLivre,
  CatalogueBibliotheque,
  CategorieRangee,
  FicheLivre,
  FiltresBibliotheque,
  LivreRecommande,
  StatutLivre,
} from "./types";

// Les lectures de la Bibliothèque (migration 0074). Le back-office (étape A) lit tout par livres_back_office ; les pages
// des étudiants et des visiteurs (étapes B et C) par les fonctions publiques, qui ne donnent jamais le chemin d'un PDF.
// Sans la 0074, chaque lecture rend null (ou une liste vide) : la page le dit (l'équipe lit la migration à appliquer,
// les autres un message neutre).

type ErreurBase = { code?: string; message?: string } | null;
const absente = (e: ErreurBase) => estFonctionAbsente(e) || e?.code === "PGRST205" || e?.code === "42P01";

const VIDE: BibliothequeAdmin = {
  totaux: { publies: 0, brouillons: 0, archives: 0, lectures: 0, lectures30j: 0, telechargements: 0, telechargements30j: 0 },
  livres: [],
};

/** Les livres du back-office (tous, ou celui-ci) et les totaux ; null sans la 0074. Réservé à l'équipe des contenus. */
export async function lireBibliothequeAdmin(livreId?: string): Promise<BibliothequeAdmin | null> {
  if (demoModeActive()) return VIDE;
  if (livreId !== undefined && !estUuid(livreId)) return VIDE;
  const { data, error } = await (await createClient()).rpc("livres_back_office", livreId ? { p_livre: livreId } : {});
  if (error) {
    if (absente(error)) return null;
    throw new Error(`Lecture de la bibliothèque impossible (${error.code ?? "?"}).`);
  }
  return versBibliothequeAdmin(data);
}

/** Les catégories, dans leur ordre ; null sans la 0074. */
export async function listCategoriesLivres(): Promise<CategorieRangee[] | null> {
  if (demoModeActive()) return [];
  const { data, error } = await (await createClient()).from("categories_livres").select("id, slug, nom, ordre").order("ordre").order("nom");
  if (error) {
    if (absente(error)) return null;
    throw new Error(`Lecture des catégories impossible (${error.code ?? "?"}).`);
  }
  return versCategoriesRangees(data);
}

/** Les livres recommandés par une formation, dans leur ordre (back-office) ; null sans la 0074. */
export async function lireLivresRecommandes(formationId: string): Promise<LivreRecommande[] | null> {
  if (demoModeActive() || !estUuid(formationId)) return [];
  const { data, error } = await (
    await createClient()
  )
    .from("livres_formations")
    .select("ordre, livres(id, titre, auteur, statut, couverture)")
    .eq("formation_id", formationId)
    .order("ordre");
  if (error) {
    if (absente(error)) return null;
    throw new Error(`Lecture des livres recommandés impossible (${error.code ?? "?"}).`);
  }
  return ((data as { livres: unknown }[] | null) ?? [])
    .map((ligne) => (Array.isArray(ligne.livres) ? ligne.livres[0] : ligne.livres) as Record<string, unknown> | null)
    .filter((l): l is Record<string, unknown> => Boolean(l && typeof l.id === "string"))
    .map((l) => ({
      id: String(l.id),
      titre: typeof l.titre === "string" ? l.titre : "",
      auteur: typeof l.auteur === "string" ? l.auteur : "",
      statut: (["brouillon", "publie", "archive"].includes(String(l.statut)) ? l.statut : "brouillon") as StatutLivre,
      couverture: typeof l.couverture === "string" && l.couverture ? l.couverture : null,
    }));
}

// ─── Étudiants et visiteurs (étapes B et C) ─────────────────────────────────────────────────────────

/** Le catalogue (livres publiés, catégories et parcours des filtres) ; null sans la 0074. */
export async function lireCatalogue(filtres: FiltresBibliotheque = {}): Promise<CatalogueBibliotheque | null> {
  if (demoModeActive()) return { livres: [], categories: [], parcours: [] };
  const { data, error } = await (
    await createClient()
  ).rpc("bibliotheque_catalogue", {
    p_recherche: (filtres.recherche ?? "").slice(0, 100),
    p_parcours: filtres.parcours ?? null,
    p_categorie: filtres.categorie ?? null,
    p_gratuits: filtres.gratuits === true,
  });
  if (error) {
    if (absente(error)) return null;
    throw new Error(`Lecture de la bibliothèque impossible (${error.code ?? "?"}).`);
  }
  return versCatalogue(data);
}

/** La fiche d'un livre par son adresse ; null s'il n'existe pas, n'est pas publié, ou sans la 0074. */
export async function lireFicheLivre(slug: string): Promise<FicheLivre | null> {
  if (demoModeActive() || !/^[a-z0-9-]{1,90}$/.test(slug)) return null;
  const { data, error } = await (await createClient()).rpc("livre_fiche", { p_slug: slug });
  if (error) {
    if (absente(error)) return null;
    throw new Error(`Lecture du livre impossible (${error.code ?? "?"}).`);
  }
  return versFicheLivre(data);
}

async function lireCartes(fonction: string, args: Record<string, unknown> = {}): Promise<CarteLivre[]> {
  if (demoModeActive()) return [];
  const { data, error } = await (await createClient()).rpc(fonction, args);
  if (error) {
    if (absente(error)) return [];
    throw new Error(`Lecture de la bibliothèque impossible (${error.code ?? "?"}).`);
  }
  return versCartesLivres(data);
}

/** « Continuer la lecture » : les livres commencés, non terminés, du plus récent au plus ancien. */
export const lireMesLectures = (limite = 12) => lireCartes("mes_lectures", { p_limite: limite });
/** Les livres en favori du compte connecté. */
export const lireMesFavorisLivres = () => lireCartes("mes_favoris_livres");
/** « Pour aller plus loin » : les livres publiés recommandés par une formation, dans leur ordre. */
export const lireLivresFormation = (formationId: string) =>
  estUuid(formationId) ? lireCartes("livres_formation", { p_formation: formationId }) : Promise.resolve([]);

/** Les livres publiés, par titre, à proposer dans « Livres recommandés » d'une formation (back-office) ; [] sans la 0074. */
export async function listLivresPublies(): Promise<{ id: string; titre: string; auteur: string }[]> {
  if (demoModeActive()) return [];
  const { data, error } = await (await createClient()).from("livres").select("id, titre, auteur").eq("statut", "publie").order("titre");
  if (error) {
    if (absente(error)) return [];
    throw new Error(`Lecture des livres impossible (${error.code ?? "?"}).`);
  }
  return ((data as { id: string; titre: string; auteur: string | null }[] | null) ?? []).map((l) => ({ id: l.id, titre: l.titre ?? "", auteur: l.auteur ?? "" }));
}
