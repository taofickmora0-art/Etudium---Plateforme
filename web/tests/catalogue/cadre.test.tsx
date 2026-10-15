// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_USER } from "@/lib/demo-user";

const getShellUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: () => getShellUser(), demoModeActive: () => false }));
vi.mock("next/navigation", () => ({ usePathname: () => "/formations", useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
// Le compte de l'en-tête arrive à part (Suspense) : inutile ici.
vi.mock("@/components/layout/CompteDeLEntete", () => ({ CompteDeLEntete: () => null }));

const { CadreSelonVisiteur } = await import("@/components/site/CadreSelonVisiteur");
const { AuthUnavailableError } = await import("@/lib/auth/session-state");

describe("Cadre du catalogue selon la personne", () => {
  beforeEach(() => {
    getShellUser.mockReset();
  });

  it("un visiteur voit le cadre public, avec la connexion et l'inscription", async () => {
    getShellUser.mockResolvedValue(null);
    render(await CadreSelonVisiteur({ children: <p>Catalogue</p> }));
    expect(screen.getByText("Catalogue")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Se connecter" })).toHaveAttribute("href", "/connexion");
    expect(screen.getByRole("link", { name: "Créer mon compte gratuit" })).toHaveAttribute("href", "/inscription");
    expect(screen.queryByRole("navigation", { name: "Navigation principale" })).toBeNull();
  });

  it("un compte connecté voit la coque de l'appli", async () => {
    getShellUser.mockResolvedValue(DEMO_USER);
    render(await CadreSelonVisiteur({ children: <p>Catalogue</p> }));
    expect(screen.getByText("Catalogue")).toBeInTheDocument();
    expect(screen.getAllByRole("navigation", { name: "Navigation principale" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Créer mon compte gratuit" })).toBeNull();
  });

  it("si Supabase est injoignable, le catalogue s'affiche en cadre public plutôt qu'en erreur", async () => {
    getShellUser.mockRejectedValue(new AuthUnavailableError());
    render(await CadreSelonVisiteur({ children: <p>Catalogue</p> }));
    expect(screen.getByRole("link", { name: "Se connecter" })).toBeInTheDocument();
  });
});
