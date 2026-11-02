import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Inscription } from "@/lib/inscriptions/types";
import type { LigneProgression } from "@/lib/progression/types";
import { CARTES_DESIGN, PARCOURS_DESIGN } from "../catalogue/cartes-design";
import { id, ZOTERO } from "../lecon/donnees";

// Les données de la page Recherche : la progression des formations trouvées suit « Mes formations » (les inscrites,
// même à 0 % ; sans la 0069, les commencées) ; les recommandations écartent les formations commencées ou inscrites.

const lireProgression = vi.fn<() => Promise<LigneProgression[] | null>>();
const lireInscriptions = vi.fn<() => Promise<Inscription[] | null>>();
const ZOTERO_OUVERTE = { ...ZOTERO, statut: "publiee", modules: ZOTERO.modules.map((m) => ({ ...m, lecons: m.lecons.map((l) => ({ ...l, accessible: true })) })) };
const listFiches = vi.fn(async (ids: string[]) => [ZOTERO_OUVERTE].filter((f) => ids.includes(f.id)));
vi.mock("@/lib/progression/data", () => ({ lireProgression: () => lireProgression() }));
vi.mock("@/lib/inscriptions/data", () => ({ lireInscriptions: () => lireInscriptions() }));
vi.mock("@/lib/recherche/data", () => ({ listLeconsPubliees: async () => [] }));
vi.mock("@/lib/catalogue/data", () => ({
  listCatalogue: async () => CARTES_DESIGN,
  listParcoursCatalogue: async () => PARCOURS_DESIGN.map((p) => ({ ...p, description: "" })),
  listFiches: (ids: string[]) => listFiches(ids),
}));

const { lireRecherche } = await import("@/lib/recherche/donnees");

describe("Les données de la recherche", () => {
  beforeEach(() => {
    lireProgression.mockResolvedValue([]);
    lireInscriptions.mockReset();
    listFiches.mockClear();
  });

  it("inscrite à 0 % : la formation trouvée montre sa progression, et n'est plus recommandée", async () => {
    lireInscriptions.mockResolvedValue([{ formationId: ZOTERO.id, inscritLe: "2026-10-31T10:00:00Z" }]);
    const d = await lireRecherche("zotero");
    expect(d.resultats?.formations.map((c) => c.id)).toEqual([ZOTERO.id]);
    expect(d.suivies.get(ZOTERO.id)).toMatchObject({ pourcentage: 0, etat: "enCours", href: `/formations/zotero-gerer-ses-references/lecons/${id(21)}` });
    const sans = await lireRecherche("introuvable");
    expect(sans.recommandees.map((c) => c.id)).not.toContain(ZOTERO.id);
  });

  it("sans la 0069 (null) : comme avant, seules les formations commencées montrent leur progression", async () => {
    lireInscriptions.mockResolvedValue(null);
    const d = await lireRecherche("zotero");
    expect(d.suivies.size).toBe(0);
    lireProgression.mockResolvedValue([{ leconId: id(21), formationId: ZOTERO.id, termineeLe: null, vueLe: "2026-10-31T10:00:00Z", positionSecondes: 0 }]);
    expect((await lireRecherche("zotero")).suivies.get(ZOTERO.id)).toMatchObject({ pourcentage: 0, etat: "enCours" });
  });
});
