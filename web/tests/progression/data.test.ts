import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
vi.mock("@/lib/auth/current-user", () => ({ demoModeActive: () => false }));

const { lireProgression } = await import("@/lib/progression/data");

describe("Lecture de la progression du compte", () => {
  beforeEach(() => {
    faux.vider();
  });

  it("chaque ligne donne la leçon, sa formation, sa fin, sa dernière visite et la position de reprise", async () => {
    faux.repondre("progression_lecons.select", {
      data: [
        {
          lecon_id: "l1",
          terminee_le: "2026-10-12T10:00:00Z",
          vue_le: "2026-10-12T10:05:00Z",
          position_secondes: 250,
          lecons: { modules: { formation_id: "f1" } },
        },
      ],
    });
    expect(await lireProgression()).toEqual([
      { leconId: "l1", formationId: "f1", termineeLe: "2026-10-12T10:00:00Z", vueLe: "2026-10-12T10:05:00Z", positionSecondes: 250 },
    ]);
    expect(String(faux.de("progression_lecons", "select")[0].valeurs)).toContain("formation_id");
  });

  it("sans la table (migrations 0007 et 0008 pas encore appliquées), pas de progression", async () => {
    faux.repondre("progression_lecons.select", { error: { code: "PGRST205" } });
    expect(await lireProgression()).toBeNull();
  });
});
