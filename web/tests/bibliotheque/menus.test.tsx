// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { LibraryIcon } from "@hugeicons/core-free-icons";
import { describe, expect, it, vi } from "vitest";
import { entreeActive, MENUS, NAV_BAS_PAR_ESPACE, NAV_PRINCIPALE } from "@/lib/navigation";

// L'entrée « Bibliothèque » de l'étudiant (spec du 3 novembre 2026, §2 et §7.6) : une entrée à part entière, juste après
// « Formations », dans la barre latérale et donc dans le menu ≡ du téléphone (qui reprend la barre latérale). La barre
// du bas reste à cinq onglets ; le formateur, sans espace étudiant, ne l'a pas.

vi.mock("next/navigation", () => ({ usePathname: () => "/bibliotheque/reussir-son-memoire", useRouter: () => ({ push: vi.fn() }) }));
const { SidebarNavLinks } = await import("@/components/layout/SidebarNav");

describe("L'entrée « Bibliothèque » des menus", () => {
  it("juste après « Formations », avec l'icône de la bibliothèque", () => {
    const i = NAV_PRINCIPALE.findIndex((e) => e.href === "/bibliotheque");
    expect(NAV_PRINCIPALE[i - 1]?.href).toBe("/formations");
    expect(NAV_PRINCIPALE[i]).toMatchObject({ label: "Bibliothèque", icon: LibraryIcon });
  });

  it("marquée sur la page Bibliothèque et sur la fiche d'un livre", () => {
    const entree = NAV_PRINCIPALE.find((e) => e.href === "/bibliotheque")!;
    expect(entreeActive("/bibliotheque", entree)).toBe(true);
    expect(entreeActive("/bibliotheque/reussir-son-memoire", entree)).toBe(true);
    expect(entreeActive("/formations", entree)).toBe(false);
  });

  it("dans la barre latérale et dans le menu ≡ ; ni dans la barre du bas, ni chez le formateur", () => {
    const { unmount } = render(<SidebarNavLinks pathname="/bibliotheque/reussir-son-memoire" />);
    const nav = screen.getByRole("navigation", { name: "Navigation principale" });
    expect(within(nav).getByRole("link", { name: "Bibliothèque" })).toHaveAttribute("href", "/bibliotheque");
    expect(within(nav).getByRole("link", { name: "Bibliothèque" })).toHaveAttribute("aria-current", "page");
    unmount();
    // Le tiroir du téléphone : la même liste, sans colonne d'icônes.
    render(<SidebarNavLinks pathname="/accueil" repliable={false} />);
    expect(screen.getByRole("link", { name: "Bibliothèque" })).toHaveAttribute("href", "/bibliotheque");
    expect(NAV_BAS_PAR_ESPACE.etudiant.map((e) => e.href)).not.toContain("/bibliotheque");
    expect(NAV_BAS_PAR_ESPACE.etudiant).toHaveLength(5);
    const formateur = [...MENUS.formateur.groupes.flatMap((g) => g.entrees), ...NAV_BAS_PAR_ESPACE.formateur].map((e) => e.href);
    expect(formateur.filter((h) => h.includes("bibliotheque"))).toEqual([]);
  });
});
