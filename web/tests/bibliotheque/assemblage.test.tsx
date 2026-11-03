// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { ShellUser } from "@/lib/auth/current-user";
import { CATALOGUE, ficheLivre, ID_MEMOIRE, lecture, MEMOIRE } from "./fixtures";

// Les pages de la Bibliothèque assemblées (étape B) : ce qu'elles lisent selon le compte, et sans la 0074 un message
// neutre pour les étudiants et les visiteurs, la migration à appliquer pour l'équipe des contenus.

const INDISPONIBLE = "Cette fonction n’est pas disponible pour le moment.";

const compte = vi.hoisted(() => ({ actuel: null as ShellUser | null }));
vi.mock("@/lib/catalogue/visiteur", () => ({ compteConnecte: async () => compte.actuel }));
const renvoyerFormateur = vi.fn(async () => {});
vi.mock("@/lib/catalogue/garde-formateur", () => ({ renvoyerFormateur: (...a: unknown[]) => renvoyerFormateur(...(a as [])) }));
const lireCatalogue = vi.fn();
const lireMesLectures = vi.fn();
const lireFicheLivre = vi.fn();
vi.mock("@/lib/bibliotheque/data", () => ({
  lireCatalogue: (...a: unknown[]) => lireCatalogue(...a),
  lireMesLectures: (...a: unknown[]) => lireMesLectures(...a),
  lireFicheLivre: (...a: unknown[]) => lireFicheLivre(...a),
}));
vi.mock("@/lib/bibliotheque/actions", () => ({ ajouterFavoriLivre: vi.fn(), retirerFavoriLivre: vi.fn() }));
vi.mock("@/lib/bibliotheque/lecteur", () => ({ lienTelechargementLivre: vi.fn(), lienLectureLivre: vi.fn(), noterLecture: vi.fn() }));
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const redirect = vi.fn((adresse: string) => {
  throw new Error(`NEXT_REDIRECT ${adresse}`);
});
vi.mock("next/navigation", () => ({
  notFound: () => notFound(),
  redirect: (adresse: string) => redirect(adresse),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/bibliotheque",
}));

const { ContenuBibliotheque, ContenuFicheLivre, ContenuLecteur } = await import("@/components/bibliotheque/ContenusBibliotheque");

const ETUDIANTE: ShellUser = { prenom: "Awa", nom: "Diallo", initials: "AD", email: "awa@exemple.bj", roles: ["etudiant"], statut: "", formule: "", serie: 0, points: 0, photoUrl: null };
const EQUIPE: ShellUser = { ...ETUDIANTE, roles: ["etudiant", "admin"] };
const afficher = async (element: Promise<React.ReactNode>) => render(<ToastProvider>{await element}</ToastProvider>);

beforeEach(() => {
  compte.actuel = null;
  renvoyerFormateur.mockClear();
  lireCatalogue.mockReset().mockResolvedValue(CATALOGUE);
  lireMesLectures.mockReset().mockResolvedValue([MEMOIRE]);
  lireFicheLivre.mockReset().mockResolvedValue(ficheLivre());
  notFound.mockClear();
  redirect.mockClear();
});

describe("La page Bibliothèque assemblée", () => {
  it("un visiteur : le catalogue public, sans lire « Continuer la lecture »", async () => {
    await afficher(ContenuBibliotheque({ params: {} }));
    expect(screen.getByRole("heading", { level: 1, name: "La bibliothèque Étudium" })).toBeInTheDocument();
    expect(lireMesLectures).not.toHaveBeenCalled();
    expect(renvoyerFormateur).toHaveBeenCalledWith(null);
  });

  it("un compte connecté : la page de l'appli et ses livres commencés ; les filtres de l'adresse s'appliquent", async () => {
    compte.actuel = ETUDIANTE;
    await afficher(ContenuBibliotheque({ params: {} }));
    expect(screen.getByRole("heading", { level: 1, name: "Bibliothèque" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Continuer la lecture" })).toBeInTheDocument();
    expect(renvoyerFormateur).toHaveBeenCalledWith(ETUDIANTE);
  });

  it("« Continuer la lecture » illisible : la page s'affiche quand même, sans la rangée", async () => {
    compte.actuel = ETUDIANTE;
    lireMesLectures.mockRejectedValue(new Error("panne"));
    const espion = vi.spyOn(console, "error").mockImplementation(() => {});
    await afficher(ContenuBibliotheque({ params: { gratuits: "1" } }));
    expect(screen.queryByRole("region", { name: "Continuer la lecture" })).toBeNull();
    expect(screen.getByRole("button", { name: "Gratuits" })).toHaveAttribute("aria-pressed", "true");
    espion.mockRestore();
  });

  it("sans la 0074 : un message neutre pour un visiteur et une étudiante, la migration pour l'équipe", async () => {
    lireCatalogue.mockResolvedValue(null);
    const visiteur = await afficher(ContenuBibliotheque({ params: {} }));
    expect(screen.getByText(INDISPONIBLE)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/migration/i);
    visiteur.unmount();
    compte.actuel = ETUDIANTE;
    const etudiante = await afficher(ContenuBibliotheque({ params: {} }));
    expect(screen.getByText(INDISPONIBLE)).toBeInTheDocument();
    etudiante.unmount();
    compte.actuel = EQUIPE;
    await afficher(ContenuBibliotheque({ params: {} }));
    expect(screen.getByText("Appliquez la migration 0074 (guide « Ce qui te revient », section 73).")).toBeInTheDocument();
  });
});

describe("La fiche d'un livre assemblée", () => {
  it("la fiche, dans le cadre du visiteur ou du compte connecté", async () => {
    const visiteur = await afficher(ContenuFicheLivre({ slug: "reussir-son-memoire" }));
    expect(lireFicheLivre).toHaveBeenCalledWith("reussir-son-memoire");
    expect(screen.queryByRole("button", { name: /favoris/ })).toBeNull();
    visiteur.unmount();
    compte.actuel = ETUDIANTE;
    await afficher(ContenuFicheLivre({ slug: "reussir-son-memoire" }));
    expect(screen.getByRole("button", { name: "Ajouter aux favoris" })).toBeInTheDocument();
  });

  it("un livre inconnu ou pas publié : page introuvable", async () => {
    lireFicheLivre.mockResolvedValue(null);
    await expect(ContenuFicheLivre({ slug: "inconnu" })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("sans la 0074 : le message neutre, ou la migration pour l'équipe", async () => {
    lireFicheLivre.mockResolvedValue("absente");
    const visiteur = await afficher(ContenuFicheLivre({ slug: "reussir-son-memoire" }));
    expect(screen.getByText(INDISPONIBLE)).toBeInTheDocument();
    visiteur.unmount();
    compte.actuel = EQUIPE;
    await afficher(ContenuFicheLivre({ slug: "reussir-son-memoire" }));
    expect(screen.getByText("Appliquez la migration 0074 (guide « Ce qui te revient », section 73).")).toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });
});

describe("Le lecteur assemblé", () => {
  it("un compte qui a l'accès : le lecteur, à la dernière page lue", async () => {
    compte.actuel = ETUDIANTE;
    lireFicheLivre.mockResolvedValue(ficheLivre({ lecture: lecture({ dernierePage: 42 }) }));
    const element = (await ContenuLecteur({ slug: "reussir-son-memoire", params: {} })) as React.ReactElement<{ pageDepart: number; livre: { id: string; telechargeable: boolean } }>;
    expect(element.props.pageDepart).toBe(42);
    expect(element.props.livre).toMatchObject({ id: ID_MEMOIRE, telechargeable: false });
    expect(renvoyerFormateur).toHaveBeenCalledWith(ETUDIANTE);
  });

  it("« Relire » : la page de l'adresse l'emporte ; une page mal formée est ignorée", async () => {
    compte.actuel = ETUDIANTE;
    lireFicheLivre.mockResolvedValue(ficheLivre({ lecture: lecture({ dernierePage: 100, terminee: true }) }));
    const relire = (await ContenuLecteur({ slug: "reussir-son-memoire", params: { page: "1" } })) as React.ReactElement<{ pageDepart: number }>;
    expect(relire.props.pageDepart).toBe(1);
    const mal = (await ContenuLecteur({ slug: "reussir-son-memoire", params: { page: "abc" } })) as React.ReactElement<{ pageDepart: number }>;
    expect(mal.props.pageDepart).toBe(100);
    const sansPage = (await ContenuLecteur({ slug: "reussir-son-memoire", params: {} })) as React.ReactElement<{ pageDepart: number }>;
    expect(sansPage.props.pageDepart).toBe(100);
    lireFicheLivre.mockResolvedValue(ficheLivre({ lecture: null }));
    const neuf = (await ContenuLecteur({ slug: "reussir-son-memoire", params: {} })) as React.ReactElement<{ pageDepart: number }>;
    expect(neuf.props.pageDepart).toBe(1);
  });

  it("sans accès (visiteur, sans abonnement, fermé) ou sans la 0074 : retour à la fiche", async () => {
    for (const accesEtat of ["connexion", "abonnement", "ferme"] as const) {
      lireFicheLivre.mockResolvedValue(ficheLivre({ accesEtat, ouvert: false }));
      await expect(ContenuLecteur({ slug: "reussir-son-memoire", params: {} })).rejects.toThrow("NEXT_REDIRECT /bibliotheque/reussir-son-memoire");
    }
    lireFicheLivre.mockResolvedValue("absente");
    await expect(ContenuLecteur({ slug: "reussir-son-memoire", params: {} })).rejects.toThrow("NEXT_REDIRECT /bibliotheque/reussir-son-memoire");
  });

  it("un livre inconnu : page introuvable", async () => {
    lireFicheLivre.mockResolvedValue(null);
    await expect(ContenuLecteur({ slug: "inconnu", params: {} })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
