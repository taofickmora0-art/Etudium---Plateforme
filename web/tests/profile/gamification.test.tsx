// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { DEMO_JEU } from "@/lib/demo-user";

// Le profil (lot 6 B, §3 ; NdProfil) : la carte « Gamification » et le choix de l'objectif de la semaine.

const { choisirObjectif } = vi.hoisted(() => ({ choisirObjectif: vi.fn() }));
vi.mock("@/lib/profile/actions", () => ({ choisirObjectif, updatePreferences: vi.fn() }));

const { CarteGamification } = await import("@/components/profile/CarteGamification");
const { ChoixObjectif } = await import("@/components/profile/ChoixObjectif");

beforeEach(() => {
  choisirObjectif.mockReset();
});

describe("La carte « Gamification »", () => {
  it("le niveau, la série, les badges et ce qu'il manque pour le niveau suivant", () => {
    render(<CarteGamification jeu={DEMO_JEU} />);
    const carte = screen.getByRole("region", { name: "Gamification" });
    expect(within(carte).getAllByRole("listitem").slice(0, 3).map((l) => l.textContent)).toEqual(["Niveau 4", "8 jours", "3 badges"]);
    expect(within(carte).getByText("Encore 80 points pour atteindre le niveau 5.")).toBeInTheDocument();
    expect(within(carte).getByRole("list", { name: "Badges obtenus" }).textContent).toBe("Premier pasSérie de 3 joursSérie de 7 jours");
  });

  it("aucun badge : ce qu'il faut faire pour le premier", () => {
    render(<CarteGamification jeu={{ ...DEMO_JEU, serie: 0, niveau: 1, pointsAvantNiveau: 200, badges: [] }} />);
    const carte = screen.getByRole("region", { name: "Gamification" });
    expect(within(carte).getAllByRole("listitem").map((l) => l.textContent)).toEqual(["Niveau 1", "0 jour", "0 badge"]);
    expect(within(carte).getByText("Terminez une première leçon pour obtenir « Premier pas ».")).toBeInTheDocument();
  });
});

describe("Le choix de l'objectif de la semaine", () => {
  const afficher = (valeur: 3 | 5 | 7 = 5) =>
    render(
      <ToastProvider>
        <ChoixObjectif valeur={valeur} />
      </ToastProvider>,
    );

  it("3, 5 ou 7 jours ; le choix s'enregistre tout de suite", async () => {
    choisirObjectif.mockResolvedValue({ ok: true });
    afficher();
    expect(screen.getByRole("radio", { name: "5 jours" })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "7 jours" }));
    expect(choisirObjectif).toHaveBeenCalledWith(7);
    expect(screen.getByRole("radio", { name: "7 jours" })).toBeChecked();
  });

  it("un échec : retour au choix enregistré, et on le dit", async () => {
    choisirObjectif.mockResolvedValue({ ok: false });
    afficher(5);
    await userEvent.click(screen.getByRole("radio", { name: "3 jours" }));
    expect(await screen.findByText("L’objectif n’a pas été enregistré.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "5 jours" })).toBeChecked();
  });
});
