// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CarteCatalogue } from "@/lib/catalogue/types";
import { DEMO_JEU } from "@/lib/demo-user";
import type { ProchaineSession } from "@/lib/sessions/types";
import type { DonneesTableau } from "@/lib/tableau-de-bord/types";

// La page « Tableau de bord » de l'étudiant (lot 6 B, §1 ; design NdAccueil) : elle répond aux 4 questions (où en
// suis-je, que continuer, que faire maintenant, qu'apprendre ensuite).

const { sinscrire } = vi.hoisted(() => ({ sinscrire: vi.fn() }));
vi.mock("@/lib/sessions/actions", () => ({ sinscrire }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const { TableauDeBord } = await import("@/components/tableau-de-bord/TableauDeBord");
const { LIEN } = await import("@/components/tableau-de-bord/Blocs");

const MAINTENANT = "2026-11-04T15:00:00Z";
const carte = (id: string, titre: string): CarteCatalogue => ({
  id,
  slug: `s-${id}`,
  titre,
  resume: `Résumé de ${titre}`,
  niveau: "intermediaire",
  gratuite: false,
  badge: null,
  publieeLe: "2026-10-01T00:00:00Z",
  dureeSecondes: 27_900,
  nbLecons: 12,
  parcours: [{ slug: "academique", nom: "Réussite académique", nomCourt: "Académique", couleur: "academique", ordre: 1, position: 2 }],
  note: 4.9,
  nbAvis: 143,
  couverture: null,
});
const SESSION: ProchaineSession = {
  id: "s1",
  titre: "Excel avancé : analyse de données",
  description: "",
  debut: "2026-11-07T14:00:00Z",
  dureeMinutes: 60,
  plateforme: "Google Meet",
  lien: null,
  parcours: null,
  animateur: "Dr Mireille Adjovi",
  inscriptions: 128,
  inscrit: false,
  statut: "programmee",
  initiales: ["RH", "FA", "SD"],
};
const PLEIN: DonneesTableau = {
  prenom: "Aïcha",
  indicateurs: { progression: 72, progressionMois: 12, enCours: 4, commencees: 10 },
  continuer: {
    titre: "Maîtriser Microsoft Excel",
    parcours: { slug: "academique", nom: "Réussite académique", nomCourt: "Académique", couleur: "academique", ordre: 1 },
    lecon: "Module 3 · Les tableaux croisés dynamiques · 12 min",
    pourcentage: 68,
    temps: "2 h restantes",
    href: "/formations/excel/lecons/l3",
    hrefFormation: "/formations/excel",
  },
  aFaire: [
    { type: "exercice", titre: "Exercice à corriger", detail: "Excel · Tableau des ventes", href: "/formations/excel/lecons/e1", etiquette: "À corriger" },
    { type: "quiz", titre: "Quiz à repasser", detail: "Excel · Quiz du module 3", href: "/formations/excel/lecons/q3" },
    { type: "lecon", titre: "Leçon suivante", detail: "Canva · Créer une affiche", href: "/formations/canva/lecons/c2" },
  ],
  base: {
    certificats: { nombre: 2, titres: ["Word", "Zotero"] },
    aFaire: [],
    activite: [
      { type: "exercice", titre: "Mise en page du mémoire", formation: "Word", score: null, quand: "2026-11-04T13:00:00Z" },
      { type: "certificat", titre: "Zotero : gérer ses références", formation: null, score: null, quand: "2026-11-03T10:00:00Z" },
      { type: "quiz", titre: "Module 1", formation: "Canva", score: 90, quand: "2026-11-02T10:00:00Z" },
      { type: "badge", titre: "serie_7", formation: null, score: null, quand: "2026-11-01T10:00:00Z" },
    ],
    jeu: { ...DEMO_JEU, serie: 8, pointsSemaine: 165, niveau: 4, objectifJours: 5, joursSemaine: [true, true, true, false, false, false, false] },
    recommandations: [],
  },
  session: SESSION,
  recommandees: [carte("r1", "Méthodologie du mémoire"), carte("r2", "L’intelligence artificielle au service de vos études"), carte("r3", "Lancer son activité de freelance")],
  messageSuite: "Vous avez terminé « Zotero ». Découvrez maintenant « Méthodologie du mémoire ».",
  aucunePubliee: false,
  maintenant: MAINTENANT,
};
const VIDE: DonneesTableau = {
  ...PLEIN,
  indicateurs: { progression: 0, progressionMois: 0, enCours: 0, commencees: 0 },
  continuer: null,
  aFaire: [],
  base: { certificats: { nombre: 0, titres: [] }, aFaire: [], activite: [], jeu: { ...DEMO_JEU, serie: 0, pointsSemaine: 0, niveau: 1, joursSemaine: Array(7).fill(false), badges: [] }, recommandations: [] },
  session: null,
  messageSuite: null,
};

const section = (titre: string) => screen.getByRole("region", { name: titre });

beforeEach(() => {
  sinscrire.mockReset();
});

describe("Le tableau de bord", () => {
  it("où en suis-je : le bonjour et les quatre indicateurs", () => {
    render(<TableauDeBord donnees={PLEIN} />);
    expect(screen.getByRole("heading", { level: 1, name: "Bonjour, Aïcha" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explorer le catalogue" })).toHaveAttribute("href", "/formations");
    const tuiles = screen.getAllByTestId("indicateur").map((t) => t.textContent);
    expect(tuiles).toEqual([
      "Progression globale72 %+12 % ce mois",
      "Formations en cours4Sur 10 formations",
      "Certificats obtenus2Word et Zotero",
      "Série d’apprentissage8 joursContinuez comme ça",
    ]);
  });

  it("que dois-je continuer : la formation en cours et sa leçon", () => {
    render(<TableauDeBord donnees={PLEIN} />);
    const bloc = section("Continuer l’apprentissage");
    expect(within(bloc).getByRole("heading", { name: "Maîtriser Microsoft Excel" })).toBeInTheDocument();
    expect(within(bloc).getByText("Module 3 · Les tableaux croisés dynamiques · 12 min")).toBeInTheDocument();
    expect(within(bloc).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "68");
    expect(within(bloc).getByRole("link", { name: "Reprendre la leçon" })).toHaveAttribute("href", "/formations/excel/lecons/l3");
    expect(within(bloc).getByRole("link", { name: "Voir le parcours" })).toHaveAttribute("href", "/formations/excel");
    expect(within(bloc).getByRole("link", { name: "Mes formations" })).toHaveAttribute("href", "/mes-formations");
  });

  it("que dois-je faire maintenant : « À faire » et la prochaine session, avec l'inscription d'un clic", async () => {
    sinscrire.mockResolvedValue({ ok: true });
    render(<TableauDeBord donnees={PLEIN} />);
    const aFaire = section("À faire");
    expect(within(aFaire).getByText("3 éléments")).toBeInTheDocument();
    expect(within(aFaire).getAllByRole("link").map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
      ["Exercice à corrigerExcel · Tableau des ventesÀ corriger", "/formations/excel/lecons/e1"],
      ["Quiz à repasserExcel · Quiz du module 3", "/formations/excel/lecons/q3"],
      ["Leçon suivanteCanva · Créer une affiche", "/formations/canva/lecons/c2"],
    ]);
    const session = section("Prochaine session");
    expect(within(session).getByText("Excel avancé : analyse de données")).toBeInTheDocument();
    expect(within(session).getByText("+128 inscrits")).toBeInTheDocument();
    await userEvent.click(within(session).getByRole("button", { name: "Je m’inscris à la session" }));
    expect(sinscrire).toHaveBeenCalledWith("s1");
    expect(await within(session).findByText("Inscription confirmée")).toBeInTheDocument();
  });

  it("une session programmée : « Voir les événements » sous la session, le même lien simple que sans session", () => {
    render(<TableauDeBord donnees={PLEIN} />);
    const lien = within(section("Prochaine session")).getByRole("link", { name: "Voir les événements" });
    expect(lien).toHaveAttribute("href", "/evenements");
    expect(lien.className).toBe(LIEN);
    // Sous la session : après son bouton d'inscription.
    const bouton = within(section("Prochaine session")).getByRole("button", { name: "Je m’inscris à la session" });
    expect(bouton.compareDocumentPosition(lien) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("l'inscription refusée : le message de la base s'affiche", async () => {
    sinscrire.mockResolvedValue({ ok: false, message: "Les sessions live sont réservées aux abonnés." });
    render(<TableauDeBord donnees={PLEIN} />);
    await userEvent.click(within(section("Prochaine session")).getByRole("button", { name: "Je m’inscris à la session" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Les sessions live sont réservées aux abonnés.");
  });

  it("l'objectif de la semaine : les jours faits, la barre, les points et le niveau", () => {
    render(<TableauDeBord donnees={PLEIN} />);
    const bloc = section("Objectif de la semaine");
    expect(within(bloc).getByText("3 / 5 jours")).toBeInTheDocument();
    expect(within(bloc).getByText("Apprendre 5 jours cette semaine.")).toBeInTheDocument();
    expect(within(bloc).getAllByRole("listitem").map((j) => j.getAttribute("aria-label"))).toEqual([
      "Lundi, jour d’apprentissage",
      "Mardi, jour d’apprentissage",
      "Mercredi, jour d’apprentissage",
      "Jeudi",
      "Vendredi",
      "Samedi",
      "Dimanche",
    ]);
    expect(within(bloc).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "60");
    expect(within(bloc).getByText("Points gagnés cette semaine : 165")).toBeInTheDocument();
    expect(within(bloc).getByText("Niveau 4")).toBeInTheDocument();
  });

  it("qu'est-ce que je peux apprendre ensuite : l'activité récente et les recommandations", () => {
    render(<TableauDeBord donnees={PLEIN} />);
    const activite = section("Activité récente");
    expect(within(activite).getAllByRole("listitem").map((l) => l.textContent)).toEqual([
      "Exercice validéWord · Mise en page du mémoireIl y a 2 h",
      "Nouveau certificatZotero : gérer ses référencesHier",
      "Quiz réussi · 90 %Canva · Module 1Il y a 2 jours",
    ]);
    const recos = section("Recommandé pour vous");
    expect(within(recos).getByText("Vous avez terminé « Zotero ». Découvrez maintenant « Méthodologie du mémoire ».")).toBeInTheDocument();
    expect(within(recos).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Méthodologie du mémoire",
      "L’intelligence artificielle au service de vos études",
      "Lancer son activité de freelance",
    ]);
    expect(within(recos).getByRole("link", { name: "Tout voir" })).toHaveAttribute("href", "/formations");
  });

  it("rien de commencé : « Commencez votre première formation », et des cas vides partout", () => {
    render(<TableauDeBord donnees={VIDE} />);
    expect(within(section("Continuer l’apprentissage")).getByText("Commencez votre première formation")).toBeInTheDocument();
    // Harmonisé (demande du 2 novembre 2026) : comme le bloc « Prochaine session », une phrase et un simple lien.
    const lienCatalogue = within(section("Continuer l’apprentissage")).getByRole("link", { name: "Explorer le catalogue" });
    expect(lienCatalogue).toHaveAttribute("href", "/formations");
    expect(lienCatalogue.className).toContain("text-bleu");
    expect(lienCatalogue.className).not.toContain("bg-");
    expect(within(section("Prochaine session")).getByRole("link", { name: "Voir les événements" })).toHaveAttribute("href", "/evenements");
    expect(within(section("À faire")).getByText("Rien à faire pour l’instant.")).toBeInTheDocument();
    expect(within(section("Prochaine session")).getByText("Aucune session programmée pour l’instant.")).toBeInTheDocument();
    expect(within(section("Activité récente")).getByText("Votre activité apparaîtra ici : quiz réussis, exercices validés, certificats et badges.")).toBeInTheDocument();
    expect(screen.getAllByTestId("indicateur").map((t) => t.textContent)).toEqual([
      "Progression globale0 %+0 % ce mois",
      "Formations en cours0Sur 0 formation",
      "Certificats obtenus0Aucun pour l’instant",
      "Série d’apprentissage0 jourApprenez aujourd’hui pour la lancer",
    ]);
    expect(within(section("Recommandé pour vous")).getAllByRole("heading", { level: 3 })).toHaveLength(3);
  });

  it("toutes les formations commencées : le catalogue à la place des recommandations", () => {
    render(<TableauDeBord donnees={{ ...PLEIN, recommandees: [], messageSuite: null }} />);
    const recos = section("Recommandé pour vous");
    expect(within(recos).getByText("Vous avez déjà commencé toutes les formations disponibles.")).toBeInTheDocument();
    expect(within(recos).getByRole("link", { name: "Voir le catalogue" })).toHaveAttribute("href", "/formations");
  });

  it("aucune formation publiée : on le dit, sans prétendre qu'il a tout commencé", () => {
    render(<TableauDeBord donnees={{ ...VIDE, recommandees: [], aucunePubliee: true }} />);
    const recos = section("Recommandé pour vous");
    expect(within(recos).getByText("Aucune formation n’est encore publiée.")).toBeInTheDocument();
    expect(within(recos).queryByText("Vous avez déjà commencé toutes les formations disponibles.")).toBeNull();
  });

  it("migration 0063 absente : le bandeau, et la page tient (sans objectif ni activité)", () => {
    render(<TableauDeBord donnees={{ ...PLEIN, base: null }} />);
    expect(screen.getByText("Appliquez la migration 0063 (guide « Ce qui te revient », section 62).")).toBeInTheDocument();
    expect(section("Continuer l’apprentissage")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Objectif de la semaine" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Activité récente" })).toBeNull();
  });
});
