// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { ParcoursAdmin } from "@/lib/admin/types";

// La page Parcours du back-office (demande du 2 novembre 2026, option A) : une carte par parcours, avec ses chiffres et
// sa part des apprenants ; on les range en les faisant glisser.

vi.mock("@/lib/admin/actions", () => ({ rangerParcours: vi.fn(async () => ({ ok: true })) }));

const { GrilleParcours } = await import("@/components/admin/parcours/GrilleParcours");
const { versStatistiquesParcours } = await import("@/lib/admin/parcours-chiffres");

const parcours = (id: string, nom: string, couleur: ParcoursAdmin["couleur"], actif = true): ParcoursAdmin => ({
  id,
  slug: id,
  nom,
  nomCourt: nom,
  description: `Description de ${nom}`,
  couleur,
  ordre: 0,
  actif,
});
const LISTE = [parcours("p1", "Réussite académique", "academique"), parcours("p2", "Compétences digitales", "digital"), parcours("p3", "Business", "business", false)];
const STATS = versStatistiquesParcours({
  totaux: { parcours_actifs: 2, formations_publiees: 18, apprenants: 400, certificats: 96 },
  parcours: [
    { id: "p1", formations_publiees: 8, formations_brouillons: 2, apprenants: 200, certificats: 54 },
    { id: "p2", formations_publiees: 1, formations_brouillons: 0, apprenants: 1, certificats: 0 },
  ],
});

const afficher = (stats: typeof STATS | null = STATS) =>
  render(
    <ToastProvider>
      <GrilleParcours parcours={LISTE} stats={stats} />
    </ToastProvider>,
  );

describe("Les chiffres des parcours", () => {
  it("la conversion : les champs de la base ; un parcours absent n'a pas de chiffres", () => {
    expect(STATS.totaux).toEqual({ parcoursActifs: 2, formationsPubliees: 18, apprenants: 400, certificats: 96 });
    expect(STATS.parParcours.p1).toEqual({ formationsPubliees: 8, formationsBrouillons: 2, apprenants: 200, certificats: 54 });
    expect(STATS.parParcours.p3).toBeUndefined();
    expect(versStatistiquesParcours(null)).toEqual({ totaux: { parcoursActifs: 0, formationsPubliees: 0, apprenants: 0, certificats: 0 }, parParcours: {} });
  });
});

describe("La grille des parcours", () => {
  it("une carte par parcours, dans l'ordre : son lien, ses chiffres, sa part des apprenants", () => {
    afficher();
    const cartes = screen.getAllByRole("listitem");
    expect(cartes).toHaveLength(3);
    const premiere = within(cartes[0]);
    expect(premiere.getByRole("link", { name: "Réussite académique" })).toHaveAttribute("href", "/admin/parcours/p1");
    expect(premiere.getByText("Description de Réussite académique")).toBeInTheDocument();
    expect(premiere.getAllByTestId("chiffre-parcours").map((c) => c.textContent)).toEqual(["8 formations", "200 apprenants", "54 certificats", "2 brouillons"]);
    expect(premiere.getByRole("progressbar", { name: "Part des apprenants de Réussite académique" })).toHaveAttribute("aria-valuenow", "50");
    expect(premiere.getByText("50 % des apprenants")).toBeInTheDocument();
    // Les formations et les apprenants mènent à leur onglet de la fiche du parcours.
    expect(premiere.getByRole("link", { name: "8 formations" })).toHaveAttribute("href", "/admin/parcours/p1?onglet=formations");
    expect(premiere.getByRole("link", { name: "200 apprenants" })).toHaveAttribute("href", "/admin/parcours/p1?onglet=apprenants");
    expect(within(cartes[1]).getAllByTestId("chiffre-parcours").map((c) => c.textContent)).toEqual(["1 formation", "1 apprenant", "0 certificat", "0 brouillon"]);
  });

  it("un parcours désactivé le dit ; chaque carte a sa poignée pour la déplacer (souris, toucher ou clavier)", () => {
    afficher();
    const cartes = screen.getAllByRole("listitem");
    expect(within(cartes[2]).getByText("Désactivé")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Déplacer « / }).map((b) => b.getAttribute("aria-label"))).toEqual([
      "Déplacer « Réussite académique »",
      "Déplacer « Compétences digitales »",
      "Déplacer « Business »",
    ]);
  });

  it("sans les chiffres (migration 0065 absente) : les cartes, sans chiffres", () => {
    afficher(null);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryAllByTestId("chiffre-parcours")).toEqual([]);
  });
});
