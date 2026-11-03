// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { CarteLivre } from "@/lib/bibliotheque/types";
import { ID_VENDRE, MEMOIRE, VENDRE } from "./fixtures";

// La page Favoris reçoit aussi les livres mis de côté (spec du 3 novembre 2026, §2 ; étape C) : une section « Livres »,
// avec le même cœur pour les retirer, après confirmation.

const retirerFavori = vi.fn();
vi.mock("@/lib/favoris/actions", () => ({ retirerFavori: (...a: unknown[]) => retirerFavori(...a), ajouterFavori: vi.fn() }));
const retirerFavoriLivre = vi.fn();
vi.mock("@/lib/bibliotheque/actions", () => ({ retirerFavoriLivre: (...a: unknown[]) => retirerFavoriLivre(...a), ajouterFavoriLivre: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/favoris" }));

const { PageFavoris } = await import("@/components/favoris/PageFavoris");

const EXCEL = { id: "f1", titre: "Maîtriser Microsoft Excel", carte: <p>Carte Excel</p> };
const monter = (favoris: (typeof EXCEL)[], livres: CarteLivre[]) =>
  render(
    <ToastProvider>
      <PageFavoris favoris={favoris} livres={livres} />
    </ToastProvider>,
  );

describe("Les livres de la page Favoris", () => {
  beforeEach(() => {
    retirerFavori.mockReset().mockResolvedValue({ ok: true });
    retirerFavoriLivre.mockReset().mockResolvedValue({ ok: true });
  });

  it("deux sections : « Formations » puis « Livres », chaque livre vers sa fiche", () => {
    monter([EXCEL], [MEMOIRE, VENDRE]);
    expect(screen.getByText("Les formations et les livres que vous avez marqués d’un cœur, pour les retrouver rapidement.")).toBeInTheDocument();
    const formations = screen.getByRole("region", { name: "Formations" });
    expect(within(formations).getByText("Carte Excel")).toBeInTheDocument();
    const livres = screen.getByRole("region", { name: "Livres" });
    expect(within(livres).getByRole("link", { name: /Réussir son mémoire/ })).toHaveAttribute("href", "/bibliotheque/reussir-son-memoire");
    expect(within(livres).getByRole("link", { name: /Vendre en ligne/ })).toHaveAttribute("href", "/bibliotheque/vendre-en-ligne");
    // La progression d'un livre commencé reste visible.
    expect(within(livres).getByText("42 % lus")).toBeInTheDocument();
  });

  it("seulement des livres : la section « Livres », sans état vide", () => {
    monter([], [VENDRE]);
    expect(screen.queryByRole("heading", { name: "Aucun favori pour le moment" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Formations" })).toBeNull();
    expect(screen.getByRole("region", { name: "Livres" })).toBeInTheDocument();
  });

  it("retirer un livre passe par une confirmation ; le dernier retiré, l'état vide s'affiche", async () => {
    monter([], [VENDRE]);
    await userEvent.click(screen.getByRole("button", { name: "Retirer Vendre en ligne des favoris" }));
    expect(screen.getByRole("dialog", { name: "Retirer des favoris ?" })).toHaveTextContent("« Vendre en ligne » ne figurera plus dans vos favoris. Votre lecture ne change pas.");
    await userEvent.click(screen.getByRole("button", { name: "Retirer" }));
    expect(retirerFavoriLivre).toHaveBeenCalledWith(ID_VENDRE);
    expect(retirerFavori).not.toHaveBeenCalled();
    expect(await screen.findByText("Aucun favori pour le moment")).toBeInTheDocument();
  });

  it("un échec est annoncé, le livre reste", async () => {
    retirerFavoriLivre.mockResolvedValue({ ok: false, erreur: "Le favori n’a pas pu être retiré. Réessayez." });
    monter([EXCEL], [VENDRE]);
    await userEvent.click(screen.getByRole("button", { name: "Retirer Vendre en ligne des favoris" }));
    await userEvent.click(screen.getByRole("button", { name: "Retirer" }));
    expect(await screen.findByText("Le favori n’a pas pu être retiré. Réessayez.")).toBeInTheDocument();
    // La fenêtre reste ouverte (le reste de la page est caché aux lecteurs d’écran le temps du message).
    expect(screen.getByRole("link", { name: /Vendre en ligne/, hidden: true })).toBeInTheDocument();
  });

  it("sans livre en favori (ou sans la 0074) : la page des formations, comme avant", () => {
    monter([EXCEL], []);
    expect(screen.getByText("Les formations que vous avez marquées d’un cœur, pour les retrouver rapidement.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Livres" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Formations" })).toBeNull();
  });
});
