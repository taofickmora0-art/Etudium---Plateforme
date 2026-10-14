// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TableauDeBordFormateur as Donnees } from "@/lib/formateur/suivi";

// Tableau de bord du formateur (design NdFormateur ; spec « Étudiants » et tableau de bord du formateur, §4).

const lireMaFiche = vi.fn();
vi.mock("@/lib/formateur/data", () => ({ lireMaFiche: () => lireMaFiche(), estMaFormation: vi.fn() }));
const lireTableauDeBordFormateur = vi.fn();
vi.mock("@/lib/formateur/suivi", () => ({ lireTableauDeBordFormateur: () => lireTableauDeBordFormateur(), lireSuivi: vi.fn(), lireSuiviEtudiant: vi.fn() }));

// La carte « Prochaine session live » lit les sessions du formateur (migration 0018).
const lireSessionsAnimees = vi.fn();
const lireSessionDetail = vi.fn();
vi.mock("@/lib/sessions/data", () => ({ lireSessionsAnimees: () => lireSessionsAnimees(), lireSessionDetail: (...a: unknown[]) => lireSessionDetail(...a) }));

const { TableauDeBordFormateur } = await import("@/components/formateur/TableauDeBordFormateur");

const DONNEES: Donnees = {
  prenom: "Mireille",
  formations: { total: 3, brouillons: 1 },
  etudiants: { total: 428, ceMois: 36 },
  progressionMoyenne: 67,
  aRisque: [{ etudiantId: "e1", prenom: "Fifamè", nom: "Agossou", formationId: "f1", formationTitre: "Maîtriser Microsoft Excel", jours: 14, pourcentage: 22 }],
  formationsDetail: [
    { id: "f1", titre: "Maîtriser Microsoft Excel", etat: "publiee", inscrits: 214, progressionMoyenne: 71, completion: 38, noteMoyenne: 4.8, nbAvis: 12 },
    { id: "f2", titre: "Power Query pour débutants", etat: "brouillon", inscrits: 0, progressionMoyenne: null, completion: null, noteMoyenne: null, nbAvis: 0 },
  ],
};

beforeEach(() => {
  lireMaFiche.mockReset();
  lireTableauDeBordFormateur.mockReset();
  lireMaFiche.mockResolvedValue({ migrationAbsente: false, fiche: "fa" });
  lireTableauDeBordFormateur.mockResolvedValue({ migrationAbsente: false, donnees: DONNEES });
  lireSessionsAnimees.mockReset().mockResolvedValue({ migrationAbsente: true });
  lireSessionDetail.mockReset();
});

describe("Tableau de bord du formateur", () => {
  it("le titre du design et le bonjour", async () => {
    render(await TableauDeBordFormateur());
    expect(screen.getByRole("heading", { level: 1, name: "Espace formateur" })).toBeInTheDocument();
    expect(screen.getByText("Bonjour Mireille. Voici ce qui demande votre attention aujourd’hui.")).toBeInTheDocument();
  });

  it("les chiffres : formations, étudiants, progression moyenne, certificats (lot 3)", async () => {
    render(await TableauDeBordFormateur());
    const tuiles = document.querySelectorAll("[data-tuile]");
    const texte = [...tuiles].map((t) => t.textContent).join(" | ");
    expect(texte).toMatch(/Formations\s*3\s*1 en brouillon/);
    expect(texte).toMatch(/Étudiants\s*428\s*\+36 ce mois/);
    expect(texte).toMatch(/Progression moyenne\s*67 %\s*Toutes formations/);
    expect(texte).toMatch(/Certificats délivrés\s*—\s*Disponible au lot 3/);
  });

  it("étudiants à risque : l'inactivité, la formation, la progression, et le lien vers le suivi", async () => {
    render(await TableauDeBordFormateur());
    const carte = screen.getByRole("region", { name: "Étudiants à risque" });
    expect(carte).toHaveTextContent("Inactifs depuis plus de 10 jours.");
    expect(carte).toHaveTextContent("Fifamè Agossou");
    expect(carte).toHaveTextContent("Aucune activité depuis 14 jours · Maîtriser Microsoft Excel 22 %");
    expect(within(carte).getByRole("link", { name: "Voir le suivi de Fifamè Agossou" })).toHaveAttribute("href", "/formateur/etudiants/e1");
  });

  it("un étudiant à risque sur deux formations de même titre : aucune clé en double", async () => {
    const erreurs = vi.spyOn(console, "error").mockImplementation(() => {});
    const risque = (formationId: string) => ({ etudiantId: "e1", prenom: "Fifamè", nom: "Agossou", formationId, formationTitre: "Excel", jours: 14, pourcentage: 22 });
    lireTableauDeBordFormateur.mockResolvedValue({ migrationAbsente: false, donnees: { ...DONNEES, aRisque: [risque("f1"), risque("f2")] } });
    render(await TableauDeBordFormateur());
    expect(within(screen.getByRole("region", { name: "Étudiants à risque" })).getAllByRole("listitem")).toHaveLength(2);
    expect(erreurs.mock.calls.some((c) => String(c[0]).includes("same key"))).toBe(false);
    erreurs.mockRestore();
  });

  it("aucun étudiant à risque : le message", async () => {
    lireTableauDeBordFormateur.mockResolvedValue({ migrationAbsente: false, donnees: { ...DONNEES, aRisque: [] } });
    render(await TableauDeBordFormateur());
    expect(within(screen.getByRole("region", { name: "Étudiants à risque" })).getByText("Aucun étudiant à risque.")).toBeInTheDocument();
  });

  it("mes formations : inscrits, progression, complétion, note, statut, Modifier ; — sans étudiant", async () => {
    render(await TableauDeBordFormateur());
    const lignes = within(screen.getByRole("table", { name: "Mes formations" })).getAllByRole("row").slice(1);
    expect(within(lignes[0]).getAllByRole("cell").map((c) => c.textContent)).toEqual(["Maîtriser Microsoft Excel", "214", "71 %", "38 %", "4,8", "Publiée", "Modifier"]);
    expect(within(lignes[0]).getByRole("link", { name: "Modifier Maîtriser Microsoft Excel" })).toHaveAttribute("href", "/formateur/formations/f1");
    expect(within(lignes[1]).getAllByRole("cell").map((c) => c.textContent)).toEqual(["Power Query pour débutants", "0", "—", "—", "—", "Brouillon", "Modifier"]);
  });

  it("exercices, session live et question récente : disponibles aux lots 3 et 5", async () => {
    render(await TableauDeBordFormateur());
    expect(screen.getByRole("region", { name: "Exercices à corriger" })).toHaveTextContent("Disponible au lot 3");
    expect(screen.getByRole("region", { name: "Prochaine session live" })).toHaveTextContent("Disponible au lot 5");
    expect(screen.getByRole("region", { name: "Question récente" })).toHaveTextContent("Disponible au lot 5");
  });

  it("prochaine session live : Dans 2 jours, titre, date, plateforme, initiales, Voir la session", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-22T09:00:00Z"));
    const session = { id: "s1", titre: "Excel avancé : analyse de données", debut: "2026-10-24T14:00:00Z", dureeMinutes: 60, plateforme: "Google Meet", statut: "programmee", inscriptions: 7, parcours: null, animateur: "Mireille Akpo" };
    lireSessionsAnimees.mockResolvedValue({ migrationAbsente: false, donnees: { aVenir: [{ ...session, id: "s0", statut: "annulee" }, session], passees: [] } });
    lireSessionDetail.mockResolvedValue({
      migrationAbsente: false,
      donnees: { ...session, description: "", lien: "https://meet.google.com/x", formateurId: "fa", annuleeLe: null, inscrits: [{ prenom: "Rodrigue", nom: "Houngbo" }, { prenom: "Fifamè", nom: "Adjovi" }] },
    });
    render(await TableauDeBordFormateur());
    const carte = screen.getByRole("region", { name: "Prochaine session live" });
    for (const texte of ["Dans 2 jours", "Excel avancé : analyse de données", "Samedi 24 octobre · 15 h 00", "Google Meet", "RH", "FA"]) expect(within(carte).getByText(texte)).toBeInTheDocument();
    expect(within(carte).getByRole("link", { name: "Voir la session" })).toHaveAttribute("href", "/formateur/sessions/s1");
    expect(lireSessionDetail).toHaveBeenCalledWith("s1");
    vi.useRealTimers();
  });

  it("aucune session programmée : le message et Nouvelle session", async () => {
    lireSessionsAnimees.mockResolvedValue({ migrationAbsente: false, donnees: { aVenir: [], passees: [] } });
    render(await TableauDeBordFormateur());
    const carte = screen.getByRole("region", { name: "Prochaine session live" });
    expect(within(carte).getByText("Aucune session programmée.")).toBeInTheDocument();
    expect(within(carte).getByRole("link", { name: "Nouvelle session" })).toHaveAttribute("href", "/formateur/sessions/nouvelle");
  });

  it("sans fiche, avant la 0014 ou la 0015 : les bandeaux", async () => {
    lireMaFiche.mockResolvedValue({ migrationAbsente: false, fiche: null });
    const { unmount } = render(await TableauDeBordFormateur());
    expect(screen.getByText(/pas encore relié à une fiche formateur/)).toBeInTheDocument();
    unmount();
    lireMaFiche.mockResolvedValue({ migrationAbsente: false, fiche: "fa" });
    lireTableauDeBordFormateur.mockResolvedValue({ migrationAbsente: true });
    render(await TableauDeBordFormateur());
    expect(screen.getByText(/Appliquez la migration 0015/)).toBeInTheDocument();
  });
});
