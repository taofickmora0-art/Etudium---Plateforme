// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";

// Publier ou abandonner les modifications d'une formation (fin du lot 4, spec §2.3) : la fenêtre liste ce qui part, un
// clic publie tout et crée une version ; « Abandonner les modifications » efface tous les brouillons de la formation.

vi.mock("@/lib/editeur/actions", () => ({
  publierModifications: vi.fn(),
  abandonnerModifications: vi.fn(),
  lireModificationsEnAttente: vi.fn(),
}));
const actions = await import("@/lib/editeur/actions");
const { BoutonPublierModifications } = await import("@/components/editeur/FenetrePublication");
const { ModificationsNonPubliees } = await import("@/components/editeur/ModificationsNonPubliees");

const F = "44444444-4444-4444-8444-444444444444";
const L = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  vi.mocked(actions.lireModificationsEnAttente).mockReset().mockResolvedValue({
    migrationAbsente: false,
    donnees: [
      { type: "formation", id: F, titre: "Informations générales", rang: null, modifiePar: "Aïcha Kpadé", modifieLe: "2026-11-01T14:32:00" },
      { type: "lecon", id: L, titre: "Les tableaux", rang: 3, modifiePar: "Mireille Adjovi", modifieLe: "2026-11-01T09:05:00" },
    ],
  });
  vi.mocked(actions.publierModifications).mockReset().mockResolvedValue({ ok: true, publiees: 2, version: 8 });
  vi.mocked(actions.abandonnerModifications).mockReset().mockResolvedValue({ ok: true });
});
const afficher = (element: React.ReactElement) => render(<ToastProvider>{element}</ToastProvider>);

describe("Publier les modifications", () => {
  it("la fenêtre liste les modifications (qui, à quelle heure) et publie ; « version 8 »", async () => {
    const user = userEvent.setup();
    afficher(<BoutonPublierModifications formationId={F} />);
    await user.click(screen.getByRole("button", { name: "Publier les modifications" }));
    const fenetre = await screen.findByRole("dialog", { name: "Publier les modifications ?" });
    const liste = await within(fenetre).findByRole("list", { name: "Modifications à publier" });
    expect(within(liste).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Informations généralespar Aïcha Kpadé, à 14 h 32",
      "Leçon 3 : Les tableauxpar Mireille Adjovi, à 9 h 05",
    ]);
    await user.click(within(fenetre).getByRole("button", { name: "Publier" }));
    expect(actions.publierModifications).toHaveBeenCalledWith(F);
    expect(await screen.findByText("Modifications publiées : version 8.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("rien en attente : le dit, et Publier est désactivé ; un refus reste dans la fenêtre", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.lireModificationsEnAttente).mockResolvedValue({ migrationAbsente: false, donnees: [] });
    const { unmount } = afficher(<BoutonPublierModifications formationId={F} />);
    await user.click(screen.getByRole("button", { name: "Publier les modifications" }));
    expect(await screen.findByText("Aucune modification à publier.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publier" })).toBeDisabled();
    unmount();

    vi.mocked(actions.lireModificationsEnAttente).mockResolvedValue({
      migrationAbsente: false,
      donnees: [{ type: "lecon", id: L, titre: "Les tableaux", rang: 1, modifiePar: null, modifieLe: "" }],
    });
    vi.mocked(actions.publierModifications).mockResolvedValue({ ok: false, message: "Cette formation n’est pas encore en ligne : envoyez-la en relecture." });
    afficher(<BoutonPublierModifications formationId={F} />);
    await user.click(screen.getByRole("button", { name: "Publier les modifications" }));
    await screen.findByRole("list", { name: "Modifications à publier" });
    await user.click(screen.getByRole("button", { name: "Publier" }));
    expect(await screen.findByText("Cette formation n’est pas encore en ligne : envoyez-la en relecture.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("abandonner toutes les modifications de la formation", async () => {
    const user = userEvent.setup();
    afficher(<ModificationsNonPubliees formationId={F} />);
    expect(screen.getByText("Des modifications ne sont pas encore publiées.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Abandonner les modifications" }));
    const fenetre = screen.getByRole("dialog", { name: "Abandonner toutes les modifications ?" });
    await user.click(within(fenetre).getByRole("button", { name: "Abandonner" }));
    expect(actions.abandonnerModifications).toHaveBeenCalledWith(F);
    expect(await screen.findByText("Modifications abandonnées")).toBeInTheDocument();
  });
});
