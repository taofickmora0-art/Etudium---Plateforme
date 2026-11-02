import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";

// La lecture du tableau de bord (lot 6 B) : mon_tableau_de_bord pour ce qui vient de la base, les cartes du catalogue
// dans l'ordre des recommandations, et un repli sans la migration 0063.

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
vi.mock("@/lib/auth/current-user", () => ({ demoModeActive: () => false, getShellUser: async () => ({ prenom: "Aïcha" }) }));
vi.mock("@/lib/progression/data", () => ({ lireProgression: async () => [{ leconId: "l1", formationId: "f1", termineeLe: null, vueLe: "2026-11-01T10:00:00Z", positionSecondes: 0 }] }));
vi.mock("@/lib/sessions/data", () => ({ lireProchaineSession: async () => ({ migrationAbsente: true }) }));
const carte = (id: string) => ({ id, slug: `s-${id}`, titre: id, parcours: [] });
vi.mock("@/lib/catalogue/data", () => ({
  listCatalogue: async () => ["f1", "r1", "r2", "r3", "r4"].map(carte),
  listFiches: async () => [],
}));

const { lireTableauDeBord } = await import("@/lib/tableau-de-bord/data");

beforeEach(() => {
  faux.vider();
});

describe("La lecture du tableau de bord", () => {
  it("les recommandations de la base, dans son ordre, avec le message de suite", async () => {
    faux.repondre("rpc.mon_tableau_de_bord", {
      data: {
        certificats: { nombre: 1, titres: ["Word"] },
        recommandations: [
          { id: "r3", slug: "s-r3", titre: "r3", motif: "suite", message: "Vous avez terminé « Word ». Découvrez maintenant « r3 »." },
          { id: "r1", slug: "s-r1", titre: "r1", motif: "catalogue", message: null },
        ],
      },
    });
    const d = await lireTableauDeBord();
    expect(d.prenom).toBe("Aïcha");
    expect(d.recommandees.map((c) => c.id)).toEqual(["r3", "r1"]);
    expect(d.messageSuite).toBe("Vous avez terminé « Word ». Découvrez maintenant « r3 ».");
    expect(d.base?.certificats).toEqual({ nombre: 1, titres: ["Word"] });
    expect(d.session).toBeUndefined();
  });

  it("sans la 0063 : pas de base, et les premières formations pas encore commencées", async () => {
    faux.repondre("rpc.mon_tableau_de_bord", { error: { code: "PGRST202" } });
    const d = await lireTableauDeBord();
    expect(d.base).toBeNull();
    expect(d.recommandees.map((c) => c.id)).toEqual(["r1", "r2", "r3"]);
  });

  it("une autre erreur remonte à la page d'erreur", async () => {
    faux.repondre("rpc.mon_tableau_de_bord", { error: { code: "500", message: "panne" } });
    await expect(lireTableauDeBord()).rejects.toThrow("Lecture du tableau de bord impossible (500).");
  });
});
