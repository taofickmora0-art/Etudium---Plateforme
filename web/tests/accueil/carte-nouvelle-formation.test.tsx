// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CarteNouvelleFormation } from "@/components/accueil/CarteNouvelleFormation";
import type { CarteCatalogue } from "@/lib/catalogue/types";

// La carte « Nouvelle formation » du fil de l'Accueil (spec du nouvel Accueil, §2).

const FORMATION: CarteCatalogue = {
  id: "f1",
  slug: "prise-de-notes",
  titre: "La prise de notes efficace",
  resume: "Des méthodes simples pour ne rien perdre en cours.",
  niveau: "debutant",
  gratuite: false,
  badge: null,
  publieeLe: "2026-10-13T10:00:00Z",
  dureeSecondes: 3600,
  nbLecons: 6,
  parcours: [{ slug: "reussite-academique", nom: "Réussite académique", nomCourt: "Académique", couleur: "academique", ordre: 1, position: 1 }],
  note: null,
  nbAvis: 0,
  couverture: null,
};

describe("La carte « Nouvelle formation »", () => {
  it("l'étiquette, le moment, le titre, le résumé, le parcours et le lien vers la fiche ; pas de J’aime", () => {
    render(<CarteNouvelleFormation formation={FORMATION} maintenant={new Date("2026-10-15T12:00:00Z")} />);
    const carte = screen.getByRole("article", { name: "Nouvelle formation : La prise de notes efficace" });
    expect(within(carte).getByText("Nouvelle formation")).toBeInTheDocument();
    expect(within(carte).getByText(/il y a 2 jours/)).toBeInTheDocument();
    expect(within(carte).getByText("La prise de notes efficace")).toBeInTheDocument();
    expect(within(carte).getByText("Des méthodes simples pour ne rien perdre en cours.")).toBeInTheDocument();
    expect(within(carte).getByText(/Académique/)).toBeInTheDocument();
    expect(within(carte).getByRole("link", { name: "Découvrir la formation" })).toHaveAttribute("href", "/formations/prise-de-notes");
    expect(within(carte).queryByRole("button", { name: /J’aime/ })).toBeNull();
  });
});
