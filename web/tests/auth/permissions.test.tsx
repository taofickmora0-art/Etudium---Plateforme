// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HeaderActions } from "@/components/layout/HeaderActions";
import { MobileProfileMenu } from "@/components/layout/MobileProfileMenu";
import type { Role } from "@/lib/auth/permissions";
import { getShellUser } from "@/lib/auth/current-user";
import { canAccess, spaceOf } from "@/lib/auth/permissions";
import { requireSpace } from "@/lib/auth/require-space";
import { DEMO_USER } from "@/lib/demo-user";

vi.mock("@/lib/auth/current-user", () => ({ getShellUser: vi.fn() }));
vi.mock("@/lib/auth/actions", () => ({ signOut: vi.fn() }));
// La cloche se charge par une action du serveur (migration 0016) : sans base ici, elle reste vide.
vi.mock("@/lib/notifications/actions", () => ({ chargerCloche: async () => null, marquerLues: async () => ({ ok: true }) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-etudium-chemin": "/admin" }) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
  usePathname: () => "/admin",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const compte = (roles: Role[]) => ({ ...DEMO_USER, roles });

describe("Règles d'accès", () => {
  it("chaque rôle ouvre ses espaces", () => {
    expect(canAccess("formateur", ["etudiant"])).toBe(false);
    expect(canAccess("admin", ["etudiant"])).toBe(false);
    expect(canAccess("etudiant", ["etudiant"])).toBe(true);
    expect(canAccess("formateur", ["etudiant", "formateur"])).toBe(true);
    expect(canAccess("admin", ["etudiant", "formateur"])).toBe(false);
    expect(canAccess("admin", ["etudiant", "moderateur"])).toBe(true);
    // Deux espaces au plus (migration 0017) : l'équipe, super admin compris, n'a pas l'espace formateur.
    expect(canAccess("formateur", ["etudiant", "super_admin"])).toBe(false);
    expect(canAccess("formateur", ["etudiant", "admin"])).toBe(false);
    expect(canAccess("admin", ["etudiant", "super_admin"])).toBe(true);
  });

  it("« Étudiant » ouvre l'espace étudiant, même à un formateur ; un formateur sans « Étudiant » ne l'a pas (0079)", () => {
    expect(canAccess("etudiant", ["etudiant", "formateur"])).toBe(true);
    expect(canAccess("etudiant", ["formateur"])).toBe(false);
    expect(canAccess("etudiant", ["formateur", "admin"])).toBe(false);
    expect(canAccess("etudiant", ["etudiant", "admin"])).toBe(true);
    expect(canAccess("etudiant", ["etudiant", "super_admin"])).toBe(true);
    // Formateur et équipe : les deux espaces.
    expect(canAccess("formateur", ["formateur", "admin"])).toBe(true);
    expect(canAccess("admin", ["formateur", "admin"])).toBe(true);
  });

  it("l'espace se lit dans l'adresse", () => {
    expect(spaceOf("/admin")).toBe("admin");
    expect(spaceOf("/admin/utilisateurs")).toBe("admin");
    expect(spaceOf("/formateur")).toBe("formateur");
    expect(spaceOf("/administration")).toBe("etudiant");
    expect(spaceOf(null)).toBe("etudiant");
  });
});

describe("Pages réservées", () => {
  beforeEach(() => {
    vi.mocked(getShellUser).mockReset();
  });

  it("un étudiant qui tape /admin retourne à l'accueil", async () => {
    vi.mocked(getShellUser).mockResolvedValue(compte(["etudiant"]));
    await expect(requireSpace("admin")).rejects.toThrow("NEXT_REDIRECT:/accueil");
  });

  it("un formateur qui tape /admin retourne à son tableau de bord ; formateur et étudiant, à l'Accueil", async () => {
    vi.mocked(getShellUser).mockResolvedValue(compte(["formateur"]));
    await expect(requireSpace("admin")).rejects.toThrow("NEXT_REDIRECT:/formateur");
    vi.mocked(getShellUser).mockResolvedValue(compte(["etudiant", "formateur"]));
    await expect(requireSpace("admin")).rejects.toThrow("NEXT_REDIRECT:/accueil");
  });

  it("sans compte (ou session fermée ailleurs), passage par la sortie", async () => {
    vi.mocked(getShellUser).mockResolvedValue(null);
    await expect(requireSpace("formateur")).rejects.toThrow("NEXT_REDIRECT:/auth/sortie?next=%2Fadmin");
  });

  it("un administrateur ouvre le back-office", async () => {
    const admin = compte(["etudiant", "admin"]);
    vi.mocked(getShellUser).mockResolvedValue(admin);
    await expect(requireSpace("admin")).resolves.toEqual(admin);
  });
});

describe("Menus selon les rôles", () => {
  it("chacun voit ses espaces dans le menu du téléphone", () => {
    const { unmount } = render(<MobileProfileMenu user={compte(["etudiant", "super_admin"])} />);
    expect(screen.queryByRole("link", { name: /Espace formateur/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Espace étudiant/ })).toHaveAttribute("href", "/accueil");
    expect(screen.getByRole("link", { name: /Back-office/ })).toHaveAttribute("href", "/admin");
    unmount();
    // Un formateur sans « Étudiant » (R1, 0079) : un seul espace, son menu du téléphone ne propose aucun changement.
    render(<MobileProfileMenu user={compte(["formateur"])} espace="formateur" />);
    expect(screen.queryByRole("link", { name: /Espace formateur/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Back-office/ })).not.toBeInTheDocument();
  });

  it("l'espace où l'on se trouve est coché", async () => {
    const user = userEvent.setup();
    render(<HeaderActions user={compte(["etudiant", "admin"])} />);
    await user.click(screen.getByRole("button", { name: "Mon profil" }));
    expect(screen.getByRole("menuitem", { name: /Back-office/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("menuitem", { name: /Espace étudiant/ })).not.toHaveAttribute("aria-current");
  });
});
