// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormationsEnAttente, SectionFormations } from "@/components/landing/SectionFormations";
import { SectionParcours } from "@/components/landing/SectionParcours";
import { CARTES_DESIGN } from "../catalogue/cartes-design";

describe("Les trois parcours (NdLanding §6)", () => {
  it("les trois parcours du lancement, avec les textes du design, sans attendre la base", () => {
    render(<SectionParcours />);
    const section = document.getElementById("parcours") as HTMLElement;
    expect(section).toHaveAttribute("aria-labelledby", "titre-parcours");
    expect(within(section).getByRole("heading", { level: 2 })).toHaveTextContent("Choisissez la direction qui vous ressemble");
    expect(within(section).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Réussite académique",
      "Compétences digitales",
      "Business & revenus en ligne",
    ]);
    expect(
      screen.getByText("Les outils et méthodes pour réussir à l’université : bureautique, recherche documentaire, rédaction scientifique, mémoire et soutenance."),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("list")).toHaveLength(3);
    for (const liste of screen.getAllByRole("list")) expect(within(liste).getAllByRole("listitem")).toHaveLength(6);
    for (const [nom, slug] of [
      ["Réussite académique", "reussite-academique"],
      ["Compétences digitales", "competences-digitales"],
      ["Business & revenus en ligne", "business-revenus-en-ligne"],
    ]) {
      expect(screen.getByRole("link", { name: `Voir les formations du parcours ${nom}` })).toHaveAttribute("href", `/formations?parcours=${slug}`);
    }
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

  it("pendant la lecture, la place des quatre cartes est réservée (les ancres plus bas ne bougent pas)", () => {
    render(<FormationsEnAttente />);
    const section = screen.getByRole("region", { name: "Pour bien commencer" });
    expect(section).toHaveAttribute("aria-busy", "true");
    expect(section.querySelectorAll("[data-carte-en-attente]")).toHaveLength(4);
  });

  it("aucune formation publiée : la section disparaît", () => {
    const { container } = render(<SectionFormations cartes={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
