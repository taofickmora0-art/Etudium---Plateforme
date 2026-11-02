import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Inscription } from "@/lib/inscriptions/types";
import { fauxSupabase } from "../admin/faux-supabase";
import { id, ZOTERO } from "../lecon/donnees";

// La lecture du tableau de bord (lot 6 B) : mon_tableau_de_bord pour ce qui vient de la base, les cartes du catalogue
// dans l'ordre des recommandations, et un repli sans la migration 0063. Les formations suivies tiennent compte de
// l'inscription (0069).

const faux = fauxSupabase();
// L'heure n'est lue qu'après connection() (Next 16, cacheComponents : sinon « blocking-prerender-current-time »).
vi.mock("next/server", () => ({ connection: async () => void vi.setSystemTime(new Date("2026-11-05T10:00:00Z")) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
vi.mock("@/lib/auth/current-user", () => ({ demoModeActive: () => false, getShellUser: async () => ({ prenom: "Aïcha" }) }));
vi.mock("@/lib/progression/data", () => ({ lireProgression: async () => [{ leconId: "l1", formationId: "f1", termineeLe: null, vueLe: "2026-11-01T10:00:00Z", positionSecondes: 0 }] }));
vi.mock("@/lib/sessions/data", () => ({ lireProchaineSession: async () => ({ migrationAbsente: true }) }));
const lireInscriptions = vi.fn<() => Promise<Inscription[] | null>>();
vi.mock("@/lib/inscriptions/data", () => ({ lireInscriptions: () => lireInscriptions() }));
const carte = (id: string) => ({ id, slug: `s-${id}`, titre: id, parcours: [] });
// « r1 » : Zotero, toutes leçons ouvertes (l'étudiante y est inscrite, sans l'avoir commencée).
const FICHES = [{ ...ZOTERO, id: "r1", statut: "publiee", modules: ZOTERO.modules.map((m) => ({ ...m, lecons: m.lecons.map((l) => ({ ...l, accessible: true })) })) }];
const listFiches = vi.fn(async (ids: string[]) => FICHES.filter((f) => ids.includes(f.id)));
vi.mock("@/lib/catalogue/data", () => ({
  listCatalogue: async () => ["f1", "r1", "r2", "r3", "r4"].map(carte),
  listFiches: (ids: string[]) => listFiches(ids),
}));

const { lireTableauDeBord } = await import("@/lib/tableau-de-bord/data");

beforeEach(() => {
  faux.vider();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-01T08:00:00Z"));
  lireInscriptions.mockReset();
  lireInscriptions.mockResolvedValue(null);
  listFiches.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
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

  it("l'heure du tableau de bord est lue à la requête, après connection(), jamais au prérendu", async () => {
    faux.repondre("rpc.mon_tableau_de_bord", { data: {} });
    expect((await lireTableauDeBord()).maintenant).toBe("2026-11-05T10:00:00.000Z");
  });

  it("le message de suite seulement avec la carte qu'il annonce ; « rien de publié » distinct de « tout commencé »", async () => {
    faux.repondre("rpc.mon_tableau_de_bord", {
      data: { recommandations: [{ id: "absente", slug: "s-x", titre: "x", motif: "suite", message: "Vous avez terminé « Word ». Découvrez maintenant « x »." }] },
    });
    const d = await lireTableauDeBord();
    expect(d.recommandees).toEqual([]);
    expect(d.messageSuite).toBeNull();
    expect(d.aucunePubliee).toBe(false);
  });

  it("sans la 0063 : pas de base, et les premières formations pas encore commencées", async () => {
    faux.repondre("rpc.mon_tableau_de_bord", { error: { code: "PGRST202" } });
    const d = await lireTableauDeBord();
    expect(d.base).toBeNull();
    expect(d.recommandees.map((c) => c.id)).toEqual(["r1", "r2", "r3"]);
  });

  it("inscrite à 0 % : sa formation est dans « Continuer l'apprentissage », et sort des recommandations de repli", async () => {
    faux.repondre("rpc.mon_tableau_de_bord", { error: { code: "PGRST202" } });
    lireInscriptions.mockResolvedValue([{ formationId: "r1", inscritLe: "2026-10-31T10:00:00Z" }]);
    const d = await lireTableauDeBord();
    expect(listFiches).toHaveBeenCalledWith(["r1"]);
    expect(d.continuer).toMatchObject({ titre: "Zotero : gérer ses références", pourcentage: 0, href: `/formations/zotero-gerer-ses-references/lecons/${id(21)}` });
    expect(d.indicateurs.enCours).toBe(1);
    expect(d.recommandees.map((c) => c.id)).toEqual(["r2", "r3", "r4"]);
  });

  it("les recommandations de la base, sans les formations où l'on est inscrit", async () => {
    faux.repondre("rpc.mon_tableau_de_bord", {
      data: { recommandations: [{ id: "r1", slug: "s-r1", titre: "r1", motif: "catalogue", message: null }, { id: "r3", slug: "s-r3", titre: "r3", motif: "catalogue", message: null }] },
    });
    lireInscriptions.mockResolvedValue([{ formationId: "r1", inscritLe: "2026-10-31T10:00:00Z" }]);
    expect((await lireTableauDeBord()).recommandees.map((c) => c.id)).toEqual(["r3"]);
  });

  it("sans la 0069 (null) : comme avant, les formations commencées seulement", async () => {
    faux.repondre("rpc.mon_tableau_de_bord", { error: { code: "PGRST202" } });
    const d = await lireTableauDeBord();
    expect(listFiches).toHaveBeenCalledWith(["f1"]);
    expect(d.continuer).toBeNull();
    expect(d.recommandees.map((c) => c.id)).toEqual(["r1", "r2", "r3"]);
  });

  it("une autre erreur remonte à la page d'erreur", async () => {
    faux.repondre("rpc.mon_tableau_de_bord", { error: { code: "500", message: "panne" } });
    await expect(lireTableauDeBord()).rejects.toThrow("Lecture du tableau de bord impossible (500).");
  });
});
