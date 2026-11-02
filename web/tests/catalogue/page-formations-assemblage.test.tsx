// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VueCarteSuivie } from "@/components/mes-formations/CarteSuivie";
import { ToastProvider } from "@/components/ui/Toast";
import type { SuiviDuCompte } from "@/lib/mes-formations/data";
import { CARTES_DESIGN, PARCOURS_DESIGN } from "./cartes-design";

// La page Formations assemblée (revue du plan Formations et Événements) : sans formation suivie, aucune rangée ni vide.
// Spec du 2 novembre 2026, §4 : les cartes reçoivent les apprenants, l'inscription et les favoris, lus en même temps.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/formations" }));
vi.mock("@/lib/catalogue/data", () => ({ listCatalogue: async () => CARTES_DESIGN, listParcoursCatalogue: async () => PARCOURS_DESIGN }));
vi.mock("@/lib/favoris/actions", () => ({ ajouterFavori: vi.fn(), retirerFavori: vi.fn() }));
const lireSuiviDuCompte = vi.fn<() => Promise<SuiviDuCompte>>();
vi.mock("@/lib/mes-formations/data", () => ({ lireSuiviDuCompte: () => lireSuiviDuCompte() }));
const lireApprenants = vi.fn<() => Promise<Record<string, number> | null>>();
vi.mock("@/lib/inscriptions/data", () => ({ lireApprenants: () => lireApprenants() }));

const { PageCatalogue } = await import("@/components/catalogue/PageCatalogue");

const vue = (n: number): VueCarteSuivie => ({
  id: `f${n}`,
  titre: `Formation ${n}`,
  resume: "",
  parcours: "academique",
  pourcentage: 30,
  temps: "1 h restante",
  etat: "enCours",
  href: `/formations/f${n}/lecons/l1`,
  favori: false,
  couverture: null,
});
const suivi = (o: Partial<SuiviDuCompte> = {}): SuiviDuCompte => ({ suivies: [], inscrites: {}, favoris: [], ...o });
const afficher = async (props: Parameters<typeof PageCatalogue>[0]) => render(<ToastProvider>{await PageCatalogue(props)}</ToastProvider>);
const CONNECTE = { params: {}, variante: "connecte", chemin: "/formations", avecMesFormations: true } as const;
const EXCEL = "maitriser-microsoft-excel";

describe("Page Formations assemblée", () => {
  beforeEach(() => {
    lireSuiviDuCompte.mockReset();
    lireApprenants.mockReset();
    lireApprenants.mockResolvedValue({ [EXCEL]: 34 });
  });

  it("sans formation suivie : pas de rangée, « Toutes les formations » juste sous le titre", async () => {
    lireSuiviDuCompte.mockResolvedValue(suivi());
    await afficher(CONNECTE);
    expect(screen.queryByRole("region", { name: "Mes formations" })).toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "Toutes les formations" }).className).toContain("mt-7");
  });

  it("avec des formations suivies : la rangée au-dessus ; une lecture impossible : le catalogue seul, sans cœur", async () => {
    lireSuiviDuCompte.mockResolvedValue(suivi({ suivies: [vue(1), vue(2)] }));
    const { unmount } = await afficher(CONNECTE);
    expect(screen.getByRole("region", { name: "Mes formations" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Toutes les formations" }).className).toContain("mt-9");
    unmount();
    const espion = vi.spyOn(console, "error").mockImplementation(() => {});
    lireSuiviDuCompte.mockRejectedValue(new Error("base injoignable"));
    await afficher(CONNECTE);
    expect(screen.queryByRole("region", { name: "Mes formations" })).toBeNull();
    expect(screen.queryByRole("button", { name: /favoris/ })).toBeNull();
    expect(screen.getAllByText("Voir le cours")).toHaveLength(10);
    expect(espion).toHaveBeenCalled();
    espion.mockRestore();
  });

  it("compte connecté : apprenants, pourcentage des formations inscrites (même 0 %) et cœurs, lus en une fois", async () => {
    lireSuiviDuCompte.mockResolvedValue(suivi({ inscrites: { [EXCEL]: 0 }, favoris: [EXCEL] }));
    await afficher(CONNECTE);
    const excel = screen.getByRole("link", { name: /Maîtriser Microsoft Excel/ });
    expect(within(excel).getByText("0 % terminé")).toBeInTheDocument();
    expect(within(excel).getByText("34 apprenants")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ajouter « Maîtriser Microsoft Excel » aux favoris" })).toHaveAttribute("aria-pressed", "true");
    expect(lireSuiviDuCompte).toHaveBeenCalledTimes(1);
    expect(lireApprenants).toHaveBeenCalledTimes(1);
  });

  it("Formations gratuites (sans rangée) : les cartes du compte connecté ont aussi leur cœur et leur pourcentage", async () => {
    lireSuiviDuCompte.mockResolvedValue(suivi({ suivies: [vue(1)], inscrites: { "zotero-gerer-ses-references": 50 } }));
    await afficher({ params: {}, variante: "connecte", chemin: "/formations-gratuites", imposer: { acces: "gratuites", parcours: "tous" } });
    expect(screen.queryByRole("region", { name: "Mes formations" })).toBeNull();
    expect(screen.getByText("50 % terminé")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /aux favoris$/ })).toHaveLength(2);
  });

  it("sans la 0069 ou si la lecture échoue, pas de nombre d'apprenants ; le reste s'affiche", async () => {
    lireSuiviDuCompte.mockResolvedValue(suivi());
    lireApprenants.mockResolvedValue(null);
    const { unmount } = await afficher(CONNECTE);
    expect(screen.queryByText(/apprenant/)).toBeNull();
    expect(screen.getAllByText("Voir le cours")).toHaveLength(10);
    unmount();
    const espion = vi.spyOn(console, "error").mockImplementation(() => {});
    lireApprenants.mockRejectedValue(new Error("panne"));
    await afficher(CONNECTE);
    expect(screen.queryByText(/apprenant/)).toBeNull();
    expect(screen.getAllByRole("button", { name: /aux favoris$/ })).toHaveLength(10);
    expect(espion).toHaveBeenCalled();
    espion.mockRestore();
  });

  it("le visiteur : jamais de lecture du compte ; la même carte, avec les apprenants, « Voir le cours » et sans cœur", async () => {
    await afficher({ params: {}, variante: "public", chemin: "/formations" });
    expect(lireSuiviDuCompte).not.toHaveBeenCalled();
    expect(within(screen.getByRole("link", { name: /Maîtriser Microsoft Excel/ })).getByText("34 apprenants")).toBeInTheDocument();
    expect(screen.getAllByText("Voir le cours")).toHaveLength(10);
    expect(screen.queryByRole("button", { name: /favoris/ })).toBeNull();
  });
});
