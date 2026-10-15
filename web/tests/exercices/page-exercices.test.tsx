// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { ExerciceListe } from "@/lib/exercices/types";

// Lot 3, étape B : la page « Exercices » de l'étudiant (NdExercices), avec ses filtres.
const { ListeExercices } = await import("@/components/exercices/ListeExercices");

const il = (heures: number) => new Date(Date.now() - heures * 3600_000).toISOString();
const exercice = (o: Partial<ExerciceListe>): ExerciceListe => ({
  leconId: "l1",
  titre: "Tableau des ventes",
  genre: "rendu",
  formation: "Maîtriser Microsoft Excel",
  slug: "excel",
  module: "Analyse",
  moduleRang: 3,
  statut: "en_attente",
  version: 1,
  remarque: "",
  correcteur: null,
  corrigeLe: null,
  creeLe: il(2),
  ...o,
});
const LISTE = [
  exercice({ leconId: "l1", titre: "Tableau des ventes", statut: "a_corriger", remarque: "Il manque le filtre par produit.", correcteur: "Dr Mireille Adjovi", corrigeLe: il(48) }),
  exercice({ leconId: "l2", titre: "Graphique des ventes", statut: "en_attente" }),
  exercice({ leconId: "l3", titre: "Nettoyer une enquête", statut: "valide", moduleRang: 2, correcteur: "Dr Mireille Adjovi", corrigeLe: il(3) }),
];

describe("La page Exercices", () => {
  it("chaque exercice : la formation et le module, le statut, la remarque, le lien vers l'exercice", () => {
    render(<ListeExercices exercices={LISTE} />);
    const cartes = screen.getAllByRole("article");
    expect(cartes).toHaveLength(3);
    expect(cartes[0]).toHaveTextContent("Tableau des ventes");
    expect(cartes[0]).toHaveTextContent("Maîtriser Microsoft Excel · Module 3");
    expect(cartes[0]).toHaveTextContent("À corriger");
    expect(cartes[0]).toHaveTextContent("Retour reçu il y a 2 jours");
    expect(cartes[0]).toHaveTextContent("Remarque de Dr Mireille Adjovi");
    expect(cartes[0]).toHaveTextContent("Il manque le filtre par produit.");
    expect(within(cartes[0]).getByRole("link", { name: "Déposer une nouvelle version" })).toHaveAttribute("href", "/formations/excel/lecons/l1");
    expect(within(cartes[1]).getByRole("link", { name: "Graphique des ventes" })).toHaveAttribute("href", "/formations/excel/lecons/l2");
    expect(cartes[1]).toHaveTextContent("Déposé il y a 2 h");
    expect(cartes[2]).toHaveTextContent("Validé");
  });

  it("les filtres : À corriger, En attente, Validés ; un filtre vide le dit et ramène à tous", async () => {
    const user = userEvent.setup();
    render(<ListeExercices exercices={LISTE.filter((e) => e.statut !== "en_attente")} />);
    const filtres = screen.getByRole("group", { name: "Filtrer les exercices" });
    expect(within(filtres).getAllByRole("button").map((b) => b.textContent)).toEqual(["Tous", "À corriger", "En attente", "Validés"]);
    await user.click(within(filtres).getByRole("button", { name: "À corriger" }));
    expect(screen.getAllByRole("article").map((a) => within(a).getByRole("heading").textContent)).toEqual(["Tableau des ventes"]);
    await user.click(within(filtres).getByRole("button", { name: "En attente" }));
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.getByText("Aucun exercice en attente")).toBeInTheDocument();
    expect(screen.getByText("Après un dépôt, votre travail reste ici jusqu’à sa correction par votre formateur.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Voir tous les exercices" }));
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });

  it("aucun exercice rendu : un message et le lien vers les formations", () => {
    render(<ListeExercices exercices={[]} />);
    expect(screen.getByText("Aucun exercice pour le moment")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voir mes formations" })).toHaveAttribute("href", "/formations");
  });
});
