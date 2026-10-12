// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HeaderActions } from "@/components/layout/HeaderActions";
import { MobileProfileMenu } from "@/components/layout/MobileProfileMenu";
import { ReservedComingSoon } from "@/components/layout/ReservedComingSoon";
import type { Role } from "@/components/ui/ProfileMenu";
import { getShellUser } from "@/lib/auth/current-user";
import { canAccess, spaceOf } from "@/lib/auth/permissions";
import { requireSpace } from "@/lib/auth/require-space";
import { DEMO_USER } from "@/lib/demo-user";

vi.mock("@/lib/auth/current-user", () => ({ getShellUser: vi.fn() }));
vi.mock("@/lib/auth/actions", () => ({ signOut: vi.fn() }));
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
    expect(canAccess("formateur", ["etudiant", "super_admin"])).toBe(true);
    expect(canAccess("admin", ["etudiant", "super_admin"])).toBe(true);
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

  it("sans compte (ou session fermée ailleurs), passage par la sortie", async () => {
    vi.mocked(getShellUser).mockResolvedValue(null);
    await expect(requireSpace("formateur")).rejects.toThrow("NEXT_REDIRECT:/auth/sortie");
  });

  it("un administrateur ouvre le back-office", async () => {
    vi.mocked(getShellUser).mockResolvedValue(compte(["etudiant", "admin"]));
    render(await ReservedComingSoon({ espace: "admin", page: "admin" }));
    expect(screen.getByRole("heading", { name: "Back-office" })).toBeInTheDocument();
    expect(screen.getByText(/Bientôt disponible/)).toBeInTheDocument();
  });
});

describe("Menus selon les rôles", () => {
  it("chacun voit ses espaces dans le menu du téléphone", () => {
    const { unmount } = render(<MobileProfileMenu user={compte(["etudiant", "super_admin"])} />);
    expect(screen.getByRole("link", { name: /Espace formateur/ })).toHaveAttribute("href", "/formateur");
    expect(screen.getByRole("link", { name: /Back-office/ })).toHaveAttribute("href", "/admin");
    unmount();
    render(<MobileProfileMenu user={compte(["etudiant", "formateur"])} />);
    expect(screen.getByRole("link", { name: /Espace formateur/ })).toBeInTheDocument();
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
