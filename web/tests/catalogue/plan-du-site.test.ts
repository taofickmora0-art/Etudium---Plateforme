import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";

const faux = fauxSupabase();
const demo = vi.hoisted(() => ({ active: false }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
vi.mock("@/lib/auth/current-user", () => ({ demoModeActive: () => demo.active }));

const { listFormationsDuPlan, listLivresDuPlan } = await import("@/lib/catalogue/plan-du-site");

describe("Les formations du plan du site", () => {
  beforeEach(() => {
    faux.vider();
    demo.active = false;
  });

  it("lit les formations publiées seulement : adresse, dates et formateur", async () => {
    faux.repondre("formations.select", {
      data: [
        { slug: "maitriser-excel", publiee_le: "2026-09-01T08:00:00Z", modifie_le: "2026-10-20T10:00:00Z", formateur_id: "f1" },
        { slug: "python-debutant", publiee_le: null, modifie_le: null, formateur_id: null },
      ],
    });
    expect(await listFormationsDuPlan()).toEqual([
      { slug: "maitriser-excel", publieeLe: "2026-09-01T08:00:00Z", modifieLe: "2026-10-20T10:00:00Z", formateurId: "f1" },
      { slug: "python-debutant", publieeLe: null, modifieLe: null, formateurId: null },
    ]);
    const [appel] = faux.de("formations", "select");
    expect(appel.valeurs).toBe("slug, publiee_le, modifie_le, formateur_id");
    expect(appel.filtres).toContainEqual(["eq", "statut", "publiee"]);
  });

  it("en démonstration, sans base : aucune formation, sans interroger la base", async () => {
    demo.active = true;
    expect(await listFormationsDuPlan()).toEqual([]);
    expect(faux.appels).toHaveLength(0);
  });

  it("une erreur de lecture est levée (le plan du site se replie sur ses pages fixes)", async () => {
    faux.repondre("formations.select", { error: { code: "500", message: "Base injoignable" } });
    await expect(listFormationsDuPlan()).rejects.toThrow();
  });
});

describe("Les livres du plan du site", () => {
  beforeEach(() => {
    faux.vider();
    demo.active = false;
  });

  it("lit les livres publiés comme un visiteur (le catalogue de la Bibliothèque) : adresse et date de publication", async () => {
    faux.repondre("rpc.bibliotheque_catalogue", {
      data: { livres: [{ id: "l1", slug: "reussir-son-memoire", publie_le: "2026-11-02T08:00:00Z" }, { id: "l2", slug: "guide-excel" }], categories: [], parcours: [] },
    });
    expect(await listLivresDuPlan()).toEqual([
      { slug: "reussir-son-memoire", publieLe: "2026-11-02T08:00:00Z" },
      { slug: "guide-excel", publieLe: null },
    ]);
  });

  it("sans la 0074, ou en démonstration : aucun livre", async () => {
    faux.repondre("rpc.bibliotheque_catalogue", { error: { code: "PGRST202", message: "Could not find the function" } });
    expect(await listLivresDuPlan()).toEqual([]);
    demo.active = true;
    faux.vider();
    expect(await listLivresDuPlan()).toEqual([]);
    expect(faux.appels).toHaveLength(0);
  });

  it("une autre erreur est levée (le plan garde alors ses formations)", async () => {
    faux.repondre("rpc.bibliotheque_catalogue", { error: { code: "500", message: "Base injoignable" } });
    await expect(listLivresDuPlan()).rejects.toThrow();
  });
});
