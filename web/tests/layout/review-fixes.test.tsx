// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/layout/AppShell";
import { MobileProfileMenu } from "@/components/layout/MobileProfileMenu";
import { BottomNavLinks } from "@/components/layout/MobileNav";
import { SidebarNavLinks } from "@/components/layout/SidebarNav";
import { DEMO_USER } from "@/lib/demo-user";
import { LIENS_ENTETE_TELEPHONE, NAV_BAS, NAV_MENU_TELEPHONE, NAV_MON_ESPACE, NAV_PRINCIPALE } from "@/lib/navigation";

vi.mock("next/navigation", () => ({ usePathname: () => "/accueil", useRouter: () => ({ push: vi.fn() }) }));

describe("Corrections de la relecture de la coque", () => {
  it("sur téléphone, c'est la page qui défile : en-tête et barre du bas restent collés", () => {
    render(<AppShell>Contenu</AppShell>);
    expect(screen.getByRole("main")).not.toHaveClass("overflow-y-auto");
    expect(screen.getByRole("banner")).toHaveClass("max-lg:sticky", "max-lg:top-0");
    expect(screen.getByRole("navigation", { name: "Navigation" }).parentElement).toHaveClass("sticky", "bottom-0");
  });

  it("les menus s'affichent avant de connaître l'adresse (rendu préalable) : la coque de l'espace les connaît", () => {
    render(
      <>
        <SidebarNavLinks pathname={null} espace="etudiant" />
        <BottomNavLinks pathname={null} espace="etudiant" />
      </>,
    );
    expect(screen.getByRole("navigation", { name: "Navigation principale" })).toBeInTheDocument();
    expect(screen.getAllByRole("link").filter((a) => a.hasAttribute("aria-current"))).toHaveLength(0);
  });

  it("sur téléphone, toutes les entrées de la barre latérale restent accessibles : le menu ≡ les reprend toutes", () => {
    // Le menu ≡ affiche la barre latérale de l'espace (SidebarNavLinks) ; la page Profil n'a plus que le compte (31 octobre).
    expect(readFileSync(join(process.cwd(), "src/components/layout/MenuTiroir.tsx"), "utf8")).toContain("<SidebarNavLinks");
    expect(NAV_MENU_TELEPHONE.map((e) => e.href)).toEqual(["/profil", "/abonnement"]);
    const telephone = new Set([...NAV_BAS, ...NAV_PRINCIPALE, ...NAV_MON_ESPACE, ...LIENS_ENTETE_TELEPHONE].map((e) => e.href));
    expect(telephone.has("/recherche")).toBe(true);
  });

  it("la page Profil du téléphone propose les espaces selon les rôles", () => {
    const { unmount } = render(<MobileProfileMenu user={{ ...DEMO_USER, roles: ["etudiant"] }} />);
    expect(screen.queryByRole("link", { name: "Espace étudiant" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Back-office" })).not.toBeInTheDocument();
    unmount();
    // Un seul rôle en plus d'étudiant (0017) ; le formateur n'a pas l'espace étudiant (R1) : seule l'équipe change d'espace.
    render(<MobileProfileMenu user={{ ...DEMO_USER, roles: ["etudiant", "admin"] }} />);
    expect(screen.getByRole("link", { name: "Espace étudiant" })).toHaveAttribute("href", "/accueil");
    expect(screen.getByRole("link", { name: "Back-office" })).toHaveAttribute("href", "/admin");
    expect(screen.queryByRole("link", { name: "Espace formateur" })).not.toBeInTheDocument();
  });

  it("chaque onglet de la barre du bas prend la largeur de son libellé : « Événements » ne déborde pas de sa pastille", () => {
    render(<BottomNavLinks pathname="/accueil" />);
    const onglet = screen.getByRole("link", { name: "Événements" });
    expect(onglet).toHaveClass("flex-auto", "px-1");
    expect(onglet).not.toHaveClass("flex-1");
    expect(within(onglet).getByText("Événements")).toHaveClass("max-w-full", "truncate");
  });
});
