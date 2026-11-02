// @vitest-environment jsdom
import { render as rendre, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { DonneesLecon, LeconDetail } from "@/lib/lecon/types";
import { EXCEL, EXCEL_OUVERTE, id } from "./donnees";

// La leçon fermée faute d'inscription (spec du 2 novembre 2026, §5) et un seul format de module partout (§1.8).
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh }), usePathname: () => "/formations" }));
const sInscrireFormation = vi.fn();
vi.mock("@/lib/inscriptions/actions", () => ({ sInscrireFormation: (...args: unknown[]) => sInscrireFormation(...args) }));
vi.mock("@/lib/lecon/actions", () => ({
  enregistrerNote: vi.fn(),
  lienRessource: vi.fn(),
  lienConsultation: vi.fn(),
  ouvrirLecon: vi.fn(async () => undefined),
  terminerLecon: vi.fn(),
}));
vi.mock("@/lib/video/adaptateurs", () => ({ creerAdaptateur: () => new Promise(() => {}) }));

const { ContenuLecon } = await import("@/components/lecon/ContenuLecon");
const { ProgrammeLecon } = await import("@/components/lecon/ProgrammeLecon");
const { ProgrammeMobile } = await import("@/components/lecon/ProgrammeMobile");

const render = (element: ReactElement) => rendre(<ToastProvider>{element}</ToastProvider>);

const LECON: LeconDetail = {
  id: id(3),
  titre: "Les formules essentielles",
  dureeSecondes: 845,
  apercu: false,
  accessible: false,
  resume: "",
  pointsCles: [],
  video: { fournisseur: "youtube", id: "dQw4w9WgXcQ" },
  texte: "Texte secret de la leçon",
  ressources: [],
  visionnage: null,
};
const donnees = (lecon: Partial<LeconDetail>, fiche = EXCEL): DonneesLecon => ({ fiche, lecon: { ...LECON, ...lecon }, note: null, notesDisponibles: true });

beforeEach(() => {
  refresh.mockReset();
  sInscrireFormation.mockReset();
});

describe("Une leçon fermée faute d'inscription", () => {
  it("le texte et « S’inscrire à ce cours » ; après l'inscription, la page se relit et la leçon s'ouvre", async () => {
    sInscrireFormation.mockResolvedValue({ ok: true });
    const { container } = render(<ContenuLecon donnees={donnees({}, { ...EXCEL, gratuite: true })} connecte aInscrire />);
    expect(screen.getByText("Inscrivez-vous à cette formation pour suivre cette leçon.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Voir les abonnements" })).toBeNull();
    expect(container.innerHTML).not.toMatch(/dQw4w9WgXcQ|Texte secret/);
    await userEvent.click(screen.getByRole("button", { name: "S’inscrire à ce cours" }));
    expect(sInscrireFormation).toHaveBeenCalledWith(EXCEL.id);
    expect(await screen.findByText("Inscription confirmée.")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("les autres verrous ne changent pas : abonnement, aperçu proposé", () => {
    render(<ContenuLecon donnees={donnees({})} connecte />);
    expect(screen.getByRole("heading", { name: "Cette leçon est verrouillée" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voir les abonnements" })).toHaveAttribute("href", "/abonnement/souscrire");
    expect(screen.queryByRole("button", { name: "S’inscrire à ce cours" })).toBeNull();
    expect(screen.queryByText("Inscrivez-vous à cette formation pour suivre cette leçon.")).toBeNull();
  });

  it("une leçon d'aperçu, compte non inscrit : le bandeau propose de s'inscrire plutôt qu'un abonnement", () => {
    render(<ContenuLecon donnees={donnees({ id: id(1), titre: "Découvrir l’interface", apercu: true, accessible: true }, { ...EXCEL, gratuite: true })} connecte aInscrire />);
    expect(screen.getByText("Vous regardez un aperçu gratuit")).toBeInTheDocument();
    expect(screen.getByText("Inscrivez-vous à cette formation pour suivre toutes ses leçons.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "S’inscrire à ce cours" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Voir les abonnements" })).toBeNull();
  });
});

describe("Un seul format de module dans la leçon : « Module N - Titre »", () => {
  it("l'en-tête de la leçon : le module et la durée au format court", () => {
    render(<ContenuLecon donnees={donnees({ id: id(2), titre: "Saisir et mettre en forme des données", dureeSecondes: 750, apercu: true, accessible: true }, EXCEL_OUVERTE)} connecte />);
    expect(screen.getAllByText("Module 1 - Bases d’Excel").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Module 1 · /)).toBeNull();
    expect(screen.getByText("12:30")).toBeInTheDocument();
  });

  it("la barre latérale (sans capitales) et le tiroir du téléphone", () => {
    const { unmount } = render(<ProgrammeLecon fiche={EXCEL} leconId={id(6)} connecte terminees={new Set()} />);
    const enCours = screen.getByRole("button", { name: /^Module 2 - Formules et fonctions/ });
    expect(enCours).toHaveAttribute("aria-expanded", "true");
    expect(within(enCours).getByText("Module 2 - Formules et fonctions")).not.toHaveClass("uppercase");
    unmount();
    render(<ProgrammeMobile fiche={EXCEL} leconId={id(2)} connecte terminees={new Set()} />);
    expect(screen.getByRole("heading", { level: 3, name: "Module 1 - Bases d’Excel" })).toBeInTheDocument();
  });
});
