// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { entreeActive, isActive, NAV_MENU_TELEPHONE, NAV_PRINCIPALE } from "@/lib/navigation";

vi.mock("next/navigation", () => ({ usePathname: () => "/certificats" }));

describe("Navigation", () => {
  it("isActive suit les sous-pages", () => {
    expect(isActive("/mes-formations", "/mes-formations")).toBe(true);
    expect(isActive("/mes-formations/excel", "/mes-formations")).toBe(true);
    expect(isActive("/formations-gratuites", "/formations")).toBe(false);
    expect(isActive("/accueil", "/")).toBe(false);
  });

  it("l'onglet Formations est marqué sur le catalogue, Mes formations et la fiche, pas sur Formations gratuites", () => {
    const formations = NAV_PRINCIPALE.find((e) => e.label === "Formations")!;
    expect(entreeActive("/formations", formations)).toBe(true);
    expect(entreeActive("/mes-formations", formations)).toBe(true);
    expect(entreeActive("/formations/excel", formations)).toBe(true);
    expect(entreeActive("/formations-gratuites", formations)).toBe(false);
    expect(entreeActive("/mes-formationsx", formations)).toBe(false);
  });

  it("la page Profil du téléphone ne double plus l'onglet Formations de la barre du bas", () => {
    expect(NAV_MENU_TELEPHONE.map((e) => e.label)).not.toContain("Toutes les formations");
  });

  it("la barre latérale marque la page courante", () => {
    render(<SidebarNav />);
    expect(screen.getByRole("navigation", { name: "Navigation principale" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Certificats" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Accueil" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("group", { name: "Mon espace" })).toBeInTheDocument();
  });
});
