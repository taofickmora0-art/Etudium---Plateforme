import { describe, expect, it, vi } from "vitest";
import type { VersionFormation } from "@/lib/editeur/types";

// La version « en ligne » de l'onglet Publication (point reporté du lot 4) : seulement celle que la base marque en
// ligne ; une formation repassée en brouillon n'en a pas.

const { lireVersions } = vi.hoisted(() => ({ lireVersions: vi.fn() }));
vi.mock("@/lib/editeur/versions", () => ({ lireVersions }));
vi.mock("next/server", () => ({ connection: async () => {} }));

const { ongletHistorique } = await import("@/components/editeur/historique-serveur");

const version = (numero: number, enLigne: boolean): VersionFormation => ({
  id: `v${numero}`,
  numero,
  creeLe: "2026-11-01T10:00:00Z",
  auteur: "Aïcha Kpadé",
  resume: "Mise en ligne",
  enLigne,
});

describe("La version en ligne de l'onglet Publication", () => {
  it("celle que la base marque en ligne", async () => {
    lireVersions.mockResolvedValue({ migrationAbsente: false, donnees: [version(3, true), version(2, false)] });
    expect((await ongletHistorique("f1")).version).toMatch(/^Version 3 · /);
  });

  it("aucune version en ligne (formation repassée en brouillon) : pas de « Version N »", async () => {
    lireVersions.mockResolvedValue({ migrationAbsente: false, donnees: [version(3, false), version(2, false)] });
    const r = await ongletHistorique("f1");
    expect(r.version).toBeNull();
    expect(r.onglet).toBeDefined();
  });
});
