// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// « Sessions live programmées » et la pastille rouge (spec promotion des sessions live, §3).
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/accueil", useSearchParams: () => new URLSearchParams() }));
const compterNouvellesSessions = vi.fn<() => Promise<number>>();
const marquerEvenementsVus = vi.fn<() => Promise<void>>();
vi.mock("@/lib/sessions/nouvelles", () => ({ compterNouvellesSessions: () => compterNouvellesSessions(), marquerEvenementsVus: () => marquerEvenementsVus() }));
vi.mock("@/lib/sessions/actions", () => ({ chargerSessions: vi.fn(async () => ({ ok: true, sessions: [] })), sinscrire: vi.fn(), seDesinscrire: vi.fn() }));

const { SidebarNavLinks } = await import("@/components/layout/SidebarNav");
const { BoutonSessionsProgrammees } = await import("@/components/sessions/BoutonSessionsProgrammees");
const { PageEvenements } = await import("@/components/sessions/PageEvenements");
const { reinitialiserNouvellesSessions } = await import("@/components/sessions/useNouvellesSessions");

describe("Nouvelles sessions", () => {
  beforeEach(() => {
    reinitialiserNouvellesSessions();
    compterNouvellesSessions.mockReset().mockResolvedValue(2);
    marquerEvenementsVus.mockReset().mockResolvedValue(undefined);
  });

  it("le bouton « Sessions live programmées » : la pastille rouge compte les nouvelles et mène aux Événements", async () => {
    render(<BoutonSessionsProgrammees />);
    const bouton = await screen.findByRole("link", { name: "Sessions live programmées, 2 nouvelles" });
    expect(bouton).toHaveAttribute("href", "/evenements");
    expect(within(bouton).getByText("2")).toBeInTheDocument();
  });

  it("sans nouvelle session : le bouton, sans pastille", async () => {
    compterNouvellesSessions.mockResolvedValue(0);
    render(<BoutonSessionsProgrammees />);
    await waitFor(() => expect(compterNouvellesSessions).toHaveBeenCalled());
    expect(screen.getByRole("link", { name: "Sessions live programmées" })).toBeInTheDocument();
  });

  it("l'entrée Événements du menu porte la même pastille", async () => {
    render(<SidebarNavLinks pathname="/accueil" />);
    const evenements = await screen.findByRole("link", { name: "Événements, 2 nouvelles sessions" });
    expect(within(evenements).getByText("2")).toBeInTheDocument();
  });

  it("ouvrir la page Événements remet le compteur à zéro", async () => {
    render(
      <>
        <BoutonSessionsProgrammees />
        <PageEvenements initial={[]} />
      </>,
    );
    await waitFor(() => expect(marquerEvenementsVus).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("link", { name: "Sessions live programmées" })).toBeInTheDocument());
  });
});
