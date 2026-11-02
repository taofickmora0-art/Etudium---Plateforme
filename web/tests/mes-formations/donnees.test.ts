import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Inscription } from "@/lib/inscriptions/types";
import type { LigneProgression } from "@/lib/progression/types";
import { EXCEL_OUVERTE, id, ZOTERO } from "../lecon/donnees";

// Ce que « Mes formations », sa rangée et les cartes du catalogue lisent du compte (spec du 2 novembre 2026, §2 et §4).
const lireProgression = vi.fn<() => Promise<LigneProgression[] | null>>();
const lireFavoris = vi.fn<() => Promise<{ formationId: string; ajouteLe: string }[] | null>>();
const lireInscriptions = vi.fn<() => Promise<Inscription[] | null>>();
const listFiches = vi.fn();
vi.mock("@/lib/progression/data", () => ({ lireProgression: () => lireProgression() }));
vi.mock("@/lib/favoris/data", () => ({ lireFavoris: () => lireFavoris() }));
vi.mock("@/lib/inscriptions/data", () => ({ lireInscriptions: () => lireInscriptions() }));
vi.mock("@/lib/catalogue/data", () => ({ listFiches: (ids: string[]) => listFiches(ids) }));

const { lireFormationsSuivies, lireSuiviDuCompte } = await import("@/lib/mes-formations/data");

const ZOTERO_OUVERTE = { ...ZOTERO, modules: ZOTERO.modules.map((m) => ({ ...m, lecons: m.lecons.map((l) => ({ ...l, accessible: true })) })) };
const FICHES = [
  { ...EXCEL_OUVERTE, statut: "publiee" },
  { ...ZOTERO_OUVERTE, statut: "publiee" },
];
const ligne = (formationId: string, n: number, terminee: boolean): LigneProgression => ({
  leconId: id(n),
  formationId,
  termineeLe: terminee ? "2026-10-12T10:00:00Z" : null,
  vueLe: "2026-10-12T10:00:00Z",
  positionSecondes: 0,
});

describe("Suivi du compte", () => {
  beforeEach(() => {
    lireProgression.mockReset();
    lireFavoris.mockReset();
    lireInscriptions.mockReset();
    listFiches.mockReset();
    listFiches.mockImplementation(async (ids: string[]) => FICHES.filter((f) => ids.includes(f.id)));
    lireFavoris.mockResolvedValue([{ formationId: ZOTERO.id, ajouteLe: "2026-10-13T10:00:00Z" }]);
  });

  it("une formation inscrite non commencée est « à moi » (0 %) ; les cartes savent où le compte est inscrit, et ses favoris", async () => {
    lireProgression.mockResolvedValue([ligne(EXCEL_OUVERTE.id, 1, true)]);
    lireInscriptions.mockResolvedValue([
      { formationId: ZOTERO.id, inscritLe: "2026-10-14T10:00:00Z" },
      { formationId: EXCEL_OUVERTE.id, inscritLe: "2026-10-01T10:00:00Z" },
    ]);
    const suivi = await lireSuiviDuCompte();
    expect(listFiches).toHaveBeenCalledTimes(1);
    expect([...listFiches.mock.calls[0][0]].sort()).toEqual([EXCEL_OUVERTE.id, ZOTERO.id].sort());
    expect(suivi.suivies.map((v) => [v.titre, v.pourcentage, v.etat])).toEqual([
      ["Zotero : gérer ses références", 0, "enCours"],
      ["Maîtriser Microsoft Excel", 8, "enCours"],
    ]);
    expect(suivi.inscrites).toEqual({ [ZOTERO.id]: 0, [EXCEL_OUVERTE.id]: 8 });
    expect(suivi.favoris).toEqual([ZOTERO.id]);
    expect(await lireFormationsSuivies()).toEqual(suivi.suivies);
  });

  it("commencée sans inscription (un aperçu ouvert) : dans « Mes formations », mais pas inscrite sur la carte", async () => {
    lireProgression.mockResolvedValue([ligne(EXCEL_OUVERTE.id, 1, false)]);
    lireInscriptions.mockResolvedValue([]);
    const suivi = await lireSuiviDuCompte();
    expect(suivi.suivies.map((v) => v.id)).toEqual([EXCEL_OUVERTE.id]);
    expect(suivi.inscrites).toEqual({});
  });

  it("sans la 0069 : comme avant, les formations commencées seulement, qui comptent comme inscrites sur la carte", async () => {
    lireProgression.mockResolvedValue([ligne(EXCEL_OUVERTE.id, 1, true)]);
    lireInscriptions.mockResolvedValue(null);
    const suivi = await lireSuiviDuCompte();
    expect(suivi.suivies.map((v) => v.id)).toEqual([EXCEL_OUVERTE.id]);
    expect(suivi.inscrites).toEqual({ [EXCEL_OUVERTE.id]: 8 });
  });

  it("rien de commencé ni d'inscrit : aucune lecture des fiches ; sans la table des favoris, pas de cœur (null)", async () => {
    lireProgression.mockResolvedValue(null);
    lireInscriptions.mockResolvedValue([]);
    lireFavoris.mockResolvedValue(null);
    expect(await lireSuiviDuCompte()).toEqual({ suivies: [], inscrites: {}, favoris: null });
    expect(listFiches).not.toHaveBeenCalled();
  });
});
