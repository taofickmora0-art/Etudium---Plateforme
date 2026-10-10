// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { isActive } from "@/lib/navigation";

vi.mock("next/navigation", () => ({ usePathname: () => "/certificats" }));

describe("Navigation", () => {
  it("isActive suit les sous-pages", () => {
    expect(isActive("/mes-formations", "/mes-formations")).toBe(true);
    expect(isActive("/mes-formations/excel", "/mes-formations")).toBe(true);
    expect(isActive("/formations-gratuites", "/formations")).toBe(false);
    expect(isActive("/accueil", "/")).toBe(false);
  });

  it("la barre latérale marque la page courante", () => {
    render(<SidebarNav />);
    expect(screen.getByRole("navigation", { name: "Navigation principale" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Certificats" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Accueil" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("group", { name: "Mon espace" })).toBeInTheDocument();
  });
});
