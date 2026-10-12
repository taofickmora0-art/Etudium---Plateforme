import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { isValidElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ComingSoon } from "@/components/layout/ComingSoon";
import { SessionGuard } from "@/components/layout/SessionGuard";
import { getShellUser } from "@/lib/auth/current-user";
import { DEMO_USER } from "@/lib/demo-user";

vi.mock("@/lib/auth/current-user", () => ({ getShellUser: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

// Une mise en page n'est pas réexécutée à chaque navigation : chaque page vérifie elle-même la session.
const pages = (dossier: string): string[] =>
  readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? pages(chemin) : nom === "page.tsx" ? [chemin] : [];
  });

const contient = (noeud: ReactNode, type: unknown): boolean => {
  if (Array.isArray(noeud)) return noeud.some((n) => contient(n, type));
  if (!isValidElement(noeud)) return false;
  if (noeud.type === type) return true;
  return contient((noeud.props as { children?: ReactNode }).children, type);
};

describe("Session vérifiée à chaque page", () => {
  beforeEach(() => {
    vi.mocked(getShellUser).mockReset();
  });

  it("une session fermée ailleurs passe par la sortie", async () => {
    vi.mocked(getShellUser).mockResolvedValue(null);
    await expect(SessionGuard()).rejects.toThrow("NEXT_REDIRECT:/auth/sortie");
  });

  it("une session valable ne change rien", async () => {
    vi.mocked(getShellUser).mockResolvedValue(DEMO_USER);
    await expect(SessionGuard()).resolves.toBeNull();
  });

  it("les pages « Bientôt disponible » vérifient la session", () => {
    expect(contient(ComingSoon({ page: "evenements" }), SessionGuard)).toBe(true);
  });

  it("chaque page de l'espace connecté vérifie la session", () => {
    const sansVerification = pages(join(process.cwd(), "src/app/(app)")).filter((p) => {
      const code = readFileSync(p, "utf8");
      return !["<SessionGuard", "<ComingSoon", "<ReservedComingSoon", 'redirect("/auth/sortie")'].some((m) => code.includes(m));
    });
    expect(sansVerification).toEqual([]);
  });
});
