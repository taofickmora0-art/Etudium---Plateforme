// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CarteCatalogue, ParcoursCatalogue } from "@/lib/catalogue/types";
import { CARTES_DESIGN, PARCOURS_DESIGN } from "../catalogue/cartes-design";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
const listCatalogue = vi.fn<() => Promise<CarteCatalogue[]>>();
const listParcoursCatalogue = vi.fn<() => Promise<ParcoursCatalogue[]>>();
vi.mock("@/lib/catalogue/data", () => ({ listCatalogue: () => listCatalogue(), listParcoursCatalogue: () => listParcoursCatalogue() }));

const { ContenuLanding, FormationsDepuisBase, ParcoursDepuisBase } = await import("@/components/landing/ContenuLanding");

async function rendre() {
  return render(<ContenuLanding parcours={await ParcoursDepuisBase()} formations={await FormationsDepuisBase()} />);
}

describe("Landing assemblée (spec du lot 1, §9)", () => {
  beforeEach(() => {
    listCatalogue.mockReset().mockResolvedValue(CARTES_DESIGN);
    listParcoursCatalogue.mockReset().mockResolvedValue(PARCOURS_DESIGN);
  });

  it("les sections dans l'ordre du design, sans témoignages ni chiffres", async () => {
    await rendre();
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Le diplôme ne suffit plus. Les outils et les compétences font la différence.",
      "Un seul endroit pour apprendre, pratiquer et être accompagné",
      "Choisissez la direction qui vous ressemble",
      "Quatre étapes, de l’inscription au certificat",
      "Pour bien commencer",
      "Un abonnement mensuel, sans prélèvement automatique",
      "Vous n’apprenez jamais seul",
      "Une communauté par parcours",
      "Tout ce qu’il faut savoir avant de commencer",
      "Commencez gratuitement dès aujourd’hui",
    ]);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("une lecture impossible n'empêche pas la page de s'afficher : les cartes manquent, l'ancre des parcours reste", async () => {
    const espion = vi.spyOn(console, "error").mockImplementation(() => {});
    listCatalogue.mockRejectedValue(new Error("base injoignable"));
    listParcoursCatalogue.mockRejectedValue(new Error("base injoignable"));
    await rendre();
    expect(screen.queryByRole("heading", { level: 2, name: "Pour bien commencer" })).toBeNull();
    expect(document.getElementById("parcours")).not.toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "Tout ce qu’il faut savoir avant de commencer" })).toBeInTheDocument();
    expect(espion).toHaveBeenCalled();
    espion.mockRestore();
  });
});
