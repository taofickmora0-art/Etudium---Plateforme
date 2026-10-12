// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { etatFormation } from "@/lib/progression/regles";
import type { LigneProgression } from "@/lib/progression/types";
import { EXCEL_OUVERTE, id } from "../lecon/donnees";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/formations/maitriser-microsoft-excel" }));

const { FicheConnectee } = await import("@/components/catalogue/FicheConnectee");

const ADRESSE = "/formations/maitriser-microsoft-excel/lecons";
const ligne = (n: number, terminee: boolean, ilYa: number): LigneProgression => ({
  leconId: id(n),
  formationId: EXCEL_OUVERTE.id,
  termineeLe: terminee ? "2026-10-12T10:00:00Z" : null,
  vueLe: new Date(Date.UTC(2026, 9, 13, 12) - ilYa * 60_000).toISOString(),
  positionSecondes: 0,
});

describe("Fiche connectée : progression", () => {
  it("formation commencée : pourcentage, temps restant, prochaine leçon et « Continuer »", () => {
    const progression = etatFormation(EXCEL_OUVERTE, [ligne(1, true, 40), ligne(2, true, 30), ligne(3, true, 20), ligne(4, false, 10)]);
    render(<FicheConnectee fiche={EXCEL_OUVERTE} progression={progression} />);
    expect(screen.getByText("Votre progression")).toBeInTheDocument();
    expect(screen.getByText("25 %")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Progression de la formation" })).toHaveAttribute("aria-valuenow", "25");
    expect(screen.getByText("1 h 47 restantes")).toBeInTheDocument();
    expect(screen.getByText("Prochaine leçon")).toBeInTheDocument();
    expect(screen.getByText("Module 1 · 10:40")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continuer" })).toHaveAttribute("href", `${ADRESSE}/${id(4)}`);
    expect(screen.queryByRole("link", { name: "Commencer" })).toBeNull();
  });

  it("le programme montre les leçons terminées, « Vous êtes ici » et l'état des modules", () => {
    const progression = etatFormation(EXCEL_OUVERTE, [ligne(1, true, 40), ligne(2, true, 30), ligne(3, true, 20), ligne(4, false, 10)]);
    render(<FicheConnectee fiche={EXCEL_OUVERTE} progression={progression} />);
    const programme = screen.getByRole("region", { name: "Programme" });
    expect(within(programme).getByRole("link", { name: /Découvrir l’interface.*terminée/ })).toBeInTheDocument();
    const ici = within(programme).getByRole("link", { name: /Références relatives et absolues/ });
    expect(within(ici).getByText("Vous êtes ici")).toBeInTheDocument();
    expect(within(programme).getByText("En cours")).toBeInTheDocument();
  });

  it("formation terminée : « Formation terminée » et « Revoir la formation »", () => {
    const tout = EXCEL_OUVERTE.modules.flatMap((m) => m.lecons).map((l, i) => ({ ...ligne(1, true, i), leconId: l.id }));
    render(<FicheConnectee fiche={EXCEL_OUVERTE} progression={etatFormation(EXCEL_OUVERTE, tout)} />);
    expect(screen.getByText("100 %")).toBeInTheDocument();
    expect(screen.getByText("Formation terminée")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Revoir la formation" })).toHaveAttribute("href", `${ADRESSE}/${id(1)}`);
    expect(screen.getAllByText("Terminé").length).toBeGreaterThan(0);
  });

  it("formation non commencée, ou sans progression en base : la carte de départ", () => {
    const { unmount } = render(<FicheConnectee fiche={{ ...EXCEL_OUVERTE, gratuite: true }} progression={etatFormation(EXCEL_OUVERTE, [])} />);
    expect(screen.queryByText("Votre progression")).toBeNull();
    expect(screen.getByRole("link", { name: "Commencer" })).toBeInTheDocument();
    unmount();
    render(<FicheConnectee fiche={{ ...EXCEL_OUVERTE, gratuite: true }} progression={null} />);
    expect(screen.getByRole("link", { name: "Commencer" })).toBeInTheDocument();
  });
});
