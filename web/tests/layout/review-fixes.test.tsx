// @vitest-environment jsdom
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

  it("les menus s'affichent avant de connaître l'adresse (rendu préalable)", () => {
    render(
      <>
        <SidebarNavLinks pathname={null} />
        <BottomNavLinks pathname={null} />
      </>,
    );
    expect(screen.getByRole("navigation", { name: "Navigation principale" })).toBeInTheDocument();
    expect(screen.getAllByRole("link").filter((a) => a.hasAttribute("aria-current"))).toHaveLength(0);
  });

  it("sur téléphone, toutes les entrées de la barre latérale restent accessibles", () => {
    const telephone = new Set([...NAV_BAS, ...NAV_MENU_TELEPHONE, ...LIENS_ENTETE_TELEPHONE].map((e) => e.href));
    const manquantes = [...NAV_PRINCIPALE, ...NAV_MON_ESPACE, { href: "/recherche" }].map((e) => e.href).filter((h) => !telephone.has(h));
    expect(manquantes).toEqual([]);
  });

  it("la page Profil du téléphone propose les espaces selon les rôles", () => {
    const { unmount } = render(<MobileProfileMenu user={{ ...DEMO_USER, roles: ["etudiant"] }} />);
    expect(screen.queryByRole("link", { name: "Espace formateur" })).not.toBeInTheDocument();
    unmount();
    render(<MobileProfileMenu user={{ ...DEMO_USER, roles: ["etudiant", "formateur", "admin"] }} />);
    expect(screen.getByRole("link", { name: "Espace formateur" })).toHaveAttribute("href", "/formateur");
    expect(screen.getByRole("link", { name: "Back-office" })).toHaveAttribute("href", "/admin");
  });

  it("les libellés de la barre du bas ont 4 px de marge de chaque côté (« Communauté » à 360 px)", () => {
    render(<BottomNavLinks pathname="/accueil" />);
    const libelle = within(screen.getByRole("link", { name: "Communauté" })).getByText("Communauté");
    expect(libelle).toHaveClass("max-w-[calc(100%+8px)]");
  });
});
