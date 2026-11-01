// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CarteCatalogue, ParcoursCatalogue } from "@/lib/catalogue/types";
import { CARTES_DESIGN, PARCOURS_DESIGN } from "../catalogue/cartes-design";

vi.mock("next/navigation", async (original) => ({ ...(await original<typeof import("next/navigation")>()), usePathname: () => "/" }));
const listCatalogue = vi.fn<() => Promise<CarteCatalogue[]>>();
const listParcoursCatalogue = vi.fn<() => Promise<ParcoursCatalogue[]>>();
vi.mock("@/lib/catalogue/data", () => ({ listCatalogue: () => listCatalogue(), listParcoursCatalogue: () => listParcoursCatalogue() }));
vi.mock("@/lib/abonnement/data", () => ({ lireFormules: async () => [] }));

const { ContenuLanding, FormationsDepuisBase, FormulesDepuisBase } = await import("@/components/landing/ContenuLanding");

async function rendre() {
  return render(<ContenuLanding formations={await FormationsDepuisBase()} formules={await FormulesDepuisBase()} />);
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
      "Un abonnement de 3 mois à 1 an, sans prélèvement automatique",
      "Vous n’apprenez jamais seul",
      "Une communauté par parcours",
      "Tout ce qu’il faut savoir avant de commencer",
      "Commencez gratuitement dès aujourd’hui",
    ]);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    // Les parcours sont du texte fixe : rien à lire en base, rien qui arrive après coup au-dessus des ancres.
    expect(listParcoursCatalogue).not.toHaveBeenCalled();
  });

  it("une lecture impossible n'empêche pas la page de s'afficher : seules les formations manquent", async () => {
    const espion = vi.spyOn(console, "error").mockImplementation(() => {});
    listCatalogue.mockRejectedValue(new Error("base injoignable"));
    await rendre();
    expect(screen.queryByRole("heading", { level: 2, name: "Pour bien commencer" })).toBeNull();
    expect(within(document.getElementById("parcours") as HTMLElement).getAllByRole("heading", { level: 3 })).toHaveLength(3);
    expect(screen.getByRole("heading", { level: 2, name: "Tout ce qu’il faut savoir avant de commencer" })).toBeInTheDocument();
    expect(espion).toHaveBeenCalled();
    espion.mockRestore();
  });

  it("une interruption du pré-rendu de Next n'est pas un échec : elle repart, sans trace d'erreur", async () => {
    const espion = vi.spyOn(console, "error").mockImplementation(() => {});
    const interruption = Object.assign(new Error("During prerendering, `cookies()` rejects"), { digest: "HANGING_PROMISE_REJECTION" });
    listCatalogue.mockRejectedValue(interruption);
    await expect(FormationsDepuisBase()).rejects.toBe(interruption);
    expect(espion).not.toHaveBeenCalled();
    espion.mockRestore();
  });
});
