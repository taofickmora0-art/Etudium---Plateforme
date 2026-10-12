// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CARTES_DESIGN, PARCOURS_DESIGN } from "./cartes-design";

const listCatalogue = vi.fn();
vi.mock("@/lib/catalogue/data", () => ({ listCatalogue: () => listCatalogue(), listParcoursCatalogue: async () => PARCOURS_DESIGN }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/formations" }));

const { PageCatalogue } = await import("@/components/catalogue/PageCatalogue");

describe("Catalogue : pannes et navigation", () => {
  it("une panne de lecture s'affiche dans le cadre du catalogue, avec « Réessayer »", async () => {
    const { default: CatalogueError } = await import("@/app/(catalogue)/error");
    render(<CatalogueError error={new Error("fetch failed")} retry={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Une erreur est survenue" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });

  it("une erreur de lecture remonte jusqu'à cet écran (pas d'avertissement « tables absentes »)", async () => {
    listCatalogue.mockRejectedValueOnce(new Error("fetch failed"));
    await expect(PageCatalogue({ params: {}, variante: "public", chemin: "/formations" })).rejects.toThrow("fetch failed");
  });

  it("le catalogue repart des filtres de l'adresse à chaque navigation", async () => {
    listCatalogue.mockResolvedValue(CARTES_DESIGN);
    const element = await PageCatalogue({ params: { parcours: "competences-digitales" }, variante: "public", chemin: "/formations" });
    // Une clé qui change avec les filtres : un clic sur « Toutes les formations » repart de zéro au lieu de garder l'ancien état.
    expect((element as { key: string | null }).key).toBe("?parcours=competences-digitales");
    const sansFiltre = await PageCatalogue({ params: {}, variante: "public", chemin: "/formations" });
    expect((sansFiltre as { key: string | null }).key).toBe("tous");
  });
});
