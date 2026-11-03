// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

// Lot 3 : les certificats délivrés (0033) et les travaux à corriger (0032).
const lireCertificatsFormateur = vi.fn();
vi.mock("@/lib/certificats/data", () => ({ lireCertificatsFormateur: () => lireCertificatsFormateur() }));
const lireCorrections = vi.fn();
vi.mock("@/lib/exercices/data", () => ({ lireCorrections: () => lireCorrections() }));

// « Question récente » : les conversations du formateur (messagerie, migration 0035), la plus récente d'abord.
const lireConversations = vi.fn();
vi.mock("@/lib/messages/data", () => ({ lireConversations: (...a: unknown[]) => lireConversations(...a) }));

const { TableauDeBordFormateur } = await import("@/components/formateur/TableauDeBordFormateur");

type Conversation = import("@/lib/messages/types").ConversationResume;
const conversation = (id: string, nom: string, dernier: Partial<NonNullable<Conversation["dernier"]>>, nonLu = false): Conversation => ({
  id,
  avec: { nom, photoUrl: null, role: "Étudiant·e", equipe: false },
  formation: { titre: "Maîtriser Microsoft Excel", slug: "excel" },
  dernier: { texte: "", fichier: null, deMoi: false, creeLe: "2026-11-03T08:30:00Z", ...dernier },
  nonLu,
});

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
  lireCertificatsFormateur.mockReset().mockResolvedValue(12);
  lireConversations.mockReset().mockResolvedValue({ migrationAbsente: false, donnees: [] });
  lireCorrections.mockReset().mockResolvedValue({
    migrationAbsente: false,
    donnees: [{ renduId: "r1", etudiant: "Aïcha Kpadé", exercice: "Tableau des ventes", formation: "Maîtriser Microsoft Excel", formationId: "f1", module: "Analyse", moduleRang: 3, version: 2, nomFichier: "v2.xlsx", deposeLe: "2026-10-15T08:00:00Z" }],
  });
});

describe("Tableau de bord du formateur", () => {
  it("le titre du design et le bonjour", async () => {
    render(await TableauDeBordFormateur());
    expect(screen.getByRole("heading", { level: 1, name: "Espace formateur" })).toBeInTheDocument();
    expect(screen.getByText("Bonjour Mireille. Voici ce qui demande votre attention aujourd’hui.")).toBeInTheDocument();
  });

  it("les chiffres : formations, étudiants, progression moyenne, certificats délivrés", async () => {
    render(await TableauDeBordFormateur());
    const tuiles = document.querySelectorAll("[data-tuile]");
    const texte = [...tuiles].map((t) => t.textContent).join(" | ");
    expect(texte).toMatch(/Formations\s*3\s*1 en brouillon/);
    expect(texte).toMatch(/Étudiants\s*428\s*\+36 ce mois/);
    expect(texte).toMatch(/Progression moyenne\s*67 %\s*Toutes formations/);
    expect(texte).toMatch(/Certificats délivrés\s*12\s*Dans vos formations/);
  });

  it("avant la 0033 (ou si la lecture échoue), les certificats délivrés : un tiret, sans parler de migration", async () => {
    lireCertificatsFormateur.mockResolvedValue(null);
    render(await TableauDeBordFormateur());
    const texte = [...document.querySelectorAll("[data-tuile]")].map((t) => t.textContent).join(" | ");
    expect(texte).toMatch(/Certificats délivrés\s*—\s*Non disponible pour le moment/);
    expect(texte).not.toMatch(/migration/i);
  });

  it("avant la 0032, les exercices à corriger : le message neutre, sans migration", async () => {
    lireCorrections.mockResolvedValue({ migrationAbsente: true });
    render(await TableauDeBordFormateur());
    expect(screen.getByRole("region", { name: "Exercices à corriger" })).toHaveTextContent("Cette fonction n’est pas disponible pour le moment.");
    expect(document.body).not.toHaveTextContent(/migration/i);
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

  it("exercices à corriger : les plus anciens, vers leur correction", async () => {
    render(await TableauDeBordFormateur());
    const exercices = screen.getByRole("region", { name: "Exercices à corriger" });
    expect(within(exercices).getByRole("link", { name: /Aïcha Kpadé/ })).toHaveAttribute("href", "/formateur/corrections/r1");
    expect(within(exercices).getByRole("link", { name: /Aïcha Kpadé/ })).toHaveTextContent("Tableau des ventes · Maîtriser Microsoft Excel");
    expect(within(exercices).getByRole("link", { name: "Voir toutes les corrections" })).toHaveAttribute("href", "/formateur/corrections");
  });

  it("aucune carte ne parle d'un lot du chantier, même quand les sessions ne se lisent pas", async () => {
    render(await TableauDeBordFormateur());
    expect(document.body).not.toHaveTextContent(/lot \d/i);
    expect(screen.getByRole("region", { name: "Prochaine session live" })).toHaveTextContent("Vos sessions live et leurs inscrits apparaîtront ici.");
  });

  describe("question récente : le dernier message d'un étudiant dans la messagerie", () => {
    const VIDE = "Aucune question pour le moment. Les messages de vos étudiants s’afficheront ici.";
    const carte = () => screen.getByRole("region", { name: "Question récente" });

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-11-03T09:00:00Z"));
    });
    afterEach(() => vi.useRealTimers());

    it("un message non lu : l'étudiant, l'extrait, le moment, « Non lu » et Répondre vers la conversation", async () => {
      lireConversations.mockResolvedValue({
        migrationAbsente: false,
        donnees: [conversation("c1", "Aïcha Kpadé", { texte: "Bonjour,\n\nje n’arrive pas à ouvrir   le module 3." }, true)],
      });
      render(await TableauDeBordFormateur());
      expect(lireConversations).toHaveBeenCalledWith("formateur");
      expect(within(carte()).getByText("Aïcha Kpadé")).toBeInTheDocument();
      expect(within(carte()).getByText("AK")).toBeInTheDocument();
      expect(within(carte()).getByText("Bonjour, je n’arrive pas à ouvrir le module 3.")).toHaveClass("line-clamp-2");
      expect(within(carte()).getByText("il y a 30 min")).toBeInTheDocument();
      expect(within(carte()).getByText("Non lu")).toBeInTheDocument();
      expect(within(carte()).getByRole("link", { name: "Répondre à Aïcha Kpadé" })).toHaveAttribute("href", "/formateur/messages?c=c1");
      expect(carte()).not.toHaveTextContent(/Disponible au lot/);
    });

    it("un message lu, avec une pièce jointe seule : « Pièce jointe », sans « Non lu »", async () => {
      lireConversations.mockResolvedValue({ migrationAbsente: false, donnees: [conversation("c1", "Koffi Mensah", { texte: "", fichier: "devoir.xlsx" })] });
      render(await TableauDeBordFormateur());
      expect(within(carte()).getByText("Pièce jointe")).toBeInTheDocument();
      expect(within(carte()).queryByText("Non lu")).toBeNull();
    });

    it("la photo de l'étudiant quand il en a une", async () => {
      const avecPhoto = conversation("c1", "Koffi Mensah", { texte: "Merci" });
      avecPhoto.avec.photoUrl = "https://exemple.test/koffi.jpg";
      lireConversations.mockResolvedValue({ migrationAbsente: false, donnees: [avecPhoto] });
      render(await TableauDeBordFormateur());
      expect(carte().querySelector("img")).toHaveAttribute("src", "https://exemple.test/koffi.jpg");
    });

    it("le formateur a répondu en dernier : la conversation suivante, où l'étudiant a écrit en dernier", async () => {
      lireConversations.mockResolvedValue({
        migrationAbsente: false,
        donnees: [
          conversation("c1", "Aïcha Kpadé", { texte: "Avec plaisir !", deMoi: true, creeLe: "2026-11-03T08:50:00Z" }),
          conversation("c2", "Koffi Mensah", { texte: "Où trouver le corrigé ?", creeLe: "2026-11-02T08:00:00Z" }),
        ],
      });
      render(await TableauDeBordFormateur());
      expect(within(carte()).queryByText("Aïcha Kpadé")).toBeNull();
      expect(within(carte()).getByText("Koffi Mensah")).toBeInTheDocument();
      expect(within(carte()).getByText("Où trouver le corrigé ?")).toBeInTheDocument();
      expect(within(carte()).getByText("hier")).toBeInTheDocument();
      expect(within(carte()).getByRole("link", { name: "Répondre à Koffi Mensah" })).toHaveAttribute("href", "/formateur/messages?c=c2");
    });

    it("le formateur a répondu partout : le cas vide", async () => {
      lireConversations.mockResolvedValue({ migrationAbsente: false, donnees: [conversation("c1", "Aïcha Kpadé", { texte: "Avec plaisir !", deMoi: true })] });
      render(await TableauDeBordFormateur());
      expect(within(carte()).getByText(VIDE)).toBeInTheDocument();
      expect(within(carte()).queryByRole("link")).toBeNull();
    });

    it("aucun message : la phrase, sans étiquette", async () => {
      render(await TableauDeBordFormateur());
      expect(within(carte()).getByText(VIDE)).toBeInTheDocument();
      expect(carte()).not.toHaveTextContent(/Disponible au lot/);
    });

    it("la lecture échoue, ou la messagerie manque : le même cas vide, sans parler de migration", async () => {
      lireConversations.mockRejectedValue(new Error("réseau"));
      const { unmount } = render(await TableauDeBordFormateur());
      expect(within(carte()).getByText(VIDE)).toBeInTheDocument();
      unmount();
      lireConversations.mockResolvedValue({ migrationAbsente: true });
      render(await TableauDeBordFormateur());
      expect(within(carte()).getByText(VIDE)).toBeInTheDocument();
      expect(carte()).not.toHaveTextContent(/migration/i);
    });
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
    for (const texte of ["Dans 2 jours", "Excel avancé : analyse de données", "Samedi 24 octobre · 15 h 00 (GMT+1)", "Google Meet", "RH", "FA"]) expect(within(carte).getByText(texte)).toBeInTheDocument();
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

  it("sans fiche, avant la 0014 ou la 0015 : les bandeaux, neutres", async () => {
    lireMaFiche.mockResolvedValue({ migrationAbsente: false, fiche: null });
    const { unmount } = render(await TableauDeBordFormateur());
    expect(screen.getByText(/pas encore relié à une fiche formateur/)).toBeInTheDocument();
    unmount();
    lireMaFiche.mockResolvedValue({ migrationAbsente: false, fiche: "fa" });
    lireTableauDeBordFormateur.mockResolvedValue({ migrationAbsente: true });
    render(await TableauDeBordFormateur());
    expect(screen.getByText("Cette fonction n’est pas disponible pour le moment.")).toBeInTheDocument();
    expect(screen.queryByText(/migration|dans la base/i)).toBeNull();
  });
});
