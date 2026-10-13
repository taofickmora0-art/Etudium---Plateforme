// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { tableauDeBord } from "@/lib/accueil/regles";
import type { FicheFormation } from "@/lib/catalogue/types";
import { formationsSuivies } from "@/lib/mes-formations/regles";
import type { LigneProgression } from "@/lib/progression/types";
import { CARTES_DESIGN } from "../catalogue/cartes-design";
import { EXCEL_OUVERTE, id, ZOTERO } from "../lecon/donnees";

const { TableauDeBord } = await import("@/components/accueil/TableauDeBord");

const ligne = (formationId: string, n: number, terminee: boolean, ilYa: number): LigneProgression => ({
  leconId: id(n),
  formationId,
  termineeLe: terminee ? "2026-10-12T10:00:00Z" : null,
  vueLe: new Date(Date.UTC(2026, 9, 13, 12) - ilYa * 60_000).toISOString(),
  positionSecondes: 0,
});
const ZOTERO_OUVERTE: FicheFormation = { ...ZOTERO, modules: ZOTERO.modules.map((m) => ({ ...m, lecons: m.lecons.map((l) => ({ ...l, accessible: true })) })) };
const monter = (fiches: FicheFormation[], lignes: LigneProgression[]) =>
  render(<TableauDeBord donnees={tableauDeBord(formationsSuivies(fiches.map((f) => ({ ...f, statut: "publiee" as const })), lignes, new Set()), CARTES_DESIGN)} />);
// Excel : leçon 1 terminée, leçon 2 ouverte (8 %), visitée après Zotero, dont la leçon 21 est ouverte (0 %).
const DEUX_EN_COURS: [FicheFormation[], LigneProgression[]] = [
  [EXCEL_OUVERTE, ZOTERO_OUVERTE],
  [ligne(EXCEL_OUVERTE.id, 1, true, 20), ligne(EXCEL_OUVERTE.id, 2, false, 10), ligne(ZOTERO.id, 21, false, 30)],
];

describe("Tableau de bord", () => {
  it("les tuiles : progression globale et formations en cours", () => {
    monter(...DEUX_EN_COURS);
    expect(screen.getByText("Progression globale")).toBeInTheDocument();
    expect(screen.getByText("4 %")).toBeInTheDocument();
    expect(screen.getByText("Moyenne de vos formations commencées")).toBeInTheDocument();
    expect(screen.getByText("Formations en cours")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Sur 2 formations commencées")).toBeInTheDocument();
  });

  it("« Continuer l’apprentissage » : la dernière formation, en un clic", () => {
    monter(...DEUX_EN_COURS);
    const bloc = screen.getByRole("region", { name: "Continuer l’apprentissage" });
    expect(within(bloc).getByRole("link", { name: "Mes formations" })).toHaveAttribute("href", "/mes-formations");
    expect(within(bloc).getByRole("heading", { level: 3, name: "Maîtriser Microsoft Excel" })).toBeInTheDocument();
    expect(within(bloc).getByText("Module 1 · Saisir et mettre en forme des données · 13 min")).toBeInTheDocument();
    expect(within(bloc).getByText("Académique")).toBeInTheDocument();
    expect(within(bloc).getByRole("progressbar", { name: "Progression de Maîtriser Microsoft Excel" })).toHaveAttribute("aria-valuenow", "8");
    expect(within(bloc).getByText("8 % terminé")).toBeInTheDocument();
    expect(within(bloc).getByText("2 h 14 restantes")).toBeInTheDocument();
    const reprendre = within(bloc).getByRole("link", { name: "Reprendre la leçon" });
    expect(reprendre).toHaveAttribute("href", `/formations/maitriser-microsoft-excel/lecons/${id(2)}`);
    expect(reprendre).toHaveAccessibleDescription("Maîtriser Microsoft Excel");
    expect(within(bloc).getByRole("link", { name: "Voir le parcours" })).toHaveAttribute("href", "/parcours");
  });

  it("« À faire » : la leçon suivante des autres formations en cours", () => {
    monter(...DEUX_EN_COURS);
    const bloc = screen.getByRole("region", { name: "À faire" });
    expect(within(bloc).getByText("1 élément")).toBeInTheDocument();
    const lien = within(bloc).getByRole("link", { name: /Leçon suivante.*Zotero : gérer ses références · Installer Zotero/ });
    expect(lien).toHaveAttribute("href", `/formations/zotero-gerer-ses-references/lecons/${id(21)}`);
  });

  it("« Recommandé pour vous » : des cartes titrées en h3, et « Tout voir »", () => {
    monter(...DEUX_EN_COURS);
    const bloc = screen.getByRole("region", { name: "Recommandé pour vous" });
    expect(within(bloc).getByRole("link", { name: "Tout voir" })).toHaveAttribute("href", "/formations");
    expect(within(bloc).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Microsoft Word pour vos travaux universitaires",
      "PowerPoint : réussir sa soutenance",
      "Méthodologie du mémoire",
    ]);
  });

  it("rien commencé : l'état vide mène aux formations gratuites", () => {
    monter([], []);
    expect(screen.getByRole("heading", { name: "Commencez votre première formation" })).toBeInTheDocument();
    expect(screen.getByText("Les formations gratuites sont ouvertes à tous : choisissez-en une et suivez la première leçon.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voir les formations gratuites" })).toHaveAttribute("href", "/formations-gratuites");
    const gratuites = screen.getByRole("region", { name: "Formations gratuites" });
    expect(within(gratuites).getByRole("link", { name: "Tout voir" })).toHaveAttribute("href", "/formations-gratuites");
    expect(within(gratuites).getAllByRole("heading", { level: 3 })).toHaveLength(2);
    expect(screen.queryByText("Progression globale")).toBeNull();
    expect(screen.queryByRole("region", { name: "Continuer l’apprentissage" })).toBeNull();
  });

  it("plus rien en cours : les tuiles et les recommandations, sans « Continuer » ni « À faire »", () => {
    monter([ZOTERO_OUVERTE], [ligne(ZOTERO.id, 21, true, 30), ligne(ZOTERO.id, 22, true, 20)]);
    expect(screen.getByText("100 %")).toBeInTheDocument();
    expect(screen.getByText("Sur 1 formation commencée")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Continuer l’apprentissage" })).toBeNull();
    expect(screen.queryByRole("region", { name: "À faire" })).toBeNull();
    expect(screen.getByRole("region", { name: "Recommandé pour vous" })).toBeInTheDocument();
  });

  it("une formation hors parcours : ni étiquette ni « Voir le parcours »", () => {
    monter([{ ...EXCEL_OUVERTE, parcours: [] }], [ligne(EXCEL_OUVERTE.id, 2, false, 10)]);
    const bloc = screen.getByRole("region", { name: "Continuer l’apprentissage" });
    expect(within(bloc).queryByText("Académique")).toBeNull();
    expect(within(bloc).queryByRole("link", { name: "Voir le parcours" })).toBeNull();
    expect(within(bloc).getByRole("link", { name: "Reprendre la leçon" })).toBeInTheDocument();
  });
});
