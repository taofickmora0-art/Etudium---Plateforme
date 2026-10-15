// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { FicheFormation } from "@/lib/catalogue/types";
import type { DonneesLecon } from "@/lib/lecon/types";
import { EXCEL_OUVERTE, id } from "../lecon/donnees";

// Lot 3, étape A : la page leçon d'un quiz : le quiz à la place de la vidéo, pas de « Terminer la leçon ».
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/formations" }));
vi.mock("@/lib/lecon/actions", () => ({ enregistrerNote: vi.fn(), lienRessource: vi.fn(), lienConsultation: vi.fn(), ouvrirLecon: vi.fn(async () => undefined), terminerLecon: vi.fn() }));
vi.mock("@/lib/quiz/actions", () => ({ envoyerQuiz: vi.fn() }));
const { ContenuLecon } = await import("@/components/lecon/ContenuLecon");
const { ouvrirLecon } = await import("@/lib/lecon/actions");

const QUIZ = "99999999-9999-4999-8999-999999999999";
const module1 = EXCEL_OUVERTE.modules[0];
const FICHE: FicheFormation = {
  ...EXCEL_OUVERTE,
  modules: [{ ...module1, lecons: [module1.lecons[0], { id: QUIZ, titre: "Quiz du module 1", titreCourt: null, dureeSecondes: 0, apercu: false, accessible: true, type: "quiz" }, ...module1.lecons.slice(1)] }, ...EXCEL_OUVERTE.modules.slice(1)],
};
const donnees = (o: Partial<DonneesLecon> = {}): DonneesLecon => ({
  fiche: FICHE,
  lecon: { id: QUIZ, titre: "Quiz du module 1", dureeSecondes: 0, apercu: false, accessible: true, resume: "", pointsCles: [], video: null, texte: "", ressources: [], visionnage: null },
  note: null,
  notesDisponibles: true,
  quiz: { scoreMinimal: 70, meilleur: null, tentatives: 0, questions: [{ id: "q1", genre: "unique", enonce: "Quel outil ?", choix: ["Zotero", "Excel"] }] },
  ...o,
});
const afficher = (d: DonneesLecon, connecte = true, lienModifier: string | null = null) =>
  render(
    <ToastProvider>
      <ContenuLecon donnees={d} connecte={connecte} lienModifier={lienModifier} />
    </ToastProvider>,
  );

describe("La page d'un quiz", () => {
  it("le quiz à la place de la vidéo ; « Modifier le quiz » ; ni onglets ni « Terminer la leçon » ; la visite n'est pas enregistrée", () => {
    afficher(donnees(), true, "/admin/formations/f1/lecons/q");
    expect(screen.getByRole("heading", { level: 1, name: "Quiz du module 1" })).toBeInTheDocument();
    expect(screen.getByText("1 question · meilleur score : — · score minimal : 70 %")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Commencer" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Modifier le quiz" })).toHaveAttribute("href", "/admin/formations/f1/lecons/q");
    expect(screen.queryByRole("tablist", { name: "Contenu de la leçon" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Terminer la leçon/ })).toBeNull();
    expect(screen.getByRole("link", { name: "Leçon suivante" })).toHaveAttribute("href", `/formations/${FICHE.slug}/lecons/${id(2)}`);
    expect(ouvrirLecon).not.toHaveBeenCalled();
  });

  it("un visiteur est invité à se connecter ; un quiz illisible (avant la 0031) le dit", () => {
    const { unmount } = afficher(donnees({ quiz: undefined }), false);
    expect(screen.getByText("Connectez-vous pour passer ce quiz et garder votre score.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Se connecter" })).toHaveAttribute("href", `/connexion?next=${encodeURIComponent(`/formations/${FICHE.slug}/lecons/${QUIZ}`)}`);
    expect(screen.getByRole("link", { name: "Créer un compte gratuit" })).toHaveAttribute("href", "/inscription");
    unmount();
    afficher(donnees({ quiz: null }));
    expect(screen.getByText("Ce quiz n’est pas disponible pour le moment.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Commencer" })).toBeNull();
  });
});
