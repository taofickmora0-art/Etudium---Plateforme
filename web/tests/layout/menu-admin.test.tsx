// @vitest-environment jsdom
import { act, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BottomNavLinks } from "@/components/layout/MobileNav";
import { SidebarNavLinks } from "@/components/layout/SidebarNav";
import { fixerDomaines } from "@/lib/auth/domaines-du-compte";
import { filtrerGroupes, MENUS } from "@/lib/navigation";

// Le menu du back-office selon le rôle (lot 6 A, spec §1.2) : seules les entrées des domaines du compte ; un groupe
// vide disparaît. Avant que le compte soit lu, seul le tableau de bord s'affiche.

vi.mock("next/navigation", () => ({ usePathname: () => "/admin", useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/messages/useMessagesNonLus", () => ({ useMessagesNonLus: () => 0 }));
vi.mock("@/components/sessions/useNouvellesSessions", () => ({ useNouvellesSessions: () => 0 }));

const libelles = (groupes: ReturnType<typeof filtrerGroupes>) => groupes.map((g) => [g.titre ?? "", g.entrees.map((e) => e.label)]);

afterEach(() => act(() => fixerDomaines(null)));

describe("Le menu du back-office", () => {
  it("modérateur : la communauté seulement, sans groupe vide", () => {
    expect(libelles(filtrerGroupes(MENUS.admin.groupes, ["communaute"]))).toEqual([
      ["", ["Tableau de bord"]],
      ["Contenus", ["Avis", "Sessions live"]],
      ["Plateforme", ["Messages", "Communauté", "Modération"]],
    ]);
  });

  it("admin : tout ; compte pas encore lu : le tableau de bord seulement", () => {
    const tout = MENUS.admin.groupes.flatMap((g) => g.entrees.map((e) => e.label));
    expect(filtrerGroupes(MENUS.admin.groupes, ["communaute", "contenus", "utilisateurs", "paiements", "statistiques"]).flatMap((g) => g.entrees.map((e) => e.label))).toEqual(tout);
    expect(libelles(filtrerGroupes(MENUS.admin.groupes, null))).toEqual([["", ["Tableau de bord"]]]);
  });

  it("la barre latérale et la barre du bas d'un modérateur", () => {
    act(() => fixerDomaines(["communaute"]));
    render(<SidebarNavLinks pathname="/admin" />);
    const menu = screen.getByRole("navigation", { name: "Navigation du back-office" });
    expect(within(menu).getAllByRole("link").map((l) => l.textContent)).toEqual(["Tableau de bord", "Avis", "Sessions live", "Messages", "Communauté", "Modération"]);
    render(<BottomNavLinks pathname="/admin" />);
    expect(screen.queryByRole("link", { name: "Formations" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Utilisateurs" })).toBeNull();
  });
});
