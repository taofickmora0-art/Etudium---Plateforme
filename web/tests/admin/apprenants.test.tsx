// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PageApprenants } from "@/lib/formateur/apprenants";
import { fauxSupabase } from "./faux-supabase";

// L'onglet « Apprenants » d'une formation (refonte des formations, étape C).
const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/admin/formations/x" }));
const chercherApprenants = vi.fn();
vi.mock("@/lib/formateur/actions-apprenants", () => ({ chercherApprenants: (...a: unknown[]) => chercherApprenants(...a) }));

const { ListeApprenants } = await import("@/components/admin/ListeApprenants");
const { OngletApprenants } = await import("@/components/admin/OngletApprenants");
const { FormationOnglets } = await import("@/components/admin/FormationOnglets");

const X = "22222222-2222-4222-8222-222222222222";
const E = "11111111-1111-4111-8111-111111111111";
const ligne = (n: number, o: Partial<PageApprenants["lignes"][number]> = {}) => ({
  etudiantId: `${E.slice(0, -2)}${String(n).padStart(2, "0")}`,
  prenom: "Fifamè",
  nom: "Adjovi",
  terminees: 3,
  total: 12,
  premiereOuverture: "2026-10-01T08:00:00+00:00",
  derniereActivite: "2026-10-13T08:00:00+00:00",
  etat: "en_cours" as const,
  ...o,
});
const PAGE: PageApprenants = {
  resume: { apprenants: 30, progressionMoyenne: 46, terminees: 4, aRisque: 7 },
  total: 30,
  lignes: [ligne(1, { etudiantId: E }), ligne(2, { prenom: "Rodrigue", nom: "Houngbo", terminees: 0, etat: "a_risque" })],
};

describe("L'onglet « Apprenants »", () => {
  beforeEach(() => {
    chercherApprenants.mockReset();
    faux.vider();
  });

  it("les quatre chiffres et le tableau ; le nom mène à la fiche de l'espace", () => {
    const { unmount } = render(<ListeApprenants formationId={X} espace="admin" initial={PAGE} />);
    const chiffres = screen.getByRole("list", { name: "En bref" });
    expect(within(chiffres).getAllByRole("listitem").map((c) => c.textContent)).toEqual(["Apprenants30", "Progression moyenne46 %", "Formation terminée4", "À risque7"]);
    const tableau = screen.getByRole("table", { name: "Apprenants" });
    expect(within(tableau).getAllByRole("columnheader").map((c) => c.textContent)).toEqual(["Apprenant", "Progression", "Commencée le", "Dernière activité", "État"]);
    expect(within(tableau).getByRole("link", { name: "Fifamè Adjovi" })).toHaveAttribute("href", `/admin/utilisateurs/${E}`);
    expect(within(tableau).getAllByText("3 / 12")[0]).toBeInTheDocument();
    expect(within(tableau).getByText("À risque")).toBeInTheDocument();
    unmount();
    render(<ListeApprenants formationId={X} espace="formateur" initial={PAGE} />);
    expect(screen.getByRole("link", { name: "Fifamè Adjovi" })).toHaveAttribute("href", `/formateur/etudiants/${E}`);
  });

  it("filtres, recherche et pages rappellent l'action ; jamais par l'adresse", async () => {
    const user = userEvent.setup();
    chercherApprenants.mockResolvedValue({ ok: true, page: { ...PAGE, total: 1, lignes: [PAGE.lignes[1]] } });
    render(<ListeApprenants formationId={X} espace="admin" initial={PAGE} />);
    await user.click(screen.getByRole("button", { name: "À risque" }));
    expect(chercherApprenants).toHaveBeenLastCalledWith(X, "", "a_risque", 1);
    await waitFor(() => expect(screen.queryByRole("link", { name: "Fifamè Adjovi" })).toBeNull());
    await user.type(screen.getByRole("searchbox", { name: "Rechercher un apprenant" }), "rod");
    await waitFor(() => expect(chercherApprenants).toHaveBeenLastCalledWith(X, "rod", "a_risque", 1));
  });

  it("pagination : 25 par page", async () => {
    const user = userEvent.setup();
    chercherApprenants.mockResolvedValue({ ok: true, page: PAGE });
    render(<ListeApprenants formationId={X} espace="admin" initial={PAGE} />);
    await user.click(screen.getByRole("button", { name: /page suivante/i }));
    expect(chercherApprenants).toHaveBeenLastCalledWith(X, "", "tous", 2);
  });

  it("personne encore ; un filtre sans résultat ; une erreur", async () => {
    const vide: PageApprenants = { resume: { apprenants: 0, progressionMoyenne: 0, terminees: 0, aRisque: 0 }, total: 0, lignes: [] };
    const { unmount } = render(<ListeApprenants formationId={X} espace="admin" initial={vide} />);
    expect(screen.getByText("Personne n’a encore commencé cette formation.")).toBeInTheDocument();
    unmount();
    const user = userEvent.setup();
    chercherApprenants.mockResolvedValueOnce({ ok: true, page: { ...PAGE, total: 0, lignes: [] } }).mockResolvedValueOnce({ ok: false, message: "La liste n’a pas pu être chargée. Réessayez." });
    render(<ListeApprenants formationId={X} espace="admin" initial={PAGE} />);
    await user.click(screen.getByRole("button", { name: "Terminés" }));
    expect(await screen.findByText("Aucun apprenant ne correspond à cette recherche.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tous" }));
    expect(await screen.findByText("La liste n’a pas pu être chargée. Réessayez.")).toBeInTheDocument();
  });

  it("l'onglet lit la première page ; avant la 0029, la migration au back-office, neutre au formateur", async () => {
    faux.repondre("rpc.apprenants_formation", { data: { resume: { apprenants: 1, progression_moyenne: 25, terminees: 0, a_risque: 0 }, total: 1, lignes: [] } });
    const { unmount } = render(await OngletApprenants({ formationId: X, espace: "formateur" }));
    expect(screen.getByRole("list", { name: "En bref" })).toHaveTextContent("Progression moyenne25 %");
    unmount();
    faux.vider();
    faux.repondre("rpc.apprenants_formation", { error: { code: "PGRST202", message: "Could not find the function" } });
    const equipe = render(await OngletApprenants({ formationId: X, espace: "admin" }));
    expect(screen.getByText("Appliquez la migration 0029 (guide « Ce qui te revient », section 35).")).toBeInTheDocument();
    equipe.unmount();
    render(await OngletApprenants({ formationId: X, espace: "formateur" }));
    expect(screen.getByText("Cette fonction n’est pas disponible pour le moment.")).toBeInTheDocument();
  });

  it("une erreur de lecture reste dans l'onglet : l'éditeur et ses saisies ne sont pas remplacés par la page d'erreur (revue)", async () => {
    faux.repondre("rpc.apprenants_formation", { error: { code: "57014", message: "canceling statement due to statement timeout" } });
    render(await OngletApprenants({ formationId: X, espace: "admin" }));
    expect(screen.getByText("Les apprenants n’ont pas pu être chargés. Rechargez la page pour réessayer.")).toBeInTheDocument();
  });

  it("un quatrième onglet « Apprenants », ouvert par ?onglet=apprenants", () => {
    render(<FormationOnglets ongletInitial="apprenants" informations={<p>Infos</p>} programme={<p>Leçons</p>} publication={<p>Publication</p>} apprenants={<p>La liste</p>} />);
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Informations", "Leçons", "Publication", "Apprenants"]);
    expect(screen.getByRole("tab", { name: "Apprenants" })).toHaveAttribute("aria-selected", "true");
  });
});
