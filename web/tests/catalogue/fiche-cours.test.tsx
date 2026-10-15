// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { etatFormation } from "@/lib/progression/regles";
import type { LigneProgression } from "@/lib/progression/types";
import { EXCEL_OUVERTE, id } from "../lecon/donnees";

// La page du cours (refonte des formations, étape B, spec §2) : « Poursuivre le cours », « Progression du cours »,
// « Tout déplier / Tout replier », « Modifier les leçons ».
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
const COMMENCEE = () => etatFormation(EXCEL_OUVERTE, [ligne(1, true, 40), ligne(2, true, 30), ligne(3, true, 20), ligne(4, false, 10)]);

describe("La page du cours", () => {
  it("« Poursuivre le cours » en haut à droite et dans la carte ; « Progression du cours » : « Terminé 3 sur 12 » et 25 %", () => {
    render(<FicheConnectee fiche={EXCEL_OUVERTE} progression={COMMENCEE()} />);
    const liens = screen.getAllByRole("link", { name: "Poursuivre le cours" });
    expect(liens).toHaveLength(2);
    for (const lien of liens) expect(lien).toHaveAttribute("href", `${ADRESSE}/${id(4)}`);
    expect(screen.getByText("Progression du cours")).toBeInTheDocument();
    expect(screen.getByText("Terminé 3 sur 12")).toBeInTheDocument();
    expect(screen.getByText("25 %")).toBeInTheDocument();
  });

  it("pas encore commencée (formation gratuite) : « Commencer le cours » en haut", () => {
    render(<FicheConnectee fiche={{ ...EXCEL_OUVERTE, gratuite: true }} progression={null} />);
    expect(screen.getByRole("link", { name: "Commencer le cours" })).toHaveAttribute("href", `${ADRESSE}/${id(1)}`);
    expect(screen.queryByRole("link", { name: "Poursuivre le cours" })).toBeNull();
  });

  it("le programme : « 4 modules · 12 leçons », la durée de chaque module, « Tout déplier / Tout replier »", async () => {
    render(<FicheConnectee fiche={EXCEL_OUVERTE} progression={COMMENCEE()} />);
    const programme = screen.getByRole("region", { name: "Programme" });
    expect(within(programme).getByText(/^4 modules · 12 leçons/)).toBeInTheDocument();
    expect(within(programme).getByText("4 leçons · 43 min")).toBeInTheDocument();
    const modules = () => within(programme).getAllByRole("button", { name: /^Module/ }).map((b) => b.getAttribute("aria-expanded"));
    expect(modules()).toEqual(["true", "false", "false", "false"]);
    await userEvent.click(within(programme).getByRole("button", { name: "Tout déplier" }));
    expect(modules()).toEqual(["true", "true", "true", "true"]);
    await userEvent.click(within(programme).getByRole("button", { name: "Tout replier" }));
    expect(modules()).toEqual(["false", "false", "false", "false"]);
  });

  it("« Modifier les leçons » : seulement quand la page le donne (l'équipe, le formateur de la formation)", () => {
    const { unmount } = render(<FicheConnectee fiche={EXCEL_OUVERTE} lienModifier="/admin/formations/f1?onglet=programme" />);
    expect(screen.getByRole("link", { name: "Modifier les leçons" })).toHaveAttribute("href", "/admin/formations/f1?onglet=programme");
    unmount();
    render(<FicheConnectee fiche={EXCEL_OUVERTE} />);
    expect(screen.queryByRole("link", { name: "Modifier les leçons" })).toBeNull();
  });
});
