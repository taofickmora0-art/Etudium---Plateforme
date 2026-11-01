// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "./faux-supabase";

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
vi.mock("@/lib/auth/current-user", () => ({ demoModeActive: () => false }));

const { croissance, lireStatistiques } = await import("@/lib/admin/statistiques");
const { TableauDeBordAdmin } = await import("@/components/admin/TableauDeBordAdmin");
const { montantFcfa } = await import("@/lib/abonnement/regles");

const STATS = {
  utilisateurs: 240,
  inscritsSemaine: 12,
  inscritsMois: 40,
  inscritsMoisPrecedent: 31,
  progressionMoyenne: 46,
  formationsSuivies: [
    { titre: "Maîtriser Microsoft Excel", slug: "maitriser-microsoft-excel", etudiants: 21 },
    { titre: "Zotero : gérer ses références", slug: "zotero-gerer-ses-references", etudiants: 14 },
  ],
  abonnesActifs: 30,
  etudiants: 200,
  caMois: 45000,
  caTotal: 180000,
  caParMois: [
    { mois: "2026-06", montant: 0 },
    { mois: "2026-07", montant: 15000 },
    { mois: "2026-08", montant: 30000 },
    { mois: "2026-09", montant: 45000 },
    { mois: "2026-10", montant: 45000 },
    { mois: "2026-11", montant: 45000 },
  ],
  revenusParFormule: [
    { code: "basique", nom: "Basique", montant: 36000, nombre: 4 },
    { code: "standard", nom: "Standard", montant: 120000, nombre: 8 },
    { code: "premium", nom: "Premium", montant: 24000, nombre: 1 },
  ],
};
const texte = (t: string) => t.replace(/\u202f/g, " ");
const tuile = (libelle: string) => screen.getByText(libelle).closest("[data-tuile]") as HTMLElement;

describe("Tableau de bord du back-office : données", () => {
  beforeEach(() => faux.vider());

  it("lit les chiffres de la base ; null sans la migration 0011", async () => {
    faux.repondre("rpc.statistiques_back_office", {
      data: {
        utilisateurs: 240,
        inscrits_semaine: 12,
        inscrits_mois: 40,
        inscrits_mois_precedent: 31,
        progression_moyenne: 46,
        formations_suivies: [{ titre: "Maîtriser Microsoft Excel", slug: "maitriser-microsoft-excel", etudiants: 21 }],
      },
    });
    // Sans la migration 0051 : les chiffres du lot 2 valent 0.
    expect(await lireStatistiques()).toEqual({
      ...STATS,
      formationsSuivies: STATS.formationsSuivies.slice(0, 1),
      abonnesActifs: 0,
      etudiants: 0,
      caMois: 0,
      caTotal: 0,
      caParMois: [],
      revenusParFormule: [],
    });
    faux.repondre("rpc.statistiques_back_office", {
      data: {
        utilisateurs: 240,
        abonnes_actifs: 30,
        etudiants: 200,
        ca_mois: 45000,
        ca_total: 180000,
        ca_par_mois: [{ mois: "2026-11", montant: 45000 }],
        revenus_par_formule: [{ code: "standard", nom: "Standard", montant: 120000, nombre: 8 }],
      },
    });
    expect(await lireStatistiques()).toMatchObject({
      abonnesActifs: 30,
      etudiants: 200,
      caMois: 45000,
      caTotal: 180000,
      caParMois: [{ mois: "2026-11", montant: 45000 }],
      revenusParFormule: [{ code: "standard", nom: "Standard", montant: 120000, nombre: 8 }],
    });
    faux.repondre("rpc.statistiques_back_office", { error: { code: "PGRST202" } });
    expect(await lireStatistiques()).toBeNull();
  });

  it("la croissance du mois : nouveaux inscrits rapportés aux inscrits du début du mois", () => {
    expect(croissance(STATS)).toBe(20);
    expect(croissance({ utilisateurs: 5, inscritsMois: 5 })).toBeNull();
  });
});

describe("Tableau de bord du back-office : écran", () => {
  it("les chiffres clés : inscrits et croissance, nouveaux inscrits de la semaine et du mois", () => {
    render(<TableauDeBordAdmin stats={STATS} />);
    expect(within(tuile("Utilisateurs inscrits")).getByText("240")).toBeInTheDocument();
    expect(within(tuile("Utilisateurs inscrits")).getByText("+20 % ce mois")).toBeInTheDocument();
    expect(within(tuile("Nouveaux inscrits")).getByText("12")).toBeInTheDocument();
    expect(within(tuile("Nouveaux inscrits")).getByText("cette semaine · 40 ce mois (31 le mois dernier)")).toBeInTheDocument();
  });

  it("les tuiles du paiement (lot 2) se remplissent ; les sessions live (lot 5) gardent leur place", () => {
    render(<TableauDeBordAdmin stats={STATS} />);
    expect(screen.queryByText("Disponible au lot 2")).toBeNull();
    expect(within(tuile("Utilisateurs payants")).getByText("30")).toBeInTheDocument();
    expect(within(tuile("Utilisateurs payants")).getByText("abonnements actifs")).toBeInTheDocument();
    expect(within(tuile("Taux de conversion")).getByText("15 %")).toBeInTheDocument();
    expect(within(tuile("Taux de conversion")).getByText("des étudiants ont un abonnement actif")).toBeInTheDocument();
    const ca = tuile("Chiffre d’affaires");
    expect(ca).toHaveTextContent(texte("Ce mois45 000 FCFA"));
    expect(ca).toHaveTextContent(texte("Au total180 000 FCFA"));
    expect(within(ca).getAllByRole("img")).toHaveLength(6);
    // Le nom accessible garde l'espace fine de `Intl` (U+202F).
    expect(within(ca).getByRole("img", { name: `novembre 2026 : ${montantFcfa(45000)}` })).toBeInTheDocument();
    const parFormule = tuile("Revenus par formule");
    expect(parFormule).toHaveTextContent("Standard");
    expect(parFormule).toHaveTextContent(texte("120 000 FCFA"));
    expect(parFormule).toHaveTextContent("8 abonnements");
    expect(parFormule).toHaveTextContent("1 abonnement");
    // Plus de formation achetée seule (restructuration, §5.2).
    expect(screen.queryByText("Formations achetées seules")).toBeNull();
    expect(within(tuile("Sessions live à venir")).getByText("Disponible au lot 5")).toBeInTheDocument();
  });

  it("la tuile des sessions live : leur nombre (migration 0018), sinon « Disponible au lot 5 »", () => {
    const { unmount } = render(<TableauDeBordAdmin stats={STATS} sessionsAVenir={3} />);
    expect(within(tuile("Sessions live à venir")).getByText("3")).toBeInTheDocument();
    expect(within(tuile("Sessions live à venir")).getByText("Programmées")).toBeInTheDocument();
    unmount();
    render(<TableauDeBordAdmin stats={STATS} sessionsAVenir={null} />);
    expect(within(tuile("Sessions live à venir")).getByText("Disponible au lot 5")).toBeInTheDocument();
  });

  it("la tuile de la modération : le nombre à examiner (migration 0020) et le lien vers la file, sinon « Disponible au lot 5 »", () => {
    const { unmount } = render(<TableauDeBordAdmin stats={STATS} aExaminer={4} />);
    expect(within(tuile("Contenus à examiner")).getByText("4")).toBeInTheDocument();
    expect(within(tuile("Contenus à examiner")).getByRole("link", { name: "Ouvrir la file" })).toHaveAttribute("href", "/admin/moderation");
    unmount();
    render(<TableauDeBordAdmin stats={STATS} aExaminer={null} />);
    expect(within(tuile("Contenus à examiner")).getByText("Disponible au lot 5")).toBeInTheDocument();
  });

  it("les formations les plus suivies et la progression moyenne", () => {
    render(<TableauDeBordAdmin stats={STATS} />);
    const top = screen.getByRole("region", { name: "Formations les plus suivies" });
    const lignes = within(top).getAllByRole("listitem");
    expect(within(lignes[0]).getByText("Maîtriser Microsoft Excel")).toBeInTheDocument();
    expect(within(lignes[0]).getByText("21 étudiants")).toBeInTheDocument();
    expect(within(lignes[1]).getByText("14 étudiants")).toBeInTheDocument();
    expect(within(tuile("Progression moyenne")).getByText("46 %")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Progression moyenne" })).toHaveAttribute("aria-valuenow", "46");
  });

  it("sans formation commencée : un message, et pas de moyenne", () => {
    render(<TableauDeBordAdmin stats={{ ...STATS, progressionMoyenne: null, formationsSuivies: [] }} />);
    expect(screen.getByText("Aucune formation commencée pour le moment.")).toBeInTheDocument();
    expect(within(tuile("Progression moyenne")).getByText("—")).toBeInTheDocument();
  });

  it("sans la migration 0011 : on le dit au lieu d'afficher des zéros", () => {
    render(<TableauDeBordAdmin stats={null} />);
    expect(screen.getByText("Les statistiques ne sont pas encore dans la base.")).toBeInTheDocument();
    expect(screen.queryByText("Utilisateurs inscrits")).toBeNull();
  });
});
