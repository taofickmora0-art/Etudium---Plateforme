import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";

// Lectures de l'inscription aux formations (migration 0069 ; spec du 2 novembre 2026, §2 et §4).
const faux = fauxSupabase();
let compte: { id: string } | null = { id: "compte-1" };
let demonstration = false;
vi.mock("@/lib/auth/current-user", () => ({ demoModeActive: () => demonstration, getAuthUser: async () => compte }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));

const { lireApprenants, lireInscriptions } = await import("@/lib/inscriptions/data");

describe("Inscriptions du compte", () => {
  beforeEach(() => {
    faux.vider();
    compte = { id: "compte-1" };
    demonstration = false;
  });

  it("les siennes seulement (l'équipe des contenus lit toutes les lignes), la plus récente d'abord", async () => {
    faux.repondre("inscriptions_formations.select", {
      data: [
        { formation_id: "f2", inscrit_le: "2026-11-02T10:00:00Z" },
        { formation_id: "f1", inscrit_le: "2026-10-01T10:00:00Z" },
      ],
    });
    expect(await lireInscriptions()).toEqual([
      { formationId: "f2", inscritLe: "2026-11-02T10:00:00Z" },
      { formationId: "f1", inscritLe: "2026-10-01T10:00:00Z" },
    ]);
    const [appel] = faux.de("inscriptions_formations", "select");
    expect(appel.filtres).toContainEqual(["eq", "profil_id", "compte-1"]);
    expect(appel.filtres).toContainEqual(["order", "inscrit_le", { ascending: false }]);
  });

  it("sans la 0069 (table absente) ou en démonstration : null ; un visiteur n'en a aucune, sans requête", async () => {
    faux.repondre("inscriptions_formations.select", { error: { code: "PGRST205" } });
    expect(await lireInscriptions()).toBeNull();
    faux.repondre("inscriptions_formations.select", { error: { code: "42P01" } });
    expect(await lireInscriptions()).toBeNull();
    faux.vider();
    compte = null;
    expect(await lireInscriptions()).toEqual([]);
    expect(faux.appels).toHaveLength(0);
    demonstration = true;
    expect(await lireInscriptions()).toBeNull();
  });

  it("une autre erreur remonte", async () => {
    faux.repondre("inscriptions_formations.select", { error: { code: "XX000", message: "panne" } });
    await expect(lireInscriptions()).rejects.toThrow();
  });
});

describe("Apprenants des formations", () => {
  beforeEach(() => {
    faux.vider();
    demonstration = false;
  });

  it("le nombre d'inscrits de chaque formation publiée, par identifiant", async () => {
    faux.repondre("rpc.apprenants_formations", {
      data: [
        { formation_id: "f1", apprenants: 34 },
        { formation_id: "f2", apprenants: 0 },
      ],
    });
    expect(await lireApprenants()).toEqual({ f1: 34, f2: 0 });
  });

  it("sans la 0069 (fonction absente : PGRST202 ou 42883) ou en démonstration : null ; une autre erreur remonte", async () => {
    faux.repondre("rpc.apprenants_formations", { error: { code: "PGRST202" } });
    expect(await lireApprenants()).toBeNull();
    faux.repondre("rpc.apprenants_formations", { error: { code: "42883" } });
    expect(await lireApprenants()).toBeNull();
    faux.repondre("rpc.apprenants_formations", { error: { code: "XX000", message: "panne" } });
    await expect(lireApprenants()).rejects.toThrow();
    demonstration = true;
    expect(await lireApprenants()).toBeNull();
  });
});
