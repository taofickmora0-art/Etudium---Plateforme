import { beforeEach, describe, expect, it, vi } from "vitest";

// Les pages et les actions du back-office demandent leur domaine (lot 6 A, spec §1.2) : sans lui, la page ramène à la
// vue d'ensemble et l'action est refusée (la base refuse de son côté).

const { getShellUser, redirect } = vi.hoisted(() => ({
  getShellUser: vi.fn(),
  redirect: vi.fn((adresse: string) => {
    throw new Error(`redirection ${adresse}`);
  }),
}));
vi.mock("@/lib/auth/current-user", () => ({ getShellUser, demoModeActive: () => false }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/auth/sortie", () => ({ redirectToSortie: () => redirect("/auth/sortie") }));

const { requireDomaine } = await import("@/lib/auth/require-domaine");
const { exigerDomaine, ACCES_DOMAINE } = await import("@/lib/admin/garde");

beforeEach(() => {
  redirect.mockClear();
});

describe("Les gardes par domaine", () => {
  it("Review Focus 1 : un modérateur sur une page des paiements revient à la vue d'ensemble ; l'admin passe", async () => {
    getShellUser.mockResolvedValue({ roles: ["etudiant", "moderateur"] });
    await expect(requireDomaine("paiements")).rejects.toThrow("redirection /admin");
    getShellUser.mockResolvedValue({ roles: ["etudiant", "admin"] });
    await expect(requireDomaine("paiements")).resolves.toMatchObject({ roles: ["etudiant", "admin"] });
    getShellUser.mockResolvedValue({ roles: ["etudiant"] });
    await expect(requireDomaine("communaute")).rejects.toThrow("redirection");
  });

  it("une action hors du domaine est refusée avec un message clair", async () => {
    expect(ACCES_DOMAINE).toBe("Vous n’avez pas accès à cette partie du back-office.");
    getShellUser.mockResolvedValue({ roles: ["etudiant", "moderateur"] });
    expect(await exigerDomaine("contenus")).toEqual({ erreur: ACCES_DOMAINE });
    expect(await exigerDomaine("communaute")).toHaveProperty("supabase");
    getShellUser.mockResolvedValue(null);
    expect(await exigerDomaine("contenus")).toEqual({ erreur: "Votre session a expiré. Reconnectez-vous." });
  });
});
