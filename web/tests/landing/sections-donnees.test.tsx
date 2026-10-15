// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SectionFormations } from "@/components/landing/SectionFormations";
import { SectionParcours } from "@/components/landing/SectionParcours";
import type { ParcoursCatalogue } from "@/lib/catalogue/types";
import { CARTES_DESIGN, PARCOURS_DESIGN } from "../catalogue/cartes-design";

const PARCOURS: ParcoursCatalogue[] = PARCOURS_DESIGN.map((p) => ({ ...p, description: `Description de ${p.nom} (base).` }));

describe("Les trois parcours (NdLanding §6)", () => {
  it("une carte par parcours actif : nom et description de la base, six points, lien vers le catalogue filtré", () => {
    render(<SectionParcours parcours={PARCOURS} />);
    const section = document.getElementById("parcours") as HTMLElement;
    expect(section).toHaveAttribute("aria-labelledby", "titre-parcours");
    expect(within(section).getByRole("heading", { level: 2 })).toHaveTextContent("Choisissez la direction qui vous ressemble");
    expect(within(section).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Réussite académique",
      "Compétences digitales",
      "Business & revenus en ligne",
    ]);
    expect(screen.getByText("Description de Réussite académique (base).")).toBeInTheDocument();
    expect(screen.getAllByRole("list")).toHaveLength(3);
    for (const liste of screen.getAllByRole("list")) expect(within(liste).getAllByRole("listitem")).toHaveLength(6);
    expect(screen.getByText("Zotero et la recherche documentaire")).toBeInTheDocument();
    for (const p of PARCOURS) {
      expect(screen.getByRole("link", { name: `Voir les formations du parcours ${p.nom}` })).toHaveAttribute("href", `/formations?parcours=${p.slug}`);
    }
  });

  it("un parcours ajouté plus tard garde sa carte, sans liste de points", () => {
    render(<SectionParcours parcours={[{ slug: "langues", nom: "Langues", nomCourt: "Langues", couleur: "digital", ordre: 4, description: "Anglais." }]} />);
    expect(screen.getByRole("heading", { level: 3, name: "Langues" })).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getByRole("link", { name: "Voir les formations du parcours Langues" })).toHaveAttribute("href", "/formations?parcours=langues");
  });

  it("sans parcours lus, la section garde son titre (l'ancre de l'en-tête reste valable)", () => {
    render(<SectionParcours parcours={[]} />);
    expect(document.getElementById("parcours")).not.toBeNull();
    expect(screen.queryAllByRole("heading", { level: 3 })).toHaveLength(0);
  });
});

describe("« Pour bien commencer » (NdLanding §8)", () => {
  it("quatre formations en cartes publiques, titres de niveau 3, et le lien vers tout le catalogue", () => {
    render(<SectionFormations cartes={CARTES_DESIGN} />);
    expect(screen.getByRole("heading", { level: 2, name: "Pour bien commencer" })).toBeInTheDocument();
    const titres = screen.getAllByRole("heading", { level: 3 });
    expect(titres).toHaveLength(4);
    for (const titre of titres) expect(titre.closest("a")?.getAttribute("href")).toMatch(/^\/formations\/[a-z0-9-]+$/);
    expect(screen.getByRole("link", { name: "Voir tout le catalogue" })).toHaveAttribute("href", "/formations");
  });

  it("aucune formation publiée : la section disparaît", () => {
    const { container } = render(<SectionFormations cartes={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
