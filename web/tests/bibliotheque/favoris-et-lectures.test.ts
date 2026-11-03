import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";

// Les favoris des livres (favoris_livres, 0074) et les lectures des pages des étudiants : sans la 0074, un message neutre
// (actions) ou « absente » (fiche), jamais une erreur.

const faux = fauxSupabase();
const MOI = "99999999-9999-4999-8999-999999999999";
let compte: { id: string } | null = { id: MOI };
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ ...faux.client, auth: { getUser: async () => ({ data: { user: compte }, error: null }) } }),
}));
const demo = vi.hoisted(() => ({ active: false }));
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: vi.fn(), demoModeActive: () => demo.active }));
const refresh = vi.fn();
vi.mock("next/cache", () => ({ refresh: () => refresh() }));

const { ajouterFavoriLivre, retirerFavoriLivre } = await import("@/lib/bibliotheque/actions");
const { lireCatalogue, lireFicheLivre, lireLivresFormation, lireMesFavorisLivres, lireMesLectures } = await import("@/lib/bibliotheque/data");

const L = "11111111-1111-4111-8111-111111111111";
const ABSENTE = { code: "PGRST202", message: "Could not find the function" };
const TABLE_ABSENTE = { code: "PGRST205", message: "Could not find the table" };

beforeEach(() => {
  faux.vider();
  refresh.mockReset();
  demo.active = false;
  compte = { id: MOI };
});

describe("Les favoris des livres", () => {
  it("ajouter : une ligne pour le compte connecté, sans doublon (double clic), puis la page est relue", async () => {
    expect(await ajouterFavoriLivre(L)).toEqual({ ok: true });
    const [appel] = faux.de("favoris_livres", "upsert");
    expect(appel.valeurs).toEqual({ profil_id: MOI, livre_id: L });
    expect(appel.options).toEqual({ onConflict: "profil_id,livre_id", ignoreDuplicates: true });
    expect(refresh).toHaveBeenCalled();
  });

  it("retirer : seulement le favori du compte connecté", async () => {
    expect(await retirerFavoriLivre(L)).toEqual({ ok: true });
    const [appel] = faux.de("favoris_livres", "delete");
    expect(appel.filtres).toEqual(expect.arrayContaining([["eq", "livre_id", L], ["eq", "profil_id", MOI]]));
  });

  it("un visiteur, un identifiant inconnu ou un refus de la base : un message, rien d'écrit ni de relu", async () => {
    compte = null;
    expect(await ajouterFavoriLivre(L)).toEqual({ ok: false, erreur: "Connectez-vous pour ajouter un favori." });
    compte = { id: MOI };
    expect(await ajouterFavoriLivre("pas-un-id")).toEqual({ ok: false, erreur: "Le favori n’a pas pu être enregistré. Réessayez." });
    faux.repondre("favoris_livres.upsert", { error: { code: "42501", message: "new row violates row-level security policy" } });
    expect(await ajouterFavoriLivre(L)).toEqual({ ok: false, erreur: "Le favori n’a pas pu être enregistré. Réessayez." });
    faux.repondre("favoris_livres.delete", { error: { code: "500", message: "panne" } });
    expect(await retirerFavoriLivre(L)).toEqual({ ok: false, erreur: "Le favori n’a pas pu être retiré. Réessayez." });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("sans la 0074 : « Cette fonction n'est pas disponible pour le moment. »", async () => {
    faux.repondre("favoris_livres.upsert", { error: TABLE_ABSENTE });
    expect(await ajouterFavoriLivre(L)).toEqual({ ok: false, erreur: "Cette fonction n’est pas disponible pour le moment." });
    faux.repondre("favoris_livres.delete", { error: { code: "42P01", message: "relation does not exist" } });
    expect(await retirerFavoriLivre(L)).toEqual({ ok: false, erreur: "Cette fonction n’est pas disponible pour le moment." });
  });
});

describe("Les lectures des pages des étudiants", () => {
  const carte = { id: L, slug: "reussir-son-memoire", titre: "Réussir son mémoire", acces: "gratuit", acces_etat: "ouvert", favori: true, lecture: null };

  it("le catalogue passe les filtres à la base ; null sans la 0074", async () => {
    faux.repondre("rpc.bibliotheque_catalogue", { data: { livres: [carte], categories: [], parcours: [] } });
    const catalogue = await lireCatalogue({ recherche: "mémoire", parcours: "business", categorie: null, gratuits: true });
    expect(catalogue?.livres.map((l) => l.titre)).toEqual(["Réussir son mémoire"]);
    expect(faux.de("rpc", "bibliotheque_catalogue")[0].valeurs).toEqual({ p_recherche: "mémoire", p_parcours: "business", p_categorie: null, p_gratuits: true });
    faux.repondre("rpc.bibliotheque_catalogue", { error: ABSENTE });
    expect(await lireCatalogue()).toBeNull();
  });

  it("la fiche d'un livre : la fiche, null s'il n'existe pas, « absente » sans la 0074", async () => {
    faux.repondre("rpc.livre_fiche", { data: { ...carte, taille_octets: 1_200_000, formations: [] } });
    expect(await lireFicheLivre("reussir-son-memoire")).toMatchObject({ id: L, tailleOctets: 1_200_000 });
    faux.repondre("rpc.livre_fiche", { data: null });
    expect(await lireFicheLivre("inconnu")).toBeNull();
    // Une adresse hors format n'interroge pas la base.
    faux.vider();
    expect(await lireFicheLivre("<script>")).toBeNull();
    expect(faux.appels).toHaveLength(0);
    faux.repondre("rpc.livre_fiche", { error: ABSENTE });
    expect(await lireFicheLivre("reussir-son-memoire")).toBe("absente");
  });

  it("« Continuer la lecture », les favoris et les livres d'une formation : [] sans la 0074", async () => {
    faux.repondre("rpc.mes_lectures", { data: [carte] });
    faux.repondre("rpc.mes_favoris_livres", { data: [carte] });
    faux.repondre("rpc.livres_formation", { data: [carte] });
    expect((await lireMesLectures()).map((l) => l.id)).toEqual([L]);
    expect((await lireMesFavorisLivres()).map((l) => l.id)).toEqual([L]);
    expect((await lireLivresFormation(L)).map((l) => l.id)).toEqual([L]);
    for (const nom of ["mes_lectures", "mes_favoris_livres", "livres_formation"]) faux.repondre(`rpc.${nom}`, { error: ABSENTE });
    expect(await lireMesLectures()).toEqual([]);
    expect(await lireMesFavorisLivres()).toEqual([]);
    expect(await lireLivresFormation(L)).toEqual([]);
  });
});
