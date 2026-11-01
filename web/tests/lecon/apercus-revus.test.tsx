// @vitest-environment jsdom
import { render as rendre, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { FicheFormation } from "@/lib/catalogue/types";
import type { DonneesLecon, LeconDetail } from "@/lib/lecon/types";
import { EXCEL, EXCEL_OUVERTE, id } from "./donnees";

// Les aperçus de leçon revus (liste du 31 octobre 2026, tâche 12) : en aperçu (formateur, équipe), rien ne s'enregistre
// ni ne s'envoie, et le retour mène à l'éditeur ; un compte sans accès voit ses leçons d'aperçu signalées ; « Leçon
// suivante » ne mène jamais à un cadenas.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/formations" }));
vi.mock("@/lib/lecon/actions", () => ({ enregistrerNote: vi.fn(), lienRessource: vi.fn(), lienConsultation: vi.fn(), ouvrirLecon: vi.fn(async () => undefined), terminerLecon: vi.fn() }));
vi.mock("@/lib/exercices/actions", () => ({ terminerExercice: vi.fn(), deposerTravail: vi.fn() }));
vi.mock("@/lib/video/adaptateurs", () => ({ creerAdaptateur: () => new Promise(() => {}) }));

const { ContenuLecon } = await import("@/components/lecon/ContenuLecon");
const { ProgrammeLecon } = await import("@/components/lecon/ProgrammeLecon");
const { ProgrammeMobile } = await import("@/components/lecon/ProgrammeMobile");
const { voisines, verrou } = await import("@/lib/lecon/regles");

const render = (element: ReactElement) => rendre(<ToastProvider>{element}</ToastProvider>);
const LECON: LeconDetail = {
  id: id(2),
  titre: "Saisir et mettre en forme des données",
  dureeSecondes: 750,
  apercu: true,
  accessible: true,
  resume: "",
  pointsCles: [],
  video: null,
  texte: "Ouvrez Excel.",
  ressources: [],
  visionnage: null,
};
const donnees = (fiche: FicheFormation, lecon: Partial<LeconDetail> = {}): DonneesLecon => ({ fiche, lecon: { ...LECON, ...lecon }, note: null, notesDisponibles: true });
/** Excel, la leçon 3 devenue un exercice avec rendu. */
const AVEC_EXERCICE: FicheFormation = {
  ...EXCEL_OUVERTE,
  modules: EXCEL_OUVERTE.modules.map((m, i) => (i === 0 ? { ...m, lecons: m.lecons.map((l) => (l.id === id(3) ? { ...l, type: "exercice" as const } : l)) } : m)),
};

describe("En aperçu (formateur, équipe)", () => {
  it("un exercice : ce que fera l'étudiant, sans rien à envoyer", () => {
    render(
      <ContenuLecon
        donnees={{ ...donnees(AVEC_EXERCICE, { id: id(3), apercu: false }), exercice: { genre: "rendu", statut: null, peutDeposer: true, versions: [] } }}
        connecte
        apercu="formateur"
      />,
    );
    expect(screen.getByText("Aperçu : ici, l’étudiant dépose son travail et suit sa correction. Rien n’est envoyé depuis l’aperçu.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Votre travail" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Marquer comme terminé" })).toBeNull();
  });

  it("une leçon : pas d'onglet Notes (rien n'y serait retrouvé) ; les ressources restent", () => {
    render(<ContenuLecon donnees={donnees(EXCEL_OUVERTE)} connecte apercu="lecon" />);
    expect(screen.queryByRole("tab", { name: "Notes" })).toBeNull();
    expect(screen.getAllByText("Aucune ressource pour cette leçon.").length).toBeGreaterThan(0);
  });

  it("le programme : « Retour à l'édition » vers l'onglet Programme de l'éditeur ; pas de progression", () => {
    render(
      <ProgrammeLecon
        fiche={EXCEL_OUVERTE}
        leconId={id(2)}
        connecte
        terminees={new Set()}
        retour={{ href: "/formateur/formations/f1?onglet=programme", libelle: "Retour à l’édition" }}
        progression={false}
      />,
    );
    expect(screen.getByRole("link", { name: "Retour à l’édition" })).toHaveAttribute("href", "/formateur/formations/f1?onglet=programme");
    expect(screen.queryByRole("link", { name: "Mes formations" })).toBeNull();
    expect(screen.queryByText("Validation et certificat")).toBeNull();
  });

  it("sur téléphone aussi, une leçon en brouillon porte son étiquette", () => {
    const brouillon: FicheFormation = {
      ...EXCEL_OUVERTE,
      modules: EXCEL_OUVERTE.modules.map((m, i) => (i === 0 ? { ...m, lecons: m.lecons.map((l) => (l.id === id(4) ? { ...l, publiee: false } : l)) } : m)),
    };
    render(<ProgrammeMobile fiche={brouillon} leconId={id(2)} connecte terminees={new Set()} />);
    const ligne = screen.getByRole("link", { name: /Références relatives/ });
    expect(within(ligne).getByText("Brouillon")).toBeInTheDocument();
  });
});

describe("Un compte sans accès, ou un visiteur", () => {
  it("le programme signale les leçons d'aperçu, ouvertes au milieu des cadenas", () => {
    render(<ProgrammeLecon fiche={EXCEL} leconId={id(1)} connecte terminees={new Set()} />);
    const ligne = screen.getByRole("link", { name: /Saisir et mettre en forme/ });
    expect(within(ligne).getByText("Aperçu")).toBeInTheDocument();
  });

  it("toutes les leçons ouvertes : aucune étiquette « Aperçu »", () => {
    render(<ProgrammeLecon fiche={EXCEL_OUVERTE} leconId={id(1)} connecte terminees={new Set()} />);
    expect(screen.queryByText("Aperçu")).toBeNull();
  });

  it("connecté sur une leçon d'aperçu : le bandeau de l'aperçu gratuit, et « Voir les abonnements »", () => {
    render(<ContenuLecon donnees={donnees(EXCEL)} connecte />);
    const bandeau = screen.getByText("Vous regardez un aperçu gratuit").closest<HTMLElement>("[role=status]")!;
    expect(within(bandeau).getByRole("link", { name: "Voir les abonnements" })).toHaveAttribute("href", "/abonnement/souscrire");
  });

  it("« Leçon suivante » saute les leçons fermées ; « Voir l'aperçu gratuit » propose le suivant", () => {
    // Après le 2e aperçu (leçon 2), plus rien d'ouvert : pas de suivante.
    expect(voisines(EXCEL.modules, id(1)).suivante?.id).toBe(id(2));
    expect(voisines(EXCEL.modules, id(2)).suivante).toBeNull();
    // Tout ouvert : la leçon qui suit, comme avant.
    expect(voisines(EXCEL_OUVERTE.modules, id(2)).suivante?.id).toBe(id(3));
    // Depuis la leçon 1, l'aperçu proposé est le suivant (la leçon 2), pas celui qu'on vient de voir.
    expect(verrou(EXCEL, true, id(1)).apercu?.id).toBe(id(2));
    expect(verrou(EXCEL, true, id(5)).apercu?.id).toBe(id(1));
  });
});
