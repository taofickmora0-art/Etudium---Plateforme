// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rechercher } from "@/lib/recherche/regles";
import { CARTES_DESIGN, PARCOURS_DESIGN } from "../catalogue/cartes-design";
import { CATALOGUE, EXCEL, MEMOIRE, VENDRE } from "./fixtures";

// La recherche générale trouve aussi les livres de la Bibliothèque (spec du 3 novembre 2026, §6 ; étape C) : par leur
// titre, leur auteur ou leurs mots-clés, sans accents ni majuscules, dans une section « Livres ».

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/recherche" }));
vi.mock("@/lib/progression/data", () => ({ lireProgression: async () => [] }));
vi.mock("@/lib/inscriptions/data", () => ({ lireInscriptions: async () => [] }));
vi.mock("@/lib/recherche/data", () => ({ listLeconsPubliees: async () => [] }));
vi.mock("@/lib/catalogue/data", () => ({
  listCatalogue: async () => CARTES_DESIGN,
  listParcoursCatalogue: async () => PARCOURS_DESIGN.map((p) => ({ ...p, description: "" })),
  listFiches: async () => [],
}));
const lireCatalogue = vi.fn();
vi.mock("@/lib/bibliotheque/data", () => ({ lireCatalogue: () => lireCatalogue() }));

const { lireRecherche } = await import("@/lib/recherche/donnees");
const { PageRecherche } = await import("@/components/recherche/PageRecherche");

const PARCOURS = PARCOURS_DESIGN.map((p) => ({ ...p, description: "" }));
const LIVRES = [MEMOIRE, VENDRE, EXCEL];

describe("Les livres dans la recherche", () => {
  beforeEach(() => {
    lireCatalogue.mockReset().mockResolvedValue(CATALOGUE);
  });

  it("un livre se trouve par son titre, son auteur ou ses mots-clés, sans accents ni majuscules", () => {
    const trouves = (q: string) => rechercher({ cartes: [], parcours: [], lecons: [], livres: LIVRES }, q).livres.map((l) => l.slug);
    expect(trouves("MEMOIRE")).toEqual(["reussir-son-memoire"]);
    expect(trouves("mensah")).toEqual(["vendre-en-ligne"]);
    expect(trouves("tableur")).toEqual(["excel-pas-a-pas"]);
    expect(trouves("astronomie")).toEqual([]);
    const r = rechercher({ cartes: CARTES_DESIGN, parcours: PARCOURS, lecons: [], livres: LIVRES }, "excel");
    expect(r.livres.map((l) => l.slug)).toEqual(["excel-pas-a-pas"]);
    expect(r.total).toBe(r.formations.length + r.parcours.length + r.lecons.length + r.livres.length);
  });

  it("sans livres (sans la 0074) : la recherche d'avant", () => {
    expect(rechercher({ cartes: CARTES_DESIGN, parcours: PARCOURS, lecons: [] }, "excel").livres).toEqual([]);
  });

  it("les données : le catalogue de la Bibliothèque n'est lu que pour une requête ; absent ou illisible, aucun livre", async () => {
    expect((await lireRecherche("")).resultats).toBeNull();
    expect(lireCatalogue).not.toHaveBeenCalled();
    expect((await lireRecherche("mémoire")).resultats?.livres.map((l) => l.slug)).toEqual(["reussir-son-memoire"]);
    lireCatalogue.mockResolvedValue(null);
    expect((await lireRecherche("mémoire")).resultats?.livres).toEqual([]);
    lireCatalogue.mockRejectedValue(new Error("panne"));
    const espion = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await lireRecherche("excel")).resultats?.formations.length).toBeGreaterThan(0);
    espion.mockRestore();
  });

  it("la page : une section « Livres », chaque livre vers sa fiche", () => {
    render(
      <PageRecherche
        q="mémoire"
        resultats={rechercher({ cartes: CARTES_DESIGN, parcours: PARCOURS, lecons: [], livres: LIVRES }, "mémoire")}
        cartes={CARTES_DESIGN}
        recommandees={[]}
        suivies={new Map()}
        terminees={new Set()}
      />,
    );
    expect(screen.getByRole("searchbox", { name: "Rechercher une formation, un parcours, une leçon ou un livre" })).toHaveValue("mémoire");
    const section = screen.getByRole("region", { name: "Livres" });
    expect(within(section).getByRole("link", { name: /Réussir son mémoire/ })).toHaveAttribute("href", "/bibliotheque/reussir-son-memoire");
    expect(screen.getByText(/résultats? pour « mémoire »/)).toBeInTheDocument();
  });
});
