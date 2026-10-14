// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { tableauDeBord } from "@/lib/accueil/regles";
import type { FicheFormation } from "@/lib/catalogue/types";
import { formationsSuivies } from "@/lib/mes-formations/regles";
import type { LigneProgression } from "@/lib/progression/types";
import { CARTES_DESIGN } from "../catalogue/cartes-design";
import { EXCEL_OUVERTE, id, ZOTERO } from "../lecon/donnees";

// La carte « Prochaine session live » (sessions live, migration 0018) inscrit par une action du serveur.
const sinscrire = vi.fn(async () => ({ ok: true }));
vi.mock("@/lib/sessions/actions", () => ({ sinscrire: () => sinscrire(), seDesinscrire: vi.fn() }));

const { TableauDeBord } = await import("@/components/accueil/TableauDeBord");

const ligne = (formationId: string, n: number, terminee: boolean, ilYa: number): LigneProgression => ({
  leconId: id(n),
  formationId,
  termineeLe: terminee ? "2026-10-12T10:00:00Z" : null,
  vueLe: new Date(Date.UTC(2026, 9, 13, 12) - ilYa * 60_000).toISOString(),
  positionSecondes: 0,
});
const ZOTERO_OUVERTE: FicheFormation = { ...ZOTERO, modules: ZOTERO.modules.map((m) => ({ ...m, lecons: m.lecons.map((l) => ({ ...l, accessible: true })) })) };
const monter = (fiches: FicheFormation[], lignes: LigneProgression[]) =>
  render(<TableauDeBord donnees={tableauDeBord(formationsSuivies(fiches.map((f) => ({ ...f, statut: "publiee" as const })), lignes, new Set()), CARTES_DESIGN)} />);
// Excel : leçon 1 terminée, leçon 2 ouverte (8 %), visitée après Zotero, dont la leçon 21 est ouverte (0 %).
const DEUX_EN_COURS: [FicheFormation[], LigneProgression[]] = [
  [EXCEL_OUVERTE, ZOTERO_OUVERTE],
  [ligne(EXCEL_OUVERTE.id, 1, true, 20), ligne(EXCEL_OUVERTE.id, 2, false, 10), ligne(ZOTERO.id, 21, false, 30)],
];

describe("Tableau de bord", () => {
  it("les tuiles : progression globale et formations en cours", () => {
    monter(...DEUX_EN_COURS);
    expect(screen.getByText("Progression globale")).toBeInTheDocument();
    expect(screen.getByText("4 %")).toBeInTheDocument();
    expect(screen.getByText("Moyenne de vos formations commencées")).toBeInTheDocument();
    expect(screen.getByText("Formations en cours")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Sur 2 formations commencées")).toBeInTheDocument();
  });

  it("« Continuer l’apprentissage » : la dernière formation, en un clic", () => {
    monter(...DEUX_EN_COURS);
    const bloc = screen.getByRole("region", { name: "Continuer l’apprentissage" });
    expect(within(bloc).getByRole("link", { name: "Mes formations" })).toHaveAttribute("href", "/mes-formations");
    expect(within(bloc).getByRole("heading", { level: 3, name: "Maîtriser Microsoft Excel" })).toBeInTheDocument();
    expect(within(bloc).getByText("Module 1 · Saisir et mettre en forme des données · 13 min")).toBeInTheDocument();
    expect(within(bloc).getByText("Académique")).toBeInTheDocument();
    expect(within(bloc).getByRole("progressbar", { name: "Progression de Maîtriser Microsoft Excel" })).toHaveAttribute("aria-valuenow", "8");
    expect(within(bloc).getByText("8 % terminé")).toBeInTheDocument();
    expect(within(bloc).getByText("2 h 14 restantes")).toBeInTheDocument();
    const reprendre = within(bloc).getByRole("link", { name: "Reprendre la leçon" });
    expect(reprendre).toHaveAttribute("href", `/formations/maitriser-microsoft-excel/lecons/${id(2)}`);
    expect(reprendre).toHaveAccessibleDescription("Maîtriser Microsoft Excel");
    expect(within(bloc).getByRole("link", { name: "Voir le parcours" })).toHaveAttribute("href", "/parcours?parcours=reussite-academique");
  });

  it("la carte « Continuer » montre la couverture de la formation", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://projet.supabase.co");
    const { container } = monter([{ ...EXCEL_OUVERTE, couverture: "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.jpg" }, ZOTERO_OUVERTE], DEUX_EN_COURS[1]);
    const bloc = screen.getByRole("region", { name: "Continuer l’apprentissage" });
    expect(decodeURIComponent(bloc.querySelector("img")?.getAttribute("src") ?? "")).toContain("https://projet.supabase.co/storage/v1/object/public/couvertures/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.jpg");
    expect(container).toBeTruthy();
    vi.unstubAllEnvs();
  });

  it("« À faire » : la leçon suivante des autres formations en cours", () => {
    monter(...DEUX_EN_COURS);
    const bloc = screen.getByRole("region", { name: "À faire" });
    expect(within(bloc).getByText("1 élément")).toBeInTheDocument();
    const lien = within(bloc).getByRole("link", { name: /Leçon suivante.*Zotero : gérer ses références · Installer Zotero/ });
    expect(lien).toHaveAttribute("href", `/formations/zotero-gerer-ses-references/lecons/${id(21)}`);
  });

  it("« Recommandé pour vous » : des cartes titrées en h3, et « Tout voir »", () => {
    monter(...DEUX_EN_COURS);
    const bloc = screen.getByRole("region", { name: "Recommandé pour vous" });
    expect(within(bloc).getByRole("link", { name: "Tout voir" })).toHaveAttribute("href", "/formations");
    expect(within(bloc).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Microsoft Word pour vos travaux universitaires",
      "PowerPoint : réussir sa soutenance",
      "Méthodologie du mémoire",
    ]);
  });

  it("rien commencé : l'état vide mène aux formations gratuites", () => {
    monter([], []);
    expect(screen.getByRole("heading", { name: "Commencez votre première formation" })).toBeInTheDocument();
    expect(screen.getByText("Les formations gratuites sont ouvertes à tous : choisissez-en une et suivez la première leçon.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voir les formations gratuites" })).toHaveAttribute("href", "/formations-gratuites");
    const gratuites = screen.getByRole("region", { name: "Formations gratuites" });
    expect(within(gratuites).getByRole("link", { name: "Tout voir" })).toHaveAttribute("href", "/formations-gratuites");
    expect(within(gratuites).getAllByRole("heading", { level: 3 })).toHaveLength(2);
    expect(screen.queryByText("Progression globale")).toBeNull();
    expect(screen.queryByRole("region", { name: "Continuer l’apprentissage" })).toBeNull();
  });

  it("plus rien en cours : les tuiles et les recommandations, sans « Continuer » ni « À faire »", () => {
    monter([ZOTERO_OUVERTE], [ligne(ZOTERO.id, 21, true, 30), ligne(ZOTERO.id, 22, true, 20)]);
    expect(screen.getByText("100 %")).toBeInTheDocument();
    expect(screen.getByText("Sur 1 formation commencée")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Continuer l’apprentissage" })).toBeNull();
    expect(screen.queryByRole("region", { name: "À faire" })).toBeNull();
    expect(screen.getByRole("region", { name: "Recommandé pour vous" })).toBeInTheDocument();
  });

  it("une formation hors parcours : ni étiquette ni « Voir le parcours »", () => {
    monter([{ ...EXCEL_OUVERTE, parcours: [] }], [ligne(EXCEL_OUVERTE.id, 2, false, 10)]);
    const bloc = screen.getByRole("region", { name: "Continuer l’apprentissage" });
    expect(within(bloc).queryByText("Académique")).toBeNull();
    expect(within(bloc).queryByRole("link", { name: "Voir le parcours" })).toBeNull();
    expect(within(bloc).getByRole("link", { name: "Reprendre la leçon" })).toBeInTheDocument();
  });
});

describe("Prochaine session live (sessions live, migration 0018)", () => {
  const SESSION = {
    id: "11111111-1111-4111-8111-111111111111",
    titre: "Excel avancé : analyse de données",
    description: "",
    debut: "2099-10-24T14:00:00Z",
    dureeMinutes: 60,
    plateforme: "Google Meet",
    lien: null,
    parcours: { nomCourt: "Académique", couleur: "academique" },
    animateur: "Dr Mireille Adjovi",
    inscriptions: 128,
    inscrit: false,
    statut: "programmee" as const,
    initiales: ["RH", "FA", "SD"],
  };
  const donnees = (fiches: FicheFormation[], lignes: LigneProgression[]) => tableauDeBord(formationsSuivies(fiches.map((f) => ({ ...f, statut: "publiee" as const })), lignes, new Set()), CARTES_DESIGN);

  it("la carte du design : lien Événements, initiales, 128 inscriptions, Je m’inscris à la session", async () => {
    render(<TableauDeBord donnees={donnees(...DEUX_EN_COURS)} session={SESSION} />);
    const bloc = screen.getByRole("region", { name: "Prochaine session live" });
    expect(within(bloc).getByRole("link", { name: "Événements" })).toHaveAttribute("href", "/evenements");
    for (const texte of ["Excel avancé : analyse de données", "Google Meet", "Dr Mireille Adjovi", "RH", "FA", "SD", "128 inscriptions"]) expect(within(bloc).getByText(texte)).toBeInTheDocument();
    await userEvent.setup().click(within(bloc).getByRole("button", { name: "Je m’inscris à la session" }));
    expect(sinscrire).toHaveBeenCalled();
    expect(await within(bloc).findByText("Inscription confirmée")).toBeInTheDocument();
  });

  it("aussi pour qui n'a rien commencé ; sans session, pas de carte", () => {
    const { unmount } = render(<TableauDeBord donnees={donnees([], [])} session={SESSION} />);
    expect(screen.getByRole("region", { name: "Prochaine session live" })).toBeInTheDocument();
    unmount();
    render(<TableauDeBord donnees={donnees(...DEUX_EN_COURS)} session={null} />);
    expect(screen.queryByRole("region", { name: "Prochaine session live" })).toBeNull();
  });
});
