// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { PageSuivi, SuiviEtudiant } from "@/lib/formateur/suivi";
import { choisirDansListe } from "../utilitaires/listes";

// Espace formateur, page « Étudiants » (spec « Étudiants » et tableau de bord du formateur, §3).

const lireMaFiche = vi.fn();
vi.mock("@/lib/formateur/data", () => ({ lireMaFiche: () => lireMaFiche(), estMaFormation: vi.fn() }));
const lireSuivi = vi.fn();
const lireSuiviEtudiant = vi.fn();
vi.mock("@/lib/formateur/suivi", () => ({ lireSuivi: (...a: unknown[]) => lireSuivi(...a), lireSuiviEtudiant: (id: string) => lireSuiviEtudiant(id), lireTableauDeBordFormateur: vi.fn() }));
const listFormations = vi.fn();
vi.mock("@/lib/admin/data", () => ({ listFormations: (...a: unknown[]) => listFormations(...a), estTablesAbsentes: () => false }));
const chercherSuivi = vi.fn();
const enregistrerRemarque = vi.fn();
vi.mock("@/lib/formateur/actions", () => ({ chercherSuivi: (...a: unknown[]) => chercherSuivi(...a), enregistrerRemarque: (...a: unknown[]) => enregistrerRemarque(...a) }));
const routeur = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => routeur,
  usePathname: () => "/formateur/etudiants",
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

// Lot 3 : ses quiz, ses exercices et son certificat (0033).
const lireLot3Etudiant = vi.fn();
vi.mock("@/lib/certificats/data", () => ({ lireLot3Etudiant: (id: string) => lireLot3Etudiant(id) }));

// Lot 5 : écrire à l'étudiant depuis sa fiche.
const ouvrirConversation = vi.fn();
vi.mock("@/lib/messages/actions", () => ({ ouvrirConversation: (id: string) => ouvrirConversation(id) }));

const { PageEtudiants } = await import("@/components/formateur/PageEtudiants");
const { ListeEtudiants } = await import("@/components/formateur/ListeEtudiants");
const { FicheEtudiant } = await import("@/components/formateur/FicheEtudiant");

const E = "11111111-1111-4111-8111-111111111111";
const X = "22222222-2222-4222-8222-222222222222";
const PAGE: PageSuivi = {
  total: 2,
  lignes: [
    { etudiantId: E, prenom: "Fifamè", nom: "Adjovi", formationId: X, formationTitre: "Maîtriser Microsoft Excel", terminees: 6, total: 12, derniereActivite: "2026-10-13T08:00:00Z", etat: "en_cours" },
    { etudiantId: "e2", prenom: "Rodrigue", nom: "Houngbo", formationId: X, formationTitre: "Maîtriser Microsoft Excel", terminees: 1, total: 12, derniereActivite: "2026-09-20T08:00:00Z", etat: "a_risque" },
  ],
};
const FORMATIONS = [{ id: X, titre: "Maîtriser Microsoft Excel" }];
const SUIVI: SuiviEtudiant = {
  id: E,
  prenom: "Fifamè",
  nom: "Adjovi",
  formations: [
    {
      id: X,
      titre: "Maîtriser Microsoft Excel",
      terminees: 1,
      total: 3,
      secondes: 5100,
      derniereActivite: "2026-10-13T08:00:00Z",
      etat: "en_cours",
      modules: [
        {
          id: "m1",
          titre: "Les bases",
          lecons: [
            { id: "l1", titre: "Découvrir l’interface", etat: "terminee", termineeLe: "2026-10-12T08:00:00Z", secondes: 90 },
            { id: "l2", titre: "Les formules", etat: "ouverte", termineeLe: null, secondes: 0 },
            { id: "l3", titre: "Les graphiques", etat: "non_ouverte", termineeLe: null, secondes: 0 },
          ],
        },
      ],
    },
  ],
  remarque: { texte: "A du mal avec les formules.", modifieeLe: "2026-10-13T09:00:00Z" },
};
const avecToast = (enfant: React.ReactNode) => render(<ToastProvider>{enfant}</ToastProvider>);

beforeEach(() => {
  for (const f of [lireMaFiche, lireSuivi, lireSuiviEtudiant, listFormations, chercherSuivi, enregistrerRemarque, ouvrirConversation, routeur.push, routeur.replace]) f.mockReset();
  lireMaFiche.mockResolvedValue({ migrationAbsente: false, fiche: "fa" });
  lireSuivi.mockResolvedValue({ migrationAbsente: false, donnees: PAGE });
  listFormations.mockResolvedValue([{ id: X, titre: "Maîtriser Microsoft Excel" }]);
  chercherSuivi.mockResolvedValue({ ok: true, page: { total: 0, lignes: [] } });
  enregistrerRemarque.mockResolvedValue({ ok: true });
});

describe("Page Étudiants", () => {
  it("le tableau : nom (lien vers la fiche), formation, 6 / 12, date, état", async () => {
    avecToast(await PageEtudiants());
    expect(screen.getByRole("heading", { level: 1, name: "Étudiants" })).toBeInTheDocument();
    expect(listFormations).toHaveBeenCalledWith({ formateurId: "fa" });
    const lignes = within(screen.getByRole("table", { name: "Étudiants" })).getAllByRole("row").slice(1);
    expect(within(lignes[0]).getByRole("link", { name: "Fifamè Adjovi" })).toHaveAttribute("href", `/formateur/etudiants/${E}`);
    expect(lignes[0]).toHaveTextContent("Maîtriser Microsoft Excel");
    expect(lignes[0]).toHaveTextContent("6 / 12");
    expect(lignes[0]).toHaveTextContent("13 oct. 2026");
    expect(within(lignes[0]).getByText("En cours")).toBeInTheDocument();
    expect(within(lignes[1]).getByText("À risque")).toBeInTheDocument();
  });

  it("filtres et recherche passent par l'action, jamais par l'adresse de la page", async () => {
    const user = userEvent.setup();
    avecToast(<ListeEtudiants initial={PAGE} formations={FORMATIONS} />);
    await user.click(screen.getByRole("button", { name: "À risque" }));
    await waitFor(() => expect(chercherSuivi).toHaveBeenLastCalledWith("", null, "a_risque", 1));
    await choisirDansListe("Formation", "Maîtriser Microsoft Excel", { user });
    await waitFor(() => expect(chercherSuivi).toHaveBeenLastCalledWith("", X, "a_risque", 1));
    await user.type(screen.getByRole("searchbox", { name: "Rechercher un étudiant" }), "fifa");
    await waitFor(() => expect(chercherSuivi).toHaveBeenLastCalledWith("fifa", X, "a_risque", 1));
    expect(await screen.findByText("Aucun étudiant ne correspond à cette recherche.")).toBeInTheDocument();
    expect(routeur.replace).not.toHaveBeenCalled();
    expect(window.location.search).toBe("");
  });

  it("aucun étudiant : le message", () => {
    avecToast(<ListeEtudiants initial={{ total: 0, lignes: [] }} formations={FORMATIONS} />);
    expect(screen.getByText("Aucun étudiant ne suit encore vos formations.")).toBeInTheDocument();
  });

  it("sans fiche, avant la 0014 ou la 0015 : les bandeaux", async () => {
    lireMaFiche.mockResolvedValue({ migrationAbsente: false, fiche: null });
    const { unmount } = avecToast(await PageEtudiants());
    expect(screen.getByText(/pas encore relié à une fiche formateur/)).toBeInTheDocument();
    unmount();
    lireMaFiche.mockResolvedValue({ migrationAbsente: false, fiche: "fa" });
    lireSuivi.mockResolvedValue({ migrationAbsente: true });
    avecToast(await PageEtudiants());
    expect(screen.getByText("Cette fonction n’est pas disponible pour le moment.")).toBeInTheDocument();
    expect(screen.queryByText(/migration|dans la base/i)).toBeNull();
  });
});

describe("Fiche d'un étudiant", () => {
  it("ses formations : progression, temps de vidéo, leçons une par une ; ses quiz, ses exercices, son certificat", async () => {
    lireSuiviEtudiant.mockResolvedValue({ migrationAbsente: false, donnees: SUIVI });
    lireLot3Etudiant.mockResolvedValue([
      {
        formationId: X,
        quiz: [{ id: "q1", titre: "Quiz du module 1", meilleur: 75, reussi: true }, { id: "q2", titre: "Quiz final", meilleur: null, reussi: false }],
        exercices: [{ id: "x1", titre: "Tableau des ventes", statut: "a_corriger", valide: false }],
        certificat: null,
      },
    ]);
    avecToast(await FicheEtudiant({ id: E }));
    expect(screen.getByRole("heading", { level: 1, name: "Fifamè Adjovi" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Étudiants" })).toHaveAttribute("href", "/formateur/etudiants");
    expect(screen.getByText(/1 \/ 3 leçons/)).toBeInTheDocument();
    expect(screen.getByText(/1 h 25 de vidéo/)).toBeInTheDocument();
    expect(screen.getByText("Terminée le 12 oct. 2026")).toBeInTheDocument();
    expect(screen.getByText("Ouverte")).toBeInTheDocument();
    expect(screen.getByText("Pas encore ouverte")).toBeInTheDocument();
    expect(lireLot3Etudiant).toHaveBeenCalledWith(E);
    const suivi = screen.getByRole("list", { name: "Quiz et exercices : Maîtriser Microsoft Excel" });
    expect(within(suivi).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Quiz du module 1Réussi · 75 %",
      "Quiz finalPas encore passé",
      "Tableau des ventesÀ corriger",
    ]);
    expect(screen.getByText("Pas encore de certificat.")).toBeInTheDocument();
  });

  it("deux modules de même titre : aucune clé en double (l'affichage reste juste après un enregistrement)", async () => {
    const erreurs = vi.spyOn(console, "error").mockImplementation(() => {});
    const unModule = (id: string, lecon: string) => ({ id, titre: "Intro", lecons: [{ id: lecon, titre: `Leçon ${lecon}`, etat: "ouverte" as const, termineeLe: null, secondes: 0 }] });
    const formation = { ...SUIVI.formations[0], modules: [unModule("m1", "a"), unModule("m2", "b")] };
    lireSuiviEtudiant.mockResolvedValue({ migrationAbsente: false, donnees: { ...SUIVI, formations: [formation] } });
    avecToast(await FicheEtudiant({ id: E }));
    expect(screen.getAllByRole("heading", { level: 3, name: "Intro" })).toHaveLength(2);
    expect(erreurs.mock.calls.some((c) => String(c[0]).includes("same key"))).toBe(false);
    erreurs.mockRestore();
  });

  it("« Envoyer un message » ouvre la conversation avec l'étudiant dans les messages ; un refus s'affiche", async () => {
    const user = userEvent.setup();
    lireSuiviEtudiant.mockResolvedValue({ migrationAbsente: false, donnees: SUIVI });
    ouvrirConversation.mockResolvedValue({ ok: true, id: "c1" });
    avecToast(await FicheEtudiant({ id: E }));
    await user.click(screen.getByRole("button", { name: "Envoyer un message" }));
    expect(ouvrirConversation).toHaveBeenCalledWith(E);
    await waitFor(() => expect(routeur.push).toHaveBeenCalledWith("/formateur/messages?c=c1"));
    ouvrirConversation.mockResolvedValue({ ok: false, message: "Vous ne pouvez pas écrire à cette personne." });
    await user.click(screen.getByRole("button", { name: "Envoyer un message" }));
    expect(await screen.findByText("Vous ne pouvez pas écrire à cette personne.")).toBeInTheDocument();
    expect(routeur.push).toHaveBeenCalledTimes(1);
  });

  it("un compte qui ne suit aucune de ses formations : page introuvable", async () => {
    lireSuiviEtudiant.mockResolvedValue({ migrationAbsente: false, donnees: null });
    await expect(FicheEtudiant({ id: E })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("remarque : la mention, enregistrer, vider pour supprimer ; refus affiché", async () => {
    const user = userEvent.setup();
    lireSuiviEtudiant.mockResolvedValue({ migrationAbsente: false, donnees: SUIVI });
    avecToast(await FicheEtudiant({ id: E }));
    const champ = screen.getByRole("textbox", { name: "Remarque privée" });
    expect(champ).toHaveValue("A du mal avec les formules.");
    expect(screen.getByText("Visible par vous et l’équipe Étudium. Jamais par l’étudiant.")).toBeInTheDocument();
    expect(screen.getByText(/Modifiée le 13 oct\. 2026/)).toBeInTheDocument();
    await user.clear(champ);
    await user.type(champ, "Progresse bien.");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(enregistrerRemarque).toHaveBeenCalledWith(E, "Progresse bien.");
    expect(await screen.findByText("Remarque enregistrée")).toBeInTheDocument();
    await user.clear(champ);
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(enregistrerRemarque).toHaveBeenLastCalledWith(E, "");
    expect(await screen.findByText("Remarque supprimée")).toBeInTheDocument();
    enregistrerRemarque.mockResolvedValue({ ok: false, message: "Cet étudiant ne suit aucune de vos formations." });
    await user.type(champ, "x");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Cet étudiant ne suit aucune de vos formations.");
  });
});
