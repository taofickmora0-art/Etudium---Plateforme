// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { VueCarteSuivie } from "@/components/mes-formations/CarteSuivie";
import { FILTRES_PAR_DEFAUT } from "@/lib/catalogue/filtres";
import { CARTES_DESIGN, PARCOURS_DESIGN } from "./cartes-design";

// La page Formations du compte connecté (spec Formations et Événements, §2) : « Mes formations » sur une ligne, puis
// toutes les formations.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/formations" }));

const { Catalogue } = await import("@/components/catalogue/Catalogue");
const { ListeMesFormations } = await import("@/components/catalogue/ListeMesFormations");

const vue = (n: number, o: Partial<VueCarteSuivie> = {}): VueCarteSuivie => ({
  id: `f${n}`,
  titre: `Formation ${n}`,
  resume: "Résumé.",
  parcours: "academique",
  pourcentage: 40,
  temps: "2 h restantes",
  etat: "enCours",
  href: `/formations/formation-${n}/lecons/l1`,
  favori: false,
  couverture: null,
  ...o,
});

describe("Rangée « Mes formations »", () => {
  it("6 cartes au plus, sur une seule ligne, et « Voir plus » vers la liste complète", () => {
    render(<ListeMesFormations suivies={Array.from({ length: 8 }, (_, i) => vue(i + 1))} />);
    const section = screen.getByRole("region", { name: "Mes formations" });
    const liste = within(section).getByRole("list", { name: "Mes formations" });
    expect(within(liste).getAllByRole("listitem")).toHaveLength(6);
    expect(liste.className).toContain("grid-flow-col");
    const voirPlus = within(section).getByRole("link", { name: "Voir plus" });
    expect(voirPlus).toHaveAttribute("href", "/mes-formations");
    // Harmonisé (demande du 2 novembre 2026) : un simple lien, sans flèche, comme « Voir les événements ».
    expect(voirPlus.querySelector("svg")).toBeNull();
    expect(within(liste).getByRole("link", { name: /Formation 1/ })).toHaveAttribute("href", "/formations/formation-1/lecons/l1");
  });

  it("chaque carte dit où on en est : pourcentage, terminée ou accès fermé", () => {
    render(
      <ListeMesFormations
        suivies={[vue(1, { pourcentage: 42 }), vue(2, { pourcentage: 100, etat: "terminee" }), vue(3, { etat: "verrouillee", href: null, temps: "Accès fermé" })]}
      />,
    );
    const liste = screen.getByRole("list", { name: "Mes formations" });
    expect(within(liste).getByText("42 %")).toBeInTheDocument();
    expect(within(liste).getByText("Terminée")).toBeInTheDocument();
    expect(within(liste).getByText("Accès fermé")).toBeInTheDocument();
    expect(within(liste).getAllByRole("progressbar")).toHaveLength(3);
    // Sans adresse (formation archivée), la carte n'est pas un lien.
    expect(within(liste).queryByRole("link", { name: /Formation 3/ })).toBeNull();
  });

  it("aucune formation commencée : pas de rangée", () => {
    const { container } = render(<ListeMesFormations suivies={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("Page Formations (compte connecté)", () => {
  const afficher = (chemin: "/formations" | "/formations-gratuites", rangee?: React.ReactNode) =>
    render(
      <Catalogue
        cartes={CARTES_DESIGN}
        parcours={PARCOURS_DESIGN}
        filtresInitiaux={FILTRES_PAR_DEFAUT}
        variante="connecte"
        chemin={chemin}
        rangee={rangee}
        imposer={chemin === "/formations-gratuites" ? { acces: "gratuites", parcours: "tous" } : undefined}
      />,
    );

  it("titre « Formations », la rangée avant la recherche, puis « Toutes les formations » en grille de 5 colonnes au plus", () => {
    afficher("/formations", <p>Rangée</p>);
    expect(screen.getByRole("heading", { level: 1, name: "Formations" })).toBeInTheDocument();
    const toutes = screen.getByRole("heading", { level: 2, name: "Toutes les formations" });
    const rangee = screen.getByText("Rangée");
    const recherche = screen.getByRole("searchbox", { name: "Rechercher une formation" });
    expect(rangee.compareDocumentPosition(toutes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(toutes.compareDocumentPosition(recherche) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const grille = screen.getByRole("link", { name: /Maîtriser Microsoft Excel/ }).closest("[class*='grid-cols']");
    expect(grille?.className).toContain("(100%-80px)/5");
  });

  it("Formations gratuites garde son titre, sans rangée", () => {
    afficher("/formations-gratuites");
    expect(screen.getByRole("heading", { level: 1, name: "Formations gratuites" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Toutes les formations" })).toBeNull();
  });
});
