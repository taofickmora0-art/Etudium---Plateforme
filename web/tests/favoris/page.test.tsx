// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";

const retirerFavori = vi.fn();
const ajouterFavori = vi.fn();
vi.mock("@/lib/favoris/actions", () => ({ retirerFavori: (...a: unknown[]) => retirerFavori(...a), ajouterFavori: (...a: unknown[]) => ajouterFavori(...a) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/favoris" }));

const { PageFavoris } = await import("@/components/favoris/PageFavoris");
const { BoutonFavori } = await import("@/components/favoris/BoutonFavori");

const monter = (favoris: { id: string; titre: string; carte: React.ReactNode }[]) =>
  render(
    <ToastProvider>
      <PageFavoris favoris={favoris} />
    </ToastProvider>,
  );
const EXCEL = { id: "f1", titre: "Maîtriser Microsoft Excel", carte: <p>Carte Excel</p> };

describe("Page Favoris", () => {
  beforeEach(() => {
    retirerFavori.mockReset();
    ajouterFavori.mockReset();
  });

  it("les formations favorites, avec le cœur pour les retirer et une aide sous la grille", () => {
    monter([EXCEL]);
    expect(screen.getByRole("heading", { level: 1, name: "Favoris" })).toBeInTheDocument();
    expect(screen.getByText("Les formations que vous avez marquées d’un cœur, pour les retrouver rapidement.")).toBeInTheDocument();
    expect(screen.getByText("Carte Excel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retirer Maîtriser Microsoft Excel des favoris" })).toBeInTheDocument();
    expect(screen.getByText("Ajoutez une formation à vos favoris depuis sa fiche, pour la retrouver ici.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Parcourir le catalogue" })).toHaveAttribute("href", "/formations");
  });

  it("retirer passe par une confirmation ; la carte disparaît, puis l'état vide s'affiche", async () => {
    retirerFavori.mockResolvedValue({ ok: true });
    monter([EXCEL]);
    await userEvent.click(screen.getByRole("button", { name: "Retirer Maîtriser Microsoft Excel des favoris" }));
    expect(screen.getByRole("dialog", { name: "Retirer des favoris ?" })).toBeInTheDocument();
    expect(screen.getByText("« Maîtriser Microsoft Excel » ne figurera plus dans vos favoris. Votre progression ne change pas.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retirer" }));
    expect(retirerFavori).toHaveBeenCalledWith("f1");
    expect(screen.queryByText("Carte Excel")).toBeNull();
    expect(await screen.findByText("Aucun favori pour le moment")).toBeInTheDocument();
  });

  it("un échec est annoncé, la carte reste", async () => {
    retirerFavori.mockResolvedValue({ ok: false, erreur: "Le favori n’a pas pu être retiré. Réessayez." });
    monter([EXCEL]);
    await userEvent.click(screen.getByRole("button", { name: "Retirer Maîtriser Microsoft Excel des favoris" }));
    await userEvent.click(screen.getByRole("button", { name: "Retirer" }));
    expect(await screen.findByText("Le favori n’a pas pu être retiré. Réessayez.")).toBeInTheDocument();
    expect(screen.getByText("Carte Excel")).toBeInTheDocument();
  });

  it("sans favori : état vide sans cadre, et le lien vers le catalogue", () => {
    monter([]);
    expect(screen.getByRole("heading", { name: "Aucun favori pour le moment" })).toBeInTheDocument();
    expect(screen.getByText("Ajoutez une formation à vos favoris depuis sa fiche, pour la retrouver ici.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Parcourir le catalogue" })).toHaveAttribute("href", "/formations");
  });
});

describe("Cœur de la fiche formation", () => {
  beforeEach(() => {
    ajouterFavori.mockReset();
    retirerFavori.mockReset();
  });

  it("ajoute puis retire la formation des favoris", async () => {
    ajouterFavori.mockResolvedValue({ ok: true });
    retirerFavori.mockResolvedValue({ ok: true });
    render(
      <ToastProvider>
        <BoutonFavori formationId="f1" favoriInitial={false} />
      </ToastProvider>,
    );
    const bouton = screen.getByRole("button", { name: "Ajouter aux favoris" });
    expect(bouton).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(bouton);
    expect(ajouterFavori).toHaveBeenCalledWith("f1");
    expect(await screen.findByRole("button", { name: "Dans vos favoris" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Dans vos favoris" }));
    expect(retirerFavori).toHaveBeenCalledWith("f1");
    expect(await screen.findByRole("button", { name: "Ajouter aux favoris" })).toBeInTheDocument();
  });

  it("un échec remet l'état d'avant et l'annonce", async () => {
    ajouterFavori.mockResolvedValue({ ok: false, erreur: "Le favori n’a pas pu être enregistré. Réessayez." });
    render(
      <ToastProvider>
        <BoutonFavori formationId="f1" favoriInitial={false} />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Ajouter aux favoris" }));
    expect(await screen.findByText("Le favori n’a pas pu être enregistré. Réessayez.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ajouter aux favoris" })).toHaveAttribute("aria-pressed", "false");
  });
});
