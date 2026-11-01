// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SectionFormules } from "@/components/landing/SectionFormules";
import type { Formule } from "@/lib/abonnement/types";

// Les formules de la page d'accueil (lot 2, spec §6) : le prix fixé au back-office, sinon « Prix annoncés au
// lancement » ; « Choisir » mène à la création du compte, puis à la souscription.

const FORMULES: Formule[] = [
  { id: "a", code: "basique", nom: "Basique", dureeMois: 3, prix: null, recommandee: false, active: true },
  { id: "b", code: "standard", nom: "Standard", dureeMois: 6, prix: 15000, recommandee: true, active: true },
  { id: "c", code: "premium", nom: "Premium", dureeMois: 12, prix: 25000, recommandee: false, active: true },
];
const carte = (nom: string) => screen.getByRole("heading", { level: 3, name: nom }).closest("div[data-formule]") as HTMLElement;

describe("Les formules de la page d'accueil", () => {
  it("le prix fixé et sa durée, sinon « Prix annoncés au lancement »", () => {
    render(<SectionFormules formules={FORMULES} />);
    expect(carte("Standard")).toHaveTextContent("15 000 FCFA");
    expect(carte("Standard")).toHaveTextContent("pour 6 mois");
    expect(carte("Premium")).toHaveTextContent("pour 1 an");
    expect(carte("Basique")).toHaveTextContent("Prix annoncés au lancement");
    expect(screen.getAllByText("Prix annoncés au lancement")).toHaveLength(1);
  });

  it("« Choisir » : créer son compte, puis revenir à la souscription de cet abonnement", () => {
    render(<SectionFormules formules={FORMULES} />);
    expect(within(carte("Premium")).getByRole("link", { name: "Choisir Premium" })).toHaveAttribute(
      "href",
      `/inscription?next=${encodeURIComponent("/abonnement/souscrire?formule=premium")}`,
    );
    expect(within(carte("Standard")).getByRole("link", { name: "Choisir Standard" })).toBeInTheDocument();
  });

  it("sans lecture possible : les textes des trois formules, sans prix", () => {
    render(<SectionFormules formules={[]} />);
    expect(screen.getAllByText("Prix annoncés au lancement")).toHaveLength(3);
    expect(screen.getByText("Recommandée")).toBeInTheDocument();
  });
});
