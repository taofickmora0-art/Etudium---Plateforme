// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FILTRES_PAR_DEFAUT } from "@/lib/catalogue/filtres";
import { CARTES_DESIGN, PARCOURS_DESIGN } from "./cartes-design";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/formations" }));

const { Catalogue } = await import("@/components/catalogue/Catalogue");

const afficher = (variante: "public" | "connecte", chemin: "/formations" | "/formations-gratuites" = "/formations", filtres = FILTRES_PAR_DEFAUT) =>
  render(<Catalogue cartes={CARTES_DESIGN} parcours={PARCOURS_DESIGN} filtresInitiaux={filtres} variante={variante} chemin={chemin} />);
const cartes = () => screen.queryAllByRole("link").filter((a) => a.getAttribute("href")?.startsWith("/formations/"));

describe("Catalogue des formations", () => {
  beforeEach(() => {
    push.mockReset();
    vi.spyOn(window.history, "replaceState");
  });

  it("le visiteur filtre par parcours et par accès, puis efface les filtres", async () => {
    afficher("public");
    expect(screen.getByRole("heading", { level: 1, name: "Toutes les formations" })).toBeInTheDocument();
    expect(screen.getByText("10 formations")).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole("group", { name: "Filtrer par parcours" })).getByRole("button", { name: "Business" }));
    await userEvent.click(within(screen.getByRole("group", { name: "Filtrer par accès" })).getByRole("button", { name: "Gratuites" }));
    expect(screen.getByText("Aucune formation ne correspond")).toBeInTheDocument();
    expect(screen.getByText("Essayez un autre mot-clé ou retirez un filtre.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Effacer les filtres" }));
    expect(cartes()).toHaveLength(10);
  });

  it("le compteur suit le filtre", async () => {
    afficher("public");
    await userEvent.click(within(screen.getByRole("group", { name: "Filtrer par parcours" })).getByRole("button", { name: "Académique" }));
    expect(screen.getByText("5 formations")).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole("group", { name: "Filtrer par accès" })).getByRole("button", { name: "Gratuites" }));
    expect(screen.getByText("1 formation")).toBeInTheDocument();
  });

  it("la recherche ignore accents et majuscules", async () => {
    afficher("public");
    await userEvent.type(screen.getByLabelText("Rechercher"), "ZOTÉRO");
    expect(cartes().map((a) => a.getAttribute("href"))).toEqual(["/formations/zotero-gerer-ses-references"]);
  });

  it("le niveau filtre, et seuls les niveaux présents sont proposés", async () => {
    afficher("public");
    const niveau = screen.getByLabelText("Niveau");
    expect(within(niveau).getAllByRole("option").map((o) => o.textContent)).toEqual(["Tous les niveaux", "Débutant", "Intermédiaire"]);
    await userEvent.selectOptions(niveau, "intermediaire");
    expect(screen.getByText("4 formations")).toBeInTheDocument();
  });

  it("l'adresse garde les filtres", async () => {
    afficher("public");
    await userEvent.click(within(screen.getByRole("group", { name: "Filtrer par parcours" })).getByRole("button", { name: "Digital" }));
    expect(window.history.replaceState).toHaveBeenLastCalledWith(null, "", "/formations?parcours=competences-digitales");
  });

  it("la carte publique porte la puce du parcours et le badge, sans note tant qu'il n'y a pas d'avis", () => {
    afficher("public");
    const excel = screen.getByRole("link", { name: /Maîtriser Microsoft Excel/ });
    expect(within(excel).getByText("Académique")).toBeInTheDocument();
    expect(within(excel).getByText("Populaire")).toBeInTheDocument();
    expect(within(excel).getByText("6 h 20")).toBeInTheDocument();
    expect(within(excel).getByText("Intermédiaire")).toBeInTheDocument();
    expect(within(excel).queryByText(/avis/)).toBeNull();
  });

  it("la carte connectée porte le seul badge, et le tri se choisit dans un menu", async () => {
    afficher("connecte");
    const excel = screen.getByRole("link", { name: /Maîtriser Microsoft Excel/ });
    expect(within(excel).queryByText("Académique")).toBeNull();
    expect(within(excel).getByText("Populaire")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Trier : parcours/ }));
    expect(screen.queryByRole("menuitemradio", { name: "Note des étudiants" })).toBeNull();
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Les plus récentes" }));
    expect(cartes()[0]).toHaveAttribute("href", "/formations/intelligence-artificielle-etudes");
  });

  it("en connecté, la puce Gratuites mène à la page des formations gratuites, et inversement", async () => {
    const { unmount } = afficher("connecte");
    await userEvent.click(within(screen.getByRole("group", { name: "Filtrer par parcours" })).getByRole("button", { name: "Gratuites" }));
    expect(push).toHaveBeenCalledWith("/formations-gratuites");
    unmount();
    afficher("connecte", "/formations-gratuites", { ...FILTRES_PAR_DEFAUT, acces: "gratuites" });
    expect(cartes()).toHaveLength(2);
    await userEvent.click(within(screen.getByRole("group", { name: "Filtrer par parcours" })).getByRole("button", { name: "Digital" }));
    expect(push).toHaveBeenLastCalledWith("/formations?parcours=competences-digitales");
  });
});
