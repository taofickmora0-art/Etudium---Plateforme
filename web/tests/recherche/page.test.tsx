// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { VueCarteSuivie } from "@/components/mes-formations/CarteSuivie";
import { rechercher, type LeconTrouvable } from "@/lib/recherche/regles";
import { CARTES_DESIGN, PARCOURS_DESIGN } from "../catalogue/cartes-design";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/recherche" }));

const { PageRecherche } = await import("@/components/recherche/PageRecherche");

const excel = CARTES_DESIGN.find((c) => c.slug === "maitriser-microsoft-excel")!;
const LECONS: LeconTrouvable[] = [
  { id: "l1", titre: "Découvrir l’interface", dureeSecondes: 370, accessible: true, formation: { slug: excel.slug, titre: excel.titre }, module: { numero: 1, titre: "Bases d’Excel" } },
  { id: "l3", titre: "Les formules essentielles", dureeSecondes: 845, accessible: false, formation: { slug: excel.slug, titre: excel.titre }, module: { numero: 1, titre: "Bases d’Excel" } },
];
const SUIVIE: VueCarteSuivie = {
  id: excel.id,
  titre: excel.titre,
  resume: excel.resume,
  parcours: "academique",
  pourcentage: 68,
  temps: "2 h restantes",
  etat: "enCours",
  href: `/formations/${excel.slug}/lecons/l4`,
  favori: false,
};
const PARCOURS = PARCOURS_DESIGN.map((p) => ({ ...p, description: p.slug === "reussite-academique" ? "Bureautique et Excel pour réussir à l’université." : "" }));
const monter = (q: string, autres: Partial<Parameters<typeof PageRecherche>[0]> = {}) =>
  render(
    <PageRecherche
      q={q}
      resultats={q.trim() ? rechercher({ cartes: CARTES_DESIGN, parcours: PARCOURS, lecons: LECONS }, q) : null}
      cartes={CARTES_DESIGN}
      recommandees={CARTES_DESIGN.slice(0, 3)}
      suivies={new Map([[excel.id, SUIVIE]])}
      terminees={new Set(["l1"])}
      {...autres}
    />,
  );

describe("Page Recherche", () => {
  it("le formulaire : champ nommé avec la requête, bouton, effacer", () => {
    monter("excel");
    const formulaire = screen.getByRole("search");
    expect(within(formulaire).getByRole("searchbox", { name: "Rechercher une formation, un parcours ou une leçon" })).toHaveValue("excel");
    expect(within(formulaire).getByRole("button", { name: "Rechercher" })).toBeInTheDocument();
    expect(within(formulaire).getByRole("link", { name: "Effacer la recherche" })).toHaveAttribute("href", "/recherche");
  });

  it("les résultats par groupe, avec leur nombre ; la formation suivie montre sa progression", () => {
    monter("excel");
    expect(screen.getByText("4 résultats pour « excel »")).toBeInTheDocument();
    for (const [nom, n] of [["Formations", "1"], ["Parcours", "1"], ["Leçons", "2"]]) {
      const titre = screen.getByRole("heading", { level: 2, name: nom });
      expect(within(titre.parentElement!).getByText(n)).toBeInTheDocument();
    }
    const formations = screen.getByRole("heading", { level: 2, name: "Formations" }).closest("section")!;
    expect(within(formations).getByRole("link", { name: /Maîtriser Microsoft Excel/ })).toHaveAttribute("href", `/formations/${excel.slug}/lecons/l4`);
    expect(screen.getByText("68 % terminé")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Réussite académique/ })).toHaveAttribute("href", "/parcours");
  });

  it("une leçon ouverte mène à la leçon, une leçon fermée à la fiche ; « Terminée » si elle l'est", () => {
    monter("excel");
    const ouverte = screen.getByRole("link", { name: /Découvrir l’interface/ });
    expect(ouverte).toHaveAttribute("href", `/formations/${excel.slug}/lecons/l1`);
    expect(within(ouverte).getByText("Terminée")).toBeInTheDocument();
    expect(within(ouverte).getByText("Maîtriser Microsoft Excel · Module 1 : Bases d’Excel")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Les formules essentielles/ })).toHaveAttribute("href", `/formations/${excel.slug}`);
  });

  it("sans résultat : l'état vide, puis « Recommandé pour vous »", () => {
    monter("introuvable");
    expect(screen.getByRole("heading", { name: "Aucun résultat pour « introuvable »" })).toBeInTheDocument();
    expect(screen.getByText("Vérifiez l’orthographe ou essayez un mot plus général.")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Effacer la recherche" }).at(-1)).toHaveAttribute("href", "/recherche");
    expect(screen.getByRole("heading", { level: 2, name: "Recommandé pour vous" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tout voir" })).toHaveAttribute("href", "/formations");
  });

  it("sans requête : ni compteur ni bouton effacer, et des recommandations", () => {
    monter("");
    expect(screen.queryByText(/résultats? pour/)).toBeNull();
    expect(screen.queryByRole("link", { name: "Effacer la recherche" })).toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "Recommandé pour vous" })).toBeInTheDocument();
  });

  it("une requête avec du code s'affiche comme du texte", () => {
    const { container } = monter("<script>alert(1)</script>");
    expect(screen.getByRole("heading", { name: "Aucun résultat pour « <script>alert(1)</script> »" })).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
  });
});
