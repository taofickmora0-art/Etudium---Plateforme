// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { FILTRES_BIBLIOTHEQUE_VIDES, type FiltresAdresseBibliotheque } from "@/lib/bibliotheque/regles";
import type { CatalogueBibliotheque } from "@/lib/bibliotheque/types";
import { choisirDansListe } from "../utilitaires/listes";
import { CATALOGUE, EXCEL, ID_VENDRE, lecture, MEMOIRE, VENDRE } from "./fixtures";

// La page Bibliothèque (spec du 3 novembre 2026, §2 ; étape B) : recherche, filtres en puces et par catégorie gardés dans
// l'adresse, « Continuer la lecture », cartes des livres avec leur cœur. Ouverte aux visiteurs (sans cœur ni reprise).

const ajouterFavoriLivre = vi.fn();
const retirerFavoriLivre = vi.fn();
vi.mock("@/lib/bibliotheque/actions", () => ({
  ajouterFavoriLivre: (...a: unknown[]) => ajouterFavoriLivre(...a),
  retirerFavoriLivre: (...a: unknown[]) => retirerFavoriLivre(...a),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/bibliotheque" }));

const { PageBibliotheque } = await import("@/components/bibliotheque/PageBibliotheque");

const afficher = (
  o: { variante?: "public" | "connecte"; catalogue?: CatalogueBibliotheque; filtres?: Partial<FiltresAdresseBibliotheque>; lectures?: typeof CATALOGUE.livres } = {},
) =>
  render(
    <ToastProvider>
      <PageBibliotheque
        variante={o.variante ?? "connecte"}
        catalogue={o.catalogue ?? CATALOGUE}
        filtresInitiaux={{ ...FILTRES_BIBLIOTHEQUE_VIDES, ...o.filtres }}
        lectures={o.lectures ?? []}
      />
    </ToastProvider>,
  );

const grille = () => screen.getByRole("list", { name: "Livres de la bibliothèque" });
const titresVisibles = () =>
  within(grille())
    .getAllByRole("heading")
    .map((h) => h.textContent);

describe("La page Bibliothèque", () => {
  const remplacer = vi.spyOn(window.history, "replaceState");
  beforeEach(() => {
    remplacer.mockClear();
    ajouterFavoriLivre.mockReset().mockResolvedValue({ ok: true });
    retirerFavoriLivre.mockReset().mockResolvedValue({ ok: true });
  });
  afterEach(() => remplacer.mockClear());

  it("le titre, la recherche, les filtres et une carte par livre : couverture, auteur, pages, accès", () => {
    afficher();
    expect(screen.getByRole("heading", { level: 1, name: "Bibliothèque" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Rechercher un livre" })).toBeInTheDocument();
    // Les puces : « Tous », les parcours qui ont des livres, « Gratuits ».
    const puces = within(screen.getByRole("group", { name: "Filtrer les livres" }))
      .getAllByRole("button")
      .map((b) => b.textContent);
    expect(puces).toEqual(["Tous", "Académique", "Business", "Gratuits"]);
    expect(screen.getByRole("combobox", { name: "Catégorie" })).toBeInTheDocument();
    expect(titresVisibles()).toEqual(["Réussir son mémoire", "Vendre en ligne", "Excel pas à pas"]);
    expect(screen.getByText("3 livres")).toHaveAttribute("role", "status");
    const memoire = screen.getByRole("link", { name: /Réussir son mémoire/ });
    expect(memoire).toHaveAttribute("href", "/bibliotheque/reussir-son-memoire");
    expect(within(memoire).getByText("Mireille Adjovi")).toBeInTheDocument();
    expect(within(memoire).getByText("120 pages")).toBeInTheDocument();
    expect(within(memoire).getByText("Inclus dans l’abonnement")).toBeInTheDocument();
    // La couverture d'un livre, en portrait, est montrée entière.
    expect(memoire.querySelector("[data-format='livre']")).not.toBeNull();
    const excel = screen.getByRole("link", { name: /Excel pas à pas/ });
    expect(within(excel).getByText("Gratuit")).toBeInTheDocument();
    expect(within(excel).getByText("1 page")).toBeInTheDocument();
  });

  it("un livre commencé montre sa progression ; les autres, « Voir le livre »", () => {
    afficher({ catalogue: { ...CATALOGUE, livres: [MEMOIRE, { ...EXCEL, lecture: lecture({ terminee: true, pourcentage: 100 }) }, VENDRE] } });
    expect(within(screen.getByRole("link", { name: /Réussir son mémoire/ })).getByText("42 % lus")).toBeInTheDocument();
    expect(within(screen.getByRole("link", { name: /Excel pas à pas/ })).getByText("Terminé")).toBeInTheDocument();
    expect(within(screen.getByRole("link", { name: /Vendre en ligne/ })).getByText("Voir le livre")).toBeInTheDocument();
  });

  it("le cœur met un livre en favori (ou l'en retire), hors du lien de la carte", async () => {
    afficher();
    const coeur = screen.getByRole("button", { name: "Ajouter « Réussir son mémoire » aux favoris" });
    expect(coeur).toHaveAttribute("aria-pressed", "false");
    expect(coeur.closest("a")).toBeNull();
    await userEvent.click(coeur);
    expect(ajouterFavoriLivre).toHaveBeenCalledWith(MEMOIRE.id);
    expect(coeur).toHaveAttribute("aria-pressed", "true");
    const vendre = screen.getByRole("button", { name: "Ajouter « Vendre en ligne » aux favoris" });
    expect(vendre).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(vendre);
    expect(retirerFavoriLivre).toHaveBeenCalledWith(ID_VENDRE);
  });

  it("les puces, la catégorie et la recherche filtrent tout de suite et restent dans l'adresse", async () => {
    const user = userEvent.setup();
    afficher();
    await user.click(screen.getByRole("button", { name: "Business" }));
    expect(titresVisibles()).toEqual(["Vendre en ligne"]);
    expect(remplacer).toHaveBeenLastCalledWith(null, "", "/bibliotheque?parcours=business");
    await user.click(screen.getByRole("button", { name: "Gratuits" }));
    expect(titresVisibles()).toEqual(["Vendre en ligne", "Excel pas à pas"]);
    expect(remplacer).toHaveBeenLastCalledWith(null, "", "/bibliotheque?gratuits=1");
    await user.click(screen.getByRole("button", { name: "Tous" }));
    await choisirDansListe("Catégorie", "Méthodes de travail", { user });
    expect(titresVisibles()).toEqual(["Réussir son mémoire"]);
    expect(remplacer).toHaveBeenLastCalledWith(null, "", "/bibliotheque?categorie=methodes");
    await choisirDansListe("Catégorie", "Toutes les catégories", { user });
    await user.type(screen.getByRole("searchbox", { name: "Rechercher un livre" }), "tableur");
    expect(titresVisibles()).toEqual(["Excel pas à pas"]);
    expect(remplacer).toHaveBeenLastCalledWith(null, "", "/bibliotheque?q=tableur");
  });

  it("les catégories proposées : celles qui ont des livres", async () => {
    const user = userEvent.setup();
    afficher();
    await user.click(screen.getByRole("combobox", { name: "Catégorie" }));
    const options = within(screen.getByRole("listbox"))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(options).toEqual(["Toutes les catégories", "Méthodes de travail", "Outils numériques"]);
  });

  it("les filtres de l'adresse s'appliquent au premier affichage", () => {
    afficher({ filtres: { parcours: "reussite-academique" } });
    expect(screen.getByRole("button", { name: "Académique" })).toHaveAttribute("aria-pressed", "true");
    expect(titresVisibles()).toEqual(["Réussir son mémoire"]);
  });

  it("« Continuer la lecture » : les livres commencés, qui mènent au lecteur ; absent quand un filtre est choisi", async () => {
    afficher({ lectures: [MEMOIRE] });
    const rangee = screen.getByRole("region", { name: "Continuer la lecture" });
    const lien = within(rangee).getByRole("link", { name: /Réussir son mémoire/ });
    expect(lien).toHaveAttribute("href", "/bibliotheque/reussir-son-memoire/lire");
    expect(within(lien).getByText("42 % lus")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Gratuits" }));
    expect(screen.queryByRole("region", { name: "Continuer la lecture" })).toBeNull();
  });

  it("sans livre commencé : pas de rangée « Continuer la lecture »", () => {
    afficher({ lectures: [] });
    expect(screen.queryByRole("region", { name: "Continuer la lecture" })).toBeNull();
  });

  it("aucun livre ne répond aux filtres : un état vide qui propose d'effacer les filtres", async () => {
    const user = userEvent.setup();
    afficher();
    await user.type(screen.getByRole("searchbox", { name: "Rechercher un livre" }), "astronomie");
    expect(screen.getByRole("heading", { name: "Aucun livre ne correspond" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Effacer les filtres" }));
    expect(titresVisibles()).toHaveLength(3);
    expect(screen.getByRole("searchbox", { name: "Rechercher un livre" })).toHaveValue("");
    expect(remplacer).toHaveBeenLastCalledWith(null, "", "/bibliotheque");
  });

  it("une bibliothèque encore vide le dit, sans filtres inutiles", () => {
    afficher({ catalogue: { livres: [], categories: [], parcours: [] } });
    expect(screen.getByRole("heading", { name: "Aucun livre pour le moment" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Catégorie" })).toBeNull();
    expect(screen.queryByRole("list", { name: "Livres de la bibliothèque" })).toBeNull();
  });

  it("un visiteur : le bandeau public, les cartes sans cœur et sans « Continuer la lecture »", () => {
    afficher({ variante: "public", lectures: [MEMOIRE] });
    expect(screen.getByRole("heading", { level: 1, name: "La bibliothèque Étudium" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /aux favoris/ })).toBeNull();
    expect(screen.queryByRole("region", { name: "Continuer la lecture" })).toBeNull();
    expect(titresVisibles()).toHaveLength(3);
  });
});
