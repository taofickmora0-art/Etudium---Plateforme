// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LigneProgression } from "@/lib/progression/types";
import { EXCEL_OUVERTE, id, ZOTERO } from "../lecon/donnees";

const { cartesFavorites } = await import("@/components/favoris/cartes");

const ligne = (formationId: string, n: number, terminee: boolean): LigneProgression => ({
  leconId: id(n),
  formationId,
  termineeLe: terminee ? "2026-10-12T10:00:00Z" : null,
  vueLe: "2026-10-13T10:00:00Z",
  positionSecondes: 0,
});
const avec = <T extends object>(f: T, statut: "publiee" | "archivee") => ({ ...f, statut });
const BADGES = ["Populaire", "Gratuit", "Nouveau", "Complémentaire", "Verrouillée"];

describe("Cartes de la page Favoris", () => {
  it("dans l'ordre des favoris, sans badge (le cœur prend sa place) ; une formation commencée montre sa progression", () => {
    const favoris = cartesFavorites([ZOTERO.id, EXCEL_OUVERTE.id], [avec(EXCEL_OUVERTE, "publiee"), avec(ZOTERO, "publiee")], [ligne(EXCEL_OUVERTE.id, 1, false)]);
    expect(favoris.map((f) => f.titre)).toEqual(["Zotero : gérer ses références", "Maîtriser Microsoft Excel"]);
    render(<>{favoris.map((f) => <div key={f.id}>{f.carte}</div>)}</>);
    for (const badge of BADGES) expect(screen.queryByText(badge)).toBeNull();
    expect(screen.getByRole("link", { name: /Maîtriser Microsoft Excel/ })).toHaveAttribute("href", `/formations/maitriser-microsoft-excel/lecons/${id(1)}`);
    expect(screen.getByRole("link", { name: /Zotero/ })).toHaveAttribute("href", "/formations/zotero-gerer-ses-references");
  });

  it("archivée : montrée verrouillée, sans lien, si elle a été commencée ; retirée sinon", () => {
    const favoris = cartesFavorites([EXCEL_OUVERTE.id, ZOTERO.id], [avec(EXCEL_OUVERTE, "archivee"), avec(ZOTERO, "archivee")], [ligne(EXCEL_OUVERTE.id, 1, true)]);
    expect(favoris.map((f) => f.id)).toEqual([EXCEL_OUVERTE.id]);
    render(<>{favoris[0].carte}</>);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Accès fermé")).toBeInTheDocument();
    for (const badge of BADGES) expect(screen.queryByText(badge)).toBeNull();
  });
});
