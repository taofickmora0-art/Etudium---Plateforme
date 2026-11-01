// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { VueCarteSuivie } from "@/components/mes-formations/CarteSuivie";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/mes-formations" }));

const { MesFormations } = await import("@/components/mes-formations/MesFormations");

const vue = (o: Partial<VueCarteSuivie>): VueCarteSuivie => ({
  id: "f1",
  titre: "Maîtriser Microsoft Excel",
  resume: "Formules, tableaux croisés dynamiques et graphiques.",
  parcours: "academique",
  parcoursNom: "Académique",
  pourcentage: 68,
  temps: "2 h restantes",
  etat: "enCours",
  href: "/formations/maitriser-microsoft-excel/lecons/l4",
  favori: false,
  couverture: null,
  ...o,
});
const SUIVIES = [
  vue({}),
  vue({ id: "f2", titre: "Méthodologie du mémoire", pourcentage: 0, temps: "7 h 45 restantes", href: "/formations/methodologie-du-memoire/lecons/l1" }),
  vue({ id: "f3", titre: "Microsoft Word pour vos travaux universitaires", pourcentage: 100, etat: "terminee", temps: "4 h 10 suivies", favori: true }),
  vue({ id: "f4", titre: "Marketing digital pour débutants", pourcentage: 35, etat: "verrouillee", temps: "Accès fermé", href: null, parcours: "business" }),
];
const cartes = () => screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);

describe("Page Mes formations", () => {
  it("en-tête, filtres et cartes ; une formation verrouillée n'est pas un lien", () => {
    render(<MesFormations suivies={SUIVIES} />);
    expect(screen.getByRole("heading", { level: 1, name: "Mes formations" })).toBeInTheDocument();
    expect(screen.getByText("Les formations que vous avez commencées, de la plus récente à la plus ancienne.")).toBeInTheDocument();
    const filtres = screen.getByRole("group", { name: "Filtrer mes formations" });
    expect(within(filtres).getAllByRole("button").map((b) => b.textContent)).toEqual(["Toutes", "En cours", "Terminées", "Verrouillées", "Favoris"]);
    expect(within(filtres).getByRole("button", { name: "Toutes" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("link", { name: /Maîtriser Microsoft Excel/ })).toHaveAttribute("href", "/formations/maitriser-microsoft-excel/lecons/l4");
    // Le badge du parcours (liste du 31 octobre 2026, tâche 15).
    expect(within(screen.getByRole("link", { name: /Maîtriser Microsoft Excel/ })).getByText("Académique")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Marketing digital/ })).toBeNull();
    expect(screen.getByText("Marketing digital pour débutants")).toBeInTheDocument();
    expect(screen.getByText("Verrouillée")).toBeInTheDocument();
    expect(screen.getByText("Accès fermé")).toBeInTheDocument();
  });

  it("lot 5 C : une formation désactivée porte « Indisponible » et son explication, sans lien", () => {
    render(<MesFormations suivies={[vue({ etat: "verrouillee", indisponible: true, temps: "Momentanément indisponible", href: null })]} />);
    expect(screen.getByText("Indisponible")).toBeInTheDocument();
    expect(screen.queryByText("Verrouillée")).toBeNull();
    expect(screen.getByText("Momentanément indisponible")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Maîtriser Microsoft Excel/ })).toBeNull();
  });

  it("« En cours » montre aussi les formations à 0 % ; « Terminées », « Verrouillées », « Favoris »", async () => {
    render(<MesFormations suivies={SUIVIES} />);
    await userEvent.click(screen.getByRole("button", { name: "En cours" }));
    expect(cartes()).toEqual(["Maîtriser Microsoft Excel", "Méthodologie du mémoire"]);
    await userEvent.click(screen.getByRole("button", { name: "Terminées" }));
    expect(cartes()).toEqual(["Microsoft Word pour vos travaux universitaires"]);
    await userEvent.click(screen.getByRole("button", { name: "Verrouillées" }));
    expect(cartes()).toEqual(["Marketing digital pour débutants"]);
    await userEvent.click(screen.getByRole("button", { name: "Favoris" }));
    expect(cartes()).toEqual(["Microsoft Word pour vos travaux universitaires"]);
  });

  it("un filtre sans formation le dit", async () => {
    render(<MesFormations suivies={[vue({})]} />);
    await userEvent.click(screen.getByRole("button", { name: "Terminées" }));
    expect(screen.getByText("Aucune formation terminée pour le moment.")).toBeInTheDocument();
  });

  it("sans formation commencée : un état vide qui oriente vers le catalogue", () => {
    render(<MesFormations suivies={[]} />);
    expect(screen.getByRole("heading", { name: "Aucune formation commencée" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Parcourir le catalogue" })).toHaveAttribute("href", "/formations");
    expect(screen.queryByRole("group", { name: "Filtrer mes formations" })).toBeNull();
  });
});
