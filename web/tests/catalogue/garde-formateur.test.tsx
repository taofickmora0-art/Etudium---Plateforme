// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/auth/permissions";
import { DEMO_USER } from "@/lib/demo-user";

// Restructuration R1 : un formateur ne lit que ses formations. Le catalogue le mène à son tableau de bord, la fiche
// d'une formation à son éditeur (la sienne) ou à son tableau de bord ; sur sa propre leçon, c'est un aperçu.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));
const editeurFormation = vi.fn<(id: string) => Promise<string | null>>();
vi.mock("@/lib/catalogue/apercu", () => ({ editeurFormation: (id: string) => editeurFormation(id) }));

const { apercuFormateur, renvoyerFormateur } = await import("@/lib/catalogue/garde-formateur");
const { BandeauApercu } = await import("@/components/lecon/BandeauApercu");

const compte = (roles: Role[]) => ({ ...DEMO_USER, roles });
// Un formateur sans « Étudiant » (0079) : il n'a pas l'espace étudiant.
const FORMATEUR = compte(["formateur"]);
const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");

beforeEach(() => editeurFormation.mockReset());

describe("Le formateur sur le catalogue", () => {
  it("le catalogue mène un formateur à son tableau de bord ; les autres restent", async () => {
    await expect(renvoyerFormateur(FORMATEUR)).rejects.toThrow("NEXT_REDIRECT:/formateur");
    await expect(renvoyerFormateur(compte(["etudiant"]))).resolves.toBeUndefined();
    await expect(renvoyerFormateur(compte(["etudiant", "admin"]))).resolves.toBeUndefined();
    await expect(renvoyerFormateur(null)).resolves.toBeUndefined();
  });

  it("la fiche : l'éditeur de sa formation, sinon son tableau de bord", async () => {
    editeurFormation.mockResolvedValueOnce("/formateur/formations/f1");
    await expect(renvoyerFormateur(FORMATEUR, "f1")).rejects.toThrow("NEXT_REDIRECT:/formateur/formations/f1");
    editeurFormation.mockResolvedValueOnce(null);
    await expect(renvoyerFormateur(FORMATEUR, "f2")).rejects.toThrow("NEXT_REDIRECT:/formateur");
  });

  it("la leçon : un aperçu sur la sienne, le tableau de bord sur celle d'un autre", () => {
    expect(apercuFormateur(FORMATEUR, "/formateur/formations/f1/lecons/l1")).toBe(true);
    expect(() => apercuFormateur(FORMATEUR, null)).toThrow("NEXT_REDIRECT:/formateur");
    expect(apercuFormateur(compte(["etudiant"]), null)).toBe(false);
    expect(apercuFormateur(compte(["etudiant", "admin"]), "/admin/formations/f1/lecons/l1")).toBe(false);
    expect(apercuFormateur(null, null)).toBe(false);
  });

  it("le bandeau de l'aperçu du formateur", () => {
    render(<BandeauApercu apercu="formateur" />);
    expect(screen.getByRole("status")).toHaveTextContent("Aperçu de votre leçon, telle que la voit un étudiant : votre progression n’est pas enregistrée.");
  });

  it("le catalogue, la fiche, la validation et la leçon appliquent la règle", () => {
    expect(lire("src/app/(catalogue)/formations/page.tsx")).toContain("renvoyerFormateur(compte)");
    expect(lire("src/app/(catalogue)/formations/[slug]/page.tsx")).toContain("renvoyerFormateur(compte, fiche.id)");
    expect(lire("src/app/(catalogue)/formations/[slug]/validation/page.tsx")).toContain("renvoyerFormateur(");
    expect(lire("src/app/(lecon)/formations/[slug]/lecons/[leconId]/page.tsx")).toContain("apercuFormateur(compte, lienModifier)");
  });
});
