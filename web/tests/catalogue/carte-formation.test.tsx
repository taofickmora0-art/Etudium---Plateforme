// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { CarteCatalogue } from "@/lib/catalogue/types";
import { parSlug } from "./cartes-design";

const ajouterFavori = vi.fn();
const retirerFavori = vi.fn();
vi.mock("@/lib/favoris/actions", () => ({ ajouterFavori: (...a: unknown[]) => ajouterFavori(...a), retirerFavori: (...a: unknown[]) => retirerFavori(...a) }));

const { CarteFormation } = await import("@/components/catalogue/CarteFormation");

const EXCEL: CarteCatalogue = { ...parSlug("maitriser-microsoft-excel"), nbModules: 4, nbLecons: 12, note: 4.8, nbAvis: 69 };
type Options = { apprenants?: number; progression?: number; favori?: boolean };
const afficher = (carte: CarteCatalogue, options: Options = {}) =>
  render(
    <ToastProvider>
      <CarteFormation carte={carte} {...options} />
    </ToastProvider>,
  );
const lien = () => screen.getByRole("link", { name: /Maîtriser Microsoft Excel/ });

describe("Carte de formation", () => {
  beforeEach(() => {
    ajouterFavori.mockReset();
    retirerFavori.mockReset();
  });

  it("titre h2 par défaut, h3 sur demande (cartes sous le titre d'une section)", () => {
    const { unmount } = render(<CarteFormation carte={parSlug("maitriser-microsoft-excel")} />);
    expect(screen.getByRole("heading", { level: 2, name: "Maîtriser Microsoft Excel" })).toBeInTheDocument();
    unmount();
    render(<CarteFormation carte={parSlug("maitriser-microsoft-excel")} titleAs="h3" />);
    expect(screen.getByRole("heading", { level: 3, name: "Maîtriser Microsoft Excel" })).toBeInTheDocument();
  });

  it("de haut en bas : couverture, titre, programme et apprenants, résumé, note · durée · niveau, puis « Voir le cours »", () => {
    afficher(EXCEL, { apprenants: 34 });
    const carte = lien();
    expect(carte).toHaveAttribute("href", "/formations/maitriser-microsoft-excel");
    const ordre = [
      carte.querySelector("[data-couverture]")!,
      screen.getByRole("heading", { name: "Maîtriser Microsoft Excel" }),
      within(carte).getByText("4 modules • 12 leçons"),
      within(carte).getByText("34 apprenants"),
      within(carte).getByText(EXCEL.resume),
      within(carte).getByText("4,8 (69)"),
      within(carte).getByText("6 h 20"),
      within(carte).getByText("Intermédiaire"),
      within(carte).getByText("Voir le cours"),
    ];
    for (let i = 1; i < ordre.length; i++) expect(ordre[i - 1].compareDocumentPosition(ordre[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Le programme à gauche, les apprenants à droite (avec leur icône), sur une ligne qui passe à la ligne si besoin.
    const ligne = within(carte).getByText("34 apprenants").closest("[id]")!;
    expect(ligne).toContainElement(within(carte).getByText("4 modules • 12 leçons"));
    expect(ligne).toHaveClass("flex-wrap", "justify-between");
    expect(within(carte).getByText("34 apprenants").parentElement?.querySelector("svg")).not.toBeNull();
    // Un seul lien par carte ; ce qu'elle annonce en plus du titre suit dans sa description.
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(carte).toHaveAccessibleDescription(/4 modules • 12 leçons.*34 apprenants.*Voir le cours/);
  });

  it("les accords au singulier", () => {
    afficher({ ...EXCEL, nbModules: 1, nbLecons: 1 }, { apprenants: 1 });
    expect(screen.getByText("1 module • 1 leçon")).toBeInTheDocument();
    expect(screen.getByText("1 apprenant")).toBeInTheDocument();
  });

  it("inscrit : « N % terminé », même à 0 %", () => {
    const { unmount } = afficher(EXCEL, { progression: 0, favori: false });
    expect(within(lien()).getByText("0 % terminé")).toBeInTheDocument();
    expect(screen.queryByText("Voir le cours")).toBeNull();
    unmount();
    afficher(EXCEL, { progression: 42, favori: false });
    expect(within(lien()).getByText("42 % terminé")).toBeInTheDocument();
  });

  it("sans la 0069 (nombre d'apprenants inconnu) : pas d'apprenants, le reste est là", () => {
    afficher(EXCEL);
    expect(screen.queryByText(/apprenant/)).toBeNull();
    expect(screen.getByText("4 modules • 12 leçons")).toBeInTheDocument();
    expect(screen.getByText("Voir le cours")).toBeInTheDocument();
  });

  it("un visiteur (favori inconnu) n'a pas de cœur", () => {
    afficher(EXCEL, { apprenants: 34 });
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("le cœur : un vrai bouton à côté du lien (pas dedans), gris puis plein et rouge, sans confirmation", async () => {
    ajouterFavori.mockResolvedValue({ ok: true });
    retirerFavori.mockResolvedValue({ ok: true });
    afficher(EXCEL, { progression: 0, favori: false });
    const coeur = screen.getByRole("button", { name: "Ajouter « Maîtriser Microsoft Excel » aux favoris" });
    expect(coeur).toHaveAttribute("type", "button");
    expect(coeur).toHaveAttribute("aria-pressed", "false");
    expect(coeur.closest("a")).toBeNull();
    expect(lien()).not.toContainElement(coeur);
    expect(coeur).toHaveClass("text-discret");
    await userEvent.click(coeur);
    expect(ajouterFavori).toHaveBeenCalledWith(EXCEL.id);
    const plein = screen.getByRole("button", { name: "Ajouter « Maîtriser Microsoft Excel » aux favoris" });
    expect(plein).toHaveAttribute("aria-pressed", "true");
    expect(plein).toHaveClass("text-erreur-vif", "[&_path]:fill-current");
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.click(plein);
    expect(retirerFavori).toHaveBeenCalledWith(EXCEL.id);
    expect(await screen.findByRole("button", { name: "Ajouter « Maîtriser Microsoft Excel » aux favoris" })).toHaveAttribute("aria-pressed", "false");
  });

  it("le cœur se met à jour tout de suite, et revient en arrière avec un message si la base refuse", async () => {
    let repondre: (r: { ok: boolean; erreur?: string }) => void = () => {};
    ajouterFavori.mockReturnValue(new Promise((r) => (repondre = r)));
    afficher(EXCEL, { favori: false });
    await userEvent.click(screen.getByRole("button", { name: "Ajouter « Maîtriser Microsoft Excel » aux favoris" }));
    // Avant la réponse de la base : déjà plein.
    expect(screen.getByRole("button", { name: "Ajouter « Maîtriser Microsoft Excel » aux favoris" })).toHaveAttribute("aria-pressed", "true");
    repondre({ ok: false, erreur: "Le favori n’a pas pu être enregistré. Réessayez." });
    expect(await screen.findByText("Le favori n’a pas pu être enregistré. Réessayez.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ajouter « Maîtriser Microsoft Excel » aux favoris" })).toHaveAttribute("aria-pressed", "false");
  });

  it("une action qui échoue (réseau) remet aussi l'état d'avant, avec un message", async () => {
    retirerFavori.mockRejectedValue(new Error("réseau"));
    afficher(EXCEL, { favori: true });
    await userEvent.click(screen.getByRole("button", { name: "Ajouter « Maîtriser Microsoft Excel » aux favoris" }));
    expect(await screen.findByText("Le favori n’a pas pu être retiré. Réessayez.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ajouter « Maîtriser Microsoft Excel » aux favoris" })).toHaveAttribute("aria-pressed", "true");
  });
});
