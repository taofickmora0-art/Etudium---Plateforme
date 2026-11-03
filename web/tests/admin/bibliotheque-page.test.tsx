// @vitest-environment jsdom
import { render as rendre, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { BibliothequeAdmin, CategorieRangee, LivreAdmin } from "@/lib/bibliotheque/types";

// La page Bibliothèque du back-office (spec du 3 novembre 2026, étape A) : les chiffres clés, le filtre par état, une
// carte par livre avec son menu ⋮ (Modifier, Publier, Archiver, Republier, Supprimer le brouillon) ; la fenêtre
// « Catégories » (créer, renommer, ranger, supprimer) ; les boutons d'état de la fiche d'un livre.

const changerStatutLivre = vi.fn();
const supprimerLivre = vi.fn();
const enregistrerCategorie = vi.fn();
const supprimerCategorie = vi.fn();
const rangerCategorie = vi.fn();
vi.mock("@/lib/bibliotheque/actions", () => ({
  changerStatutLivre: (...a: unknown[]) => changerStatutLivre(...a),
  supprimerLivre: (...a: unknown[]) => supprimerLivre(...a),
  enregistrerCategorie: (...a: unknown[]) => enregistrerCategorie(...a),
  supprimerCategorie: (...a: unknown[]) => supprimerCategorie(...a),
  rangerCategorie: (...a: unknown[]) => rangerCategorie(...a),
}));
const routeur = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => routeur, usePathname: () => "/admin/bibliotheque" }));

const { VueBibliotheque } = await import("@/components/admin/bibliotheque/VueBibliotheque");
const { GestionCategories } = await import("@/components/admin/bibliotheque/Categories");
const { BarreEtatLivre } = await import("@/components/admin/bibliotheque/BarreEtatLivre");

const render = (ui: React.ReactNode) => rendre(<ToastProvider>{ui}</ToastProvider>);

const livre = (id: string, titre: string, plus: Partial<LivreAdmin> = {}): LivreAdmin => ({
  id,
  slug: id,
  titre,
  auteur: "Dr Mireille Adjovi",
  resume: `Résumé de ${titre}`,
  langue: "fr",
  annee: 2025,
  motsCles: [],
  nbPages: 120,
  categorie: { id: "c1", slug: "methodes", nom: "Méthodes de travail" },
  parcours: [{ id: "p1", slug: "reussite-academique", nom: "Réussite académique", nomCourt: "Académique", couleur: "academique" }],
  fichier: `${id}/fichier.pdf`,
  tailleOctets: 1_200_000,
  couverture: null,
  acces: "abonnes",
  telechargeable: false,
  droitsConfirmes: true,
  statut: "publie",
  creeLe: null,
  modifieLe: null,
  publieLe: "2026-11-01T08:00:00Z",
  lectures: 12,
  lecturesTerminees: 3,
  lectures30j: 4,
  telechargements: 0,
  telechargements30j: 0,
  favoris: 2,
  formations: 1,
  ...plus,
});

const DONNEES: BibliothequeAdmin = {
  totaux: { publies: 1, brouillons: 1, archives: 1, lectures: 1234, lectures30j: 50, telechargements: 7, telechargements30j: 2 },
  livres: [
    livre("l1", "Réussir son mémoire"),
    livre("l2", "Guide du stage", { statut: "brouillon", publieLe: null, fichier: null, droitsConfirmes: false, nbPages: null, lectures: 0, auteur: "", categorie: null, parcours: [] }),
    livre("l3", "Modèle de CV", { statut: "archive", acces: "gratuit", telechargeable: true, telechargements: 7, lectures: 1 }),
  ],
};

const user = () => userEvent.setup();
const tuile = (nom: string) => [...document.querySelectorAll("[data-tuile]")].find((t) => t.textContent?.startsWith(nom))?.textContent;
const carte = (titre: string) => within(screen.getAllByRole("listitem").find((li) => within(li).queryByRole("heading", { name: titre }))!);
const ouvrirMenu = async (u: ReturnType<typeof userEvent.setup>, titre: string) => {
  await u.click(screen.getByRole("button", { name: `Actions pour « ${titre} »` }));
  return screen.getByRole("menu");
};
const entrees = (menu: HTMLElement) => within(menu).getAllByRole("menuitem").map((e) => e.textContent);

beforeEach(() => {
  for (const f of [changerStatutLivre, supprimerLivre, enregistrerCategorie, supprimerCategorie, rangerCategorie, routeur.push, routeur.refresh]) f.mockReset();
});

describe("La page Bibliothèque", () => {
  it("les chiffres clés : livres publiés, brouillons, lectures, téléchargements", () => {
    render(<VueBibliotheque donnees={DONNEES} />);
    expect(tuile("Livres publiés")).toBe("Livres publiés1");
    expect(tuile("Brouillons")).toBe("Brouillons1");
    expect(tuile("Lectures")).toBe(`Lectures${(1234).toLocaleString("fr-FR")}`);
    expect(tuile("Téléchargements")).toBe("Téléchargements7");
  });

  it("une carte par livre : lien vers sa fiche, auteur, état et accès sur la couverture, pages et lectures, ce qui manque pour publier", () => {
    render(<VueBibliotheque donnees={DONNEES} />);
    const memoire = carte("Réussir son mémoire");
    expect(memoire.getByRole("link", { name: /Réussir son mémoire/ })).toHaveAttribute("href", "/admin/bibliotheque/l1");
    expect(memoire.getByTestId("auteur-livre").textContent).toBe("Dr Mireille Adjovi");
    expect(memoire.getByText("Publié")).toBeInTheDocument();
    expect(memoire.getByText("Inclus dans l’abonnement")).toBeInTheDocument();
    expect(memoire.getByTestId("meta-livre").textContent).toBe("120 pages · 12 lectures");
    expect(memoire.getByText("Lecture dans le site")).toBeInTheDocument();
    expect(memoire.getByText("Méthodes de travail")).toBeInTheDocument();
    const stage = carte("Guide du stage");
    expect(stage.getByText("Brouillon")).toBeInTheDocument();
    expect(stage.getByTestId("auteur-livre").textContent).toBe("Auteur non renseigné");
    expect(stage.getByTestId("meta-livre").textContent).toBe("0 lecture");
    expect(stage.getByText("PDF à déposer")).toBeInTheDocument();
    expect(stage.getByText("Droits à confirmer")).toBeInTheDocument();
    const cv = carte("Modèle de CV");
    expect(cv.getByText("Archivé")).toBeInTheDocument();
    expect(cv.getByText("Gratuit")).toBeInTheDocument();
    expect(cv.getByText("7 téléchargements")).toBeInTheDocument();
    // La couverture d'un livre : le format « livre » (image entière), sur la teinte du parcours.
    expect(document.querySelectorAll('[data-format="livre"]')).toHaveLength(3);
  });

  it("le filtre par état garde les chiffres du haut", async () => {
    const u = user();
    render(<VueBibliotheque donnees={DONNEES} />);
    await u.click(screen.getByRole("button", { name: "Brouillons" }));
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Guide du stage"]);
    expect(tuile("Livres publiés")).toBe("Livres publiés1");
    await u.click(screen.getByRole("button", { name: "Archivés" }));
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Modèle de CV"]);
    await u.click(screen.getByRole("button", { name: "Tous" }));
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(3);
  });

  it("le filtre de l'adresse (?etat=publie) est repris ; un état sans livre le dit", async () => {
    render(<VueBibliotheque donnees={{ ...DONNEES, livres: [DONNEES.livres[0]] }} filtreInitial="archive" />);
    expect(screen.getByText("Aucun livre archivé")).toBeInTheDocument();
  });

  it("sans livre : une invitation à en ajouter un", () => {
    render(<VueBibliotheque donnees={{ ...DONNEES, livres: [] }} />);
    expect(screen.getByText("Aucun livre pour le moment")).toBeInTheDocument();
  });
});

describe("Le menu ⋮ d'une carte", () => {
  it("brouillon : Modifier, Publier, Supprimer le brouillon ; publié : Modifier, Archiver ; archivé : Modifier, Republier", async () => {
    const u = user();
    render(<VueBibliotheque donnees={DONNEES} />);
    expect(entrees(await ouvrirMenu(u, "Guide du stage"))).toEqual(["Modifier", "Publier", "Supprimer le brouillon"]);
    await u.keyboard("{Escape}");
    expect(entrees(await ouvrirMenu(u, "Réussir son mémoire"))).toEqual(["Modifier", "Archiver"]);
    await u.keyboard("{Escape}");
    const menu = await ouvrirMenu(u, "Modèle de CV");
    expect(entrees(menu)).toEqual(["Modifier", "Republier"]);
    expect(within(menu).getByRole("menuitem", { name: "Modifier" })).toHaveAttribute("href", "/admin/bibliotheque/l3");
  });

  it("Publier : la fenêtre, puis la base ; son refus reste affiché dans la fenêtre", async () => {
    const u = user();
    changerStatutLivre.mockResolvedValueOnce({ ok: false, message: "Déposez le PDF du livre avant de le publier." });
    render(<VueBibliotheque donnees={DONNEES} />);
    await u.click(within(await ouvrirMenu(u, "Guide du stage")).getByRole("menuitem", { name: "Publier" }));
    const fenetre = screen.getByRole("dialog", { name: "Publier ce livre ?" });
    await u.click(within(fenetre).getByRole("button", { name: "Publier" }));
    expect(changerStatutLivre).toHaveBeenCalledWith("l2", "publie");
    expect(await within(fenetre).findByText("Déposez le PDF du livre avant de le publier.")).toBeInTheDocument();
    changerStatutLivre.mockResolvedValueOnce({ ok: true });
    await u.click(within(fenetre).getByRole("button", { name: "Publier" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(routeur.refresh).toHaveBeenCalled();
  });

  it("Archiver, Republier et Supprimer le brouillon passent chacun par leur fenêtre", async () => {
    const u = user();
    changerStatutLivre.mockResolvedValue({ ok: true });
    supprimerLivre.mockResolvedValue({ ok: true, redirection: "/admin/bibliotheque" });
    render(<VueBibliotheque donnees={DONNEES} />);
    await u.click(within(await ouvrirMenu(u, "Réussir son mémoire")).getByRole("menuitem", { name: "Archiver" }));
    await u.click(within(screen.getByRole("dialog", { name: "Archiver ce livre ?" })).getByRole("button", { name: "Archiver" }));
    await waitFor(() => expect(changerStatutLivre).toHaveBeenCalledWith("l1", "archive"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await u.click(within(await ouvrirMenu(u, "Modèle de CV")).getByRole("menuitem", { name: "Republier" }));
    await u.click(within(screen.getByRole("dialog", { name: "Republier ce livre ?" })).getByRole("button", { name: "Republier" }));
    await waitFor(() => expect(changerStatutLivre).toHaveBeenCalledWith("l3", "publie"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await u.click(within(await ouvrirMenu(u, "Guide du stage")).getByRole("menuitem", { name: "Supprimer le brouillon" }));
    const suppression = screen.getByRole("dialog", { name: "Supprimer ce brouillon ?" });
    expect(suppression).toHaveTextContent("Le livre, son PDF et sa couverture seront supprimés.");
    await u.click(within(suppression).getByRole("button", { name: "Supprimer" }));
    await waitFor(() => expect(supprimerLivre).toHaveBeenCalledWith("l2"));
  });
});

describe("Les boutons d'état de la fiche d'un livre", () => {
  it("un brouillon : Publier et Supprimer le brouillon ; supprimé, retour à la liste", async () => {
    const u = user();
    supprimerLivre.mockResolvedValue({ ok: true, redirection: "/admin/bibliotheque" });
    render(<BarreEtatLivre id="l2" statut="brouillon" />);
    expect(screen.getByText("Brouillon")).toBeInTheDocument();
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Publier", "Supprimer le brouillon"]);
    await u.click(screen.getByRole("button", { name: "Supprimer le brouillon" }));
    await u.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Supprimer" }));
    await waitFor(() => expect(routeur.push).toHaveBeenCalledWith("/admin/bibliotheque"));
  });

  it("publié : Archiver", () => {
    render(<BarreEtatLivre id="l1" statut="publie" />);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Archiver"]);
  });
});

describe("Les catégories", () => {
  const CATEGORIES: CategorieRangee[] = [
    { id: "c1", slug: "methodes", nom: "Méthodes de travail", ordre: 1 },
    { id: "c2", slug: "modeles", nom: "Modèles de mémoire", ordre: 2 },
  ];
  const ouvrir = async (u: ReturnType<typeof userEvent.setup>) => {
    render(<GestionCategories categories={CATEGORIES} />);
    await u.click(screen.getByRole("button", { name: "Catégories" }));
    return screen.getByRole("dialog", { name: "Catégories de la Bibliothèque" });
  };
  const noms = (fenetre: HTMLElement) => within(within(fenetre).getByRole("list", { name: "Catégories" })).getAllByRole("listitem").map((li) => li.textContent);

  it("créer : la catégorie s'ajoute en fin de liste ; un refus s'affiche sous le champ", async () => {
    const u = user();
    const fenetre = await ouvrir(u);
    enregistrerCategorie.mockResolvedValueOnce({ ok: false, message: "Cette catégorie existe déjà." });
    await u.type(within(fenetre).getByLabelText("Nouvelle catégorie"), "Méthodes de travail");
    await u.click(within(fenetre).getByRole("button", { name: "Ajouter" }));
    expect(await within(fenetre).findByText("Cette catégorie existe déjà.")).toBeInTheDocument();
    enregistrerCategorie.mockResolvedValueOnce({ ok: true, categorie: { id: "c3", slug: "guides", nom: "Guides pratiques", ordre: 3 } });
    await u.clear(within(fenetre).getByLabelText("Nouvelle catégorie"));
    await u.type(within(fenetre).getByLabelText("Nouvelle catégorie"), "Guides pratiques");
    await u.click(within(fenetre).getByRole("button", { name: "Ajouter" }));
    await waitFor(() => expect(noms(fenetre)).toEqual(["Méthodes de travail", "Modèles de mémoire", "Guides pratiques"]));
    expect(enregistrerCategorie).toHaveBeenLastCalledWith({ nom: "Guides pratiques" });
  });

  it("renommer, ranger et supprimer", async () => {
    const u = user();
    const fenetre = await ouvrir(u);
    enregistrerCategorie.mockResolvedValue({ ok: true, categorie: { id: "c1", slug: "methodes", nom: "Méthodes", ordre: 1 } });
    await u.click(within(fenetre).getByRole("button", { name: "Renommer « Méthodes de travail »" }));
    const champ = within(fenetre).getByLabelText("Nouveau nom de « Méthodes de travail »");
    await u.clear(champ);
    await u.type(champ, "Méthodes");
    await u.click(within(fenetre).getByRole("button", { name: "Renommer" }));
    await waitFor(() => expect(noms(fenetre)).toEqual(["Méthodes", "Modèles de mémoire"]));
    expect(enregistrerCategorie).toHaveBeenCalledWith({ id: "c1", nom: "Méthodes" });

    rangerCategorie.mockResolvedValue({ ok: true });
    expect(within(fenetre).getByRole("button", { name: "Monter « Méthodes »" })).toBeDisabled();
    await u.click(within(fenetre).getByRole("button", { name: "Monter « Modèles de mémoire »" }));
    await waitFor(() => expect(noms(fenetre)).toEqual(["Modèles de mémoire", "Méthodes"]));
    expect(rangerCategorie).toHaveBeenCalledWith("c2", 1);

    supprimerCategorie.mockResolvedValue({ ok: true });
    await u.click(within(fenetre).getByRole("button", { name: "Supprimer « Méthodes »" }));
    expect(within(fenetre).getByText(/Ses livres restent dans la Bibliothèque, sans catégorie/)).toBeInTheDocument();
    await u.click(within(fenetre).getByRole("button", { name: "Supprimer" }));
    await waitFor(() => expect(noms(fenetre)).toEqual(["Modèles de mémoire"]));
    expect(supprimerCategorie).toHaveBeenCalledWith("c1");
  });
});
