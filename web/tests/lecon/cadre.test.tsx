// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/formations/x/lecons/y" }));
vi.mock("@/components/layout/CompteDeLEntete", () => ({ CompteDeLEntete: () => null }));

const { CadreLecon } = await import("@/components/lecon/CadreLecon");

const cadre = (connecte: boolean, retour: string) => (
  <CadreLecon connecte={connecte} titreFormation="Maîtriser Microsoft Excel" retour={retour} programme={<p>Programme ici</p>} barre={<p>Barre ici</p>}>
    <p>Contenu ici</p>
  </CadreLecon>
);

describe("Cadre de la page leçon", () => {
  it("un visiteur : en-tête public, retour vers la fiche, programme à la place du menu", () => {
    render(cadre(false, "/formations/maitriser-microsoft-excel"));
    expect(screen.getByRole("navigation", { name: "Site Étudium" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Retour" })).toHaveAttribute("href", "/formations/maitriser-microsoft-excel");
    expect(screen.getByText("Maîtriser Microsoft Excel")).toBeInTheDocument();
    expect(within(screen.getByRole("navigation", { name: "Programme de la formation" })).getByText("Programme ici")).toBeInTheDocument();
    expect(within(screen.getByRole("main")).getByText("Contenu ici")).toBeInTheDocument();
    expect(within(screen.getByRole("main")).getByText("Barre ici")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Navigation principale" })).toBeNull();
  });

  it("un compte connecté : en-tête de l'appli, retour vers Mes formations", () => {
    render(cadre(true, "/mes-formations"));
    expect(screen.queryByRole("navigation", { name: "Site Étudium" })).toBeNull();
    expect(screen.getByRole("link", { name: "Étudium, accueil" })).toHaveAttribute("href", "/accueil");
    expect(screen.getByRole("link", { name: "Retour" })).toHaveAttribute("href", "/mes-formations");
    expect(screen.getByRole("link", { name: "Aller au contenu" })).toHaveAttribute("href", "#contenu");
  });

  it("une panne (Supabase injoignable) affiche une erreur en français, avec « Réessayer »", async () => {
    const { default: LeconError } = await import("@/app/(lecon)/error");
    const retry = vi.fn();
    render(<LeconError error={new Error("fetch failed")} retry={retry} />);
    expect(screen.getByRole("heading", { name: "Une erreur est survenue" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(retry).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Toutes les formations" })).toHaveAttribute("href", "/formations");
  });
});
