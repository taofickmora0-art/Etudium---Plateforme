import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";
import { id } from "../lecon/donnees";

const faux = fauxSupabase();
let compte: { id: string } | null = { id: "compte-1" };
const refresh = vi.fn();
vi.mock("next/cache", () => ({ refresh: () => refresh() }));
vi.mock("@/lib/auth/current-user", () => ({ demoModeActive: () => false }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ ...faux.client, auth: { getUser: async () => ({ data: { user: compte }, error: null }) } }),
}));

const { lireFavoris } = await import("@/lib/favoris/data");
const { ajouterFavori, retirerFavori } = await import("@/lib/favoris/actions");
const { listFiches } = await import("@/lib/catalogue/data");
const { listLeconsPubliees } = await import("@/lib/recherche/data");

describe("Favoris : lecture et actions", () => {
  beforeEach(() => {
    faux.vider();
    compte = { id: "compte-1" };
    refresh.mockReset();
  });

  it("les favoris du compte, le plus récent d'abord ; table absente → null", async () => {
    faux.repondre("favoris.select", { data: [{ formation_id: "f2", ajoute_le: "2026-10-13T10:00:00Z" }] });
    expect(await lireFavoris()).toEqual([{ formationId: "f2", ajouteLe: "2026-10-13T10:00:00Z" }]);
    expect(faux.de("favoris", "select")[0].filtres).toContainEqual(["order", "ajoute_le", { ascending: false }]);
    faux.repondre("favoris.select", { error: { code: "PGRST205" } });
    expect(await lireFavoris()).toBeNull();
  });

  it("ajouter : un seul favori même en cas de double clic, puis la page est relue", async () => {
    expect(await ajouterFavori(id(1))).toEqual({ ok: true });
    const [appel] = faux.de("favoris", "upsert");
    expect(appel.valeurs).toEqual({ profil_id: "compte-1", formation_id: id(1) });
    expect(appel.options).toEqual({ onConflict: "profil_id,formation_id", ignoreDuplicates: true });
    expect(refresh).toHaveBeenCalled();
  });

  it("retirer ; refus sans compte, avec un identifiant mal formé ou une erreur de la base", async () => {
    expect(await retirerFavori(id(1))).toEqual({ ok: true });
    expect(faux.de("favoris", "delete")[0].filtres).toEqual(expect.arrayContaining([["eq", "formation_id", id(1)], ["eq", "profil_id", "compte-1"]]));
    expect(await ajouterFavori("abc")).toEqual({ ok: false, erreur: "Le favori n’a pas pu être enregistré. Réessayez." });
    faux.repondre("favoris.delete", { error: { code: "42501" } });
    expect(await retirerFavori(id(1))).toEqual({ ok: false, erreur: "Le favori n’a pas pu être retiré. Réessayez." });
    compte = null;
    expect(await ajouterFavori(id(1))).toEqual({ ok: false, erreur: "Connectez-vous pour ajouter un favori." });
  });
});

describe("Lectures pour Mes formations et la recherche", () => {
  beforeEach(() => {
    faux.vider();
  });

  it("listFiches lit plusieurs formations, quel que soit leur statut (les règles de la base décident)", async () => {
    expect(await listFiches([])).toEqual([]);
    expect(faux.appels).toEqual([]);
    faux.repondre("formations.select", {
      data: [{ id: "f1", slug: "excel", titre: "Excel", statut: "archivee", formations_parcours: [], modules: [{ id: "m1", titre: "Bases", ordre: 1, lecons: [{ id: "l1", titre: "A", duree_secondes: 60, ordre: 1, accessible: false }] }] }],
    });
    const [fiche] = await listFiches(["f1"]);
    expect(fiche).toMatchObject({ id: "f1", slug: "excel", statut: "archivee", nbLecons: 1 });
    expect(fiche.modules[0].lecons[0]).toMatchObject({ id: "l1", accessible: false });
    const [appel] = faux.de("formations", "select");
    expect(appel.filtres).toContainEqual(["in", "id", ["f1"]]);
    expect(appel.filtres.some((f) => f[0] === "eq" && f[1] === "statut")).toBe(false);
  });

  it("les leçons des formations publiées, avec leur formation et le numéro de leur module", async () => {
    faux.repondre("lecons.select", {
      data: [
        {
          id: "l1",
          titre: "Découvrir l’interface",
          duree_secondes: 370,
          accessible: true,
          module_id: "m2",
          modules: { id: "m2", titre: "Bases d’Excel", formations: { slug: "excel", titre: "Maîtriser Microsoft Excel", modules: [{ id: "m2", ordre: 5 }, { id: "m9", ordre: 2 }] } },
        },
      ],
    });
    expect(await listLeconsPubliees()).toEqual([
      { id: "l1", titre: "Découvrir l’interface", dureeSecondes: 370, accessible: true, formation: { slug: "excel", titre: "Maîtriser Microsoft Excel" }, module: { numero: 2, titre: "Bases d’Excel" } },
    ]);
    expect(faux.de("lecons", "select")[0].filtres).toContainEqual(["eq", "modules.formations.statut", "publiee"]);
  });
});
