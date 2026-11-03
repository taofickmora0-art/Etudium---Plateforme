// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { metadonneesLivre } from "@/lib/bibliotheque/partage";
import type { FicheLivre } from "@/lib/bibliotheque/types";
import { ficheLivre, ID_MEMOIRE, lecture } from "./fixtures";

// La fiche d'un livre (spec du 3 novembre 2026, §2 ; étape B) : couverture, informations, le bouton principal selon
// l'accès (lire, se connecter, voir les abonnements), « Télécharger » si c'est permis, le cœur et les formations liées.

const ajouterFavoriLivre = vi.fn();
vi.mock("@/lib/bibliotheque/actions", () => ({ ajouterFavoriLivre: (...a: unknown[]) => ajouterFavoriLivre(...a), retirerFavoriLivre: vi.fn() }));
const lienTelechargementLivre = vi.fn();
vi.mock("@/lib/bibliotheque/lecteur", () => ({ lienTelechargementLivre: (...a: unknown[]) => lienTelechargementLivre(...a), lienLectureLivre: vi.fn(), noterLecture: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/bibliotheque/reussir-son-memoire" }));

const { FicheDeLivre } = await import("@/components/bibliotheque/FicheDeLivre");
const { BoutonTelechargerLivre } = await import("@/components/bibliotheque/BoutonTelechargerLivre");

const afficher = (fiche: FicheLivre, variante: "public" | "connecte" = "connecte") =>
  render(
    <ToastProvider>
      <FicheDeLivre fiche={fiche} variante={variante} />
    </ToastProvider>,
  );
const principal = () => screen.getByTestId("action-livre");

describe("La fiche d'un livre", () => {
  beforeEach(() => {
    ajouterFavoriLivre.mockReset().mockResolvedValue({ ok: true });
    lienTelechargementLivre.mockReset();
  });

  it("la couverture, le titre, l'auteur, le résumé et les informations du livre", () => {
    afficher(ficheLivre({ langue: "en", annee: 2024 }));
    expect(screen.getByRole("navigation", { name: "Fil d’Ariane" })).toHaveTextContent("Bibliothèque");
    expect(within(screen.getByRole("navigation", { name: "Fil d’Ariane" })).getByRole("link", { name: "Bibliothèque" })).toHaveAttribute("href", "/bibliotheque");
    expect(screen.getByRole("heading", { level: 1, name: "Réussir son mémoire" })).toBeInTheDocument();
    expect(screen.getByText("Mireille Adjovi")).toBeInTheDocument();
    expect(screen.getByText("Un guide pas à pas, du sujet à la soutenance.")).toBeInTheDocument();
    const infos = screen.getByRole("region", { name: "À propos du livre" });
    const ligne = (terme: string) => within(infos).getByText(terme).nextElementSibling?.textContent;
    expect(ligne("Catégorie")).toBe("Méthodes de travail");
    expect(ligne("Parcours")).toBe("Réussite académique");
    expect(ligne("Langue")).toBe("Anglais");
    expect(ligne("Année")).toBe("2024");
    expect(ligne("Pages")).toBe("120 pages");
    expect(ligne("Taille")).toBe("1,2 Mo");
    expect(document.querySelector("[data-format='livre']")).not.toBeNull();
  });

  it("une information inconnue n'est pas affichée", () => {
    afficher(ficheLivre({ annee: null, nbPages: null, tailleOctets: null, categorie: null, parcours: [] }));
    const infos = screen.getByRole("region", { name: "À propos du livre" });
    for (const terme of ["Catégorie", "Parcours", "Année", "Pages", "Taille"]) expect(within(infos).queryByText(terme)).toBeNull();
    expect(within(infos).getByText("Langue")).toBeInTheDocument();
  });

  it("ouvert, jamais lu : « Lire », vers le lecteur", () => {
    afficher(ficheLivre());
    expect(within(principal()).getByRole("link", { name: "Lire" })).toHaveAttribute("href", "/bibliotheque/reussir-son-memoire/lire");
  });

  it("ouvert et commencé : « Continuer, page 42 » et la progression ; terminé : « Relire » depuis le début", () => {
    const { unmount } = afficher(ficheLivre({ lecture: lecture() }));
    expect(within(principal()).getByRole("link", { name: "Continuer, page 42" })).toHaveAttribute("href", "/bibliotheque/reussir-son-memoire/lire");
    expect(within(principal()).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "42");
    expect(within(principal()).getByText("42 % lus")).toBeInTheDocument();
    unmount();
    afficher(ficheLivre({ lecture: lecture({ terminee: true, pourcentage: 100, dernierePage: 100 }) }));
    expect(within(principal()).getByRole("link", { name: "Relire" })).toHaveAttribute("href", "/bibliotheque/reussir-son-memoire/lire?page=1");
  });

  it("un visiteur : « Se connecter pour lire », qui revient à la fiche ; ni cœur ni téléchargement", () => {
    afficher(ficheLivre({ accesEtat: "connexion", ouvert: false, telechargeable: true }), "public");
    expect(within(principal()).getByRole("link", { name: "Se connecter pour lire" })).toHaveAttribute(
      "href",
      "/connexion?next=%2Fbibliotheque%2Freussir-son-memoire",
    );
    expect(within(principal()).getByRole("link", { name: "Créer un compte" })).toHaveAttribute("href", "/inscription?next=%2Fbibliotheque%2Freussir-son-memoire");
    expect(screen.queryByRole("button", { name: /favoris/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Télécharger" })).toBeNull();
  });

  it("sans abonnement : « Voir les abonnements », avec la phrase sur la bibliothèque", () => {
    afficher(ficheLivre({ accesEtat: "abonnement", ouvert: false, telechargeable: true }));
    expect(within(principal()).getByRole("link", { name: "Voir les abonnements" })).toHaveAttribute("href", "/abonnement/souscrire");
    expect(within(principal()).getByText("Un abonnement ouvre toute la bibliothèque.")).toBeInTheDocument();
    expect(within(principal()).queryByRole("link", { name: "Lire" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Télécharger" })).toBeNull();
    // Le cœur reste : on peut mettre de côté un livre fermé.
    expect(screen.getByRole("button", { name: "Ajouter aux favoris" })).toBeInTheDocument();
  });

  it("fermé (compte suspendu, livre retiré) : aucun bouton de lecture, une phrase", () => {
    afficher(ficheLivre({ accesEtat: "ferme", ouvert: false }));
    expect(within(principal()).queryByRole("link")).toBeNull();
    expect(within(principal()).getByText("Ce livre n’est pas accessible pour le moment.")).toBeInTheDocument();
  });

  it("« Télécharger » seulement pour un livre téléchargeable et ouvert ; sinon, « Lecture dans le site »", () => {
    const { unmount } = afficher(ficheLivre({ telechargeable: true }));
    expect(screen.getByRole("button", { name: "Télécharger" })).toBeInTheDocument();
    unmount();
    afficher(ficheLivre({ telechargeable: false }));
    expect(screen.queryByRole("button", { name: "Télécharger" })).toBeNull();
    expect(screen.getByText("Lecture dans le site, sans téléchargement.")).toBeInTheDocument();
  });

  it("le cœur de la fiche ajoute le livre aux favoris", async () => {
    afficher(ficheLivre());
    await userEvent.click(screen.getByRole("button", { name: "Ajouter aux favoris" }));
    expect(ajouterFavoriLivre).toHaveBeenCalledWith(ID_MEMOIRE);
    expect(await screen.findByRole("button", { name: "Dans vos favoris" })).toHaveAttribute("aria-pressed", "true");
  });

  it("les formations liées, vers leur fiche ; aucune : pas de section", () => {
    const { unmount } = afficher(ficheLivre({ formations: [{ id: "f1", slug: "maitriser-word", titre: "Maîtriser Word", couverture: null }] }));
    const section = screen.getByRole("region", { name: "Formations liées" });
    expect(within(section).getByRole("link", { name: /Maîtriser Word/ })).toHaveAttribute("href", "/formations/maitriser-word");
    unmount();
    afficher(ficheLivre({ formations: [] }));
    expect(screen.queryByRole("region", { name: "Formations liées" })).toBeNull();
  });

  it("un brouillon vu par l'équipe : un bandeau d'aperçu", () => {
    afficher(ficheLivre({ statut: "brouillon" }));
    expect(screen.getByText("Aperçu : ce livre n’est pas publié. Les étudiants ne le voient pas encore.")).toBeInTheDocument();
  });
});

describe("Le bouton « Télécharger »", () => {
  beforeEach(() => {
    lienTelechargementLivre.mockReset();
  });

  it("note le téléchargement, puis ouvre le lien signé", async () => {
    lienTelechargementLivre.mockResolvedValue({ url: "https://x.supabase.co/signe?token=t&download=guide.pdf" });
    const ouvrir = vi.fn();
    render(<BoutonTelechargerLivre livreId={ID_MEMOIRE} titre="Réussir son mémoire" ouvrir={ouvrir} />);
    await userEvent.click(screen.getByRole("button", { name: "Télécharger" }));
    expect(lienTelechargementLivre).toHaveBeenCalledWith(ID_MEMOIRE, "Réussir son mémoire");
    expect(ouvrir).toHaveBeenCalledWith("https://x.supabase.co/signe?token=t&download=guide.pdf");
  });

  it("un refus est annoncé, rien ne s'ouvre", async () => {
    lienTelechargementLivre.mockResolvedValue({ erreur: "Trop de téléchargements en peu de temps : réessayez dans quelques minutes." });
    const ouvrir = vi.fn();
    render(<BoutonTelechargerLivre livreId={ID_MEMOIRE} titre="Réussir son mémoire" ouvrir={ouvrir} />);
    await userEvent.click(screen.getByRole("button", { name: "Télécharger" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Trop de téléchargements en peu de temps : réessayez dans quelques minutes.");
    expect(ouvrir).not.toHaveBeenCalled();
  });
});

describe("Les métadonnées de la fiche (aperçu d'un lien partagé)", () => {
  it("le titre, le résumé et la couverture comme image de partage", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://projet.supabase.co");
    const m = metadonneesLivre(ficheLivre({ couverture: `livres/${ID_MEMOIRE}/c.jpg` }));
    expect(m.title).toBe("Réussir son mémoire · Bibliothèque Étudium");
    expect(m.description).toBe("Un guide pas à pas, du sujet à la soutenance.");
    expect(m.openGraph).toMatchObject({
      title: "Réussir son mémoire",
      images: [{ url: `https://projet.supabase.co/storage/v1/object/public/couvertures/livres/${ID_MEMOIRE}/c.jpg`, alt: "Réussir son mémoire" }],
    });
    expect(m.alternates).toEqual({ canonical: "/bibliotheque/reussir-son-memoire" });
    vi.unstubAllEnvs();
  });

  it("sans résumé ni couverture : une description de repli, pas d'image ; livre introuvable : un titre seul", () => {
    const m = metadonneesLivre(ficheLivre({ resume: "", couverture: null }));
    expect(m.description).toBe("Un livre de la bibliothèque Étudium, par Mireille Adjovi.");
    expect((m.openGraph as { images?: unknown }).images).toBeUndefined();
    expect(metadonneesLivre(null)).toEqual({ title: "Livre introuvable · Étudium" });
  });
});
