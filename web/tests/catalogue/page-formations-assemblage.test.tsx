// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VueCarteSuivie } from "@/components/mes-formations/CarteSuivie";
import { CARTES_DESIGN, PARCOURS_DESIGN } from "./cartes-design";

// La page Formations assemblée (revue du plan Formations et Événements) : sans formation suivie, aucune rangée ni vide.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/formations" }));
vi.mock("@/lib/catalogue/data", () => ({ listCatalogue: async () => CARTES_DESIGN, listParcoursCatalogue: async () => PARCOURS_DESIGN }));
const lireFormationsSuivies = vi.fn<() => Promise<VueCarteSuivie[]>>();
vi.mock("@/lib/mes-formations/data", () => ({ lireFormationsSuivies: () => lireFormationsSuivies() }));

const { PageCatalogue } = await import("@/components/catalogue/PageCatalogue");

const vue = (n: number): VueCarteSuivie => ({
  id: `f${n}`,
  titre: `Formation ${n}`,
  resume: "",
  parcours: "academique",
  pourcentage: 30,
  temps: "1 h restante",
  etat: "enCours",
  href: `/formations/f${n}/lecons/l1`,
  favori: false,
  couverture: null,
});

describe("Page Formations assemblée", () => {
  beforeEach(() => {
    lireFormationsSuivies.mockReset();
  });

  it("sans formation suivie : pas de rangée, « Toutes les formations » juste sous le titre", async () => {
    lireFormationsSuivies.mockResolvedValue([]);
    render(await PageCatalogue({ params: {}, variante: "connecte", chemin: "/formations", avecMesFormations: true }));
    expect(screen.queryByRole("region", { name: "Mes formations" })).toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "Toutes les formations" }).className).toContain("mt-7");
  });

  it("avec des formations suivies : la rangée au-dessus ; une lecture impossible : le catalogue seul", async () => {
    lireFormationsSuivies.mockResolvedValue([vue(1), vue(2)]);
    const { unmount } = render(await PageCatalogue({ params: {}, variante: "connecte", chemin: "/formations", avecMesFormations: true }));
    expect(screen.getByRole("region", { name: "Mes formations" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Toutes les formations" }).className).toContain("mt-9");
    unmount();
    const espion = vi.spyOn(console, "error").mockImplementation(() => {});
    lireFormationsSuivies.mockRejectedValue(new Error("base injoignable"));
    render(await PageCatalogue({ params: {}, variante: "connecte", chemin: "/formations", avecMesFormations: true }));
    expect(screen.queryByRole("region", { name: "Mes formations" })).toBeNull();
    expect(espion).toHaveBeenCalled();
    espion.mockRestore();
  });

  it("le visiteur : jamais de lecture des formations suivies", async () => {
    render(await PageCatalogue({ params: {}, variante: "public", chemin: "/formations" }));
    expect(lireFormationsSuivies).not.toHaveBeenCalled();
  });
});
