// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FicheFormation } from "@/lib/catalogue/types";
import { etatFormation } from "@/lib/progression/regles";
import { EXCEL_OUVERTE } from "../lecon/donnees";

// Lot 3, étape A : un quiz dans le programme (fiche, page leçon, téléphone) : l'icône, « Quiz », le meilleur score ; il
// ne compte ni dans « n leçons » ni dans la progression.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/formations/maitriser-microsoft-excel" }));
const { FicheConnectee } = await import("@/components/catalogue/FicheConnectee");
const { ProgrammeFiche, resumeProgramme } = await import("@/components/catalogue/ProgrammeFiche");
const { ProgrammeLecon } = await import("@/components/lecon/ProgrammeLecon");
const { ProgrammeMobile } = await import("@/components/lecon/ProgrammeMobile");

const QUIZ = "99999999-9999-4999-8999-999999999999";
const FICHE: FicheFormation = {
  ...EXCEL_OUVERTE,
  nbQuiz: 1,
  modules: EXCEL_OUVERTE.modules.map((m, i) =>
    i === 0 ? { ...m, lecons: [...m.lecons, { id: QUIZ, titre: "Quiz du module 1", titreCourt: null, dureeSecondes: 0, apercu: false, accessible: true, type: "quiz" as const }] } : m,
  ),
};
const contenu = EXCEL_OUVERTE.modules.flatMap((m) => m.lecons);
const module1 = EXCEL_OUVERTE.modules[0].lecons;
const toutes = new Set(contenu.map((l) => l.id));
const SCORES = { [QUIZ]: 75 };

describe("Finitions du lot 3 : aperçu et comptes", () => {
  it("un quiz coché « aperçu » n'est pas une leçon d'aperçu : ni compté, ni lien « Aperçu » pour le visiteur", async () => {
    const { leconsApercu } = await import("@/lib/catalogue/regles");
    const avecQuizApercu: FicheFormation = {
      ...FICHE,
      modules: FICHE.modules.map((m) => ({ ...m, lecons: m.lecons.map((l) => ({ ...l, apercu: l.id === QUIZ })) })),
    };
    expect(leconsApercu(avecQuizApercu)).toEqual([]);
    render(<ProgrammeFiche fiche={avecQuizApercu} variante="public" />);
    expect(screen.queryByRole("link", { name: "Aperçu" })).toBeNull();
  });

  it("une section qui n'a que des quiz n'affiche pas « 0 leçon »", () => {
    const quizSeul: FicheFormation = {
      ...FICHE,
      nbLecons: 0,
      dureeSecondes: 0,
      modules: [{ id: "m-quiz", titre: "Évaluation", lecons: [{ id: QUIZ, titre: "Quiz final", titreCourt: null, dureeSecondes: 0, apercu: false, accessible: true, type: "quiz" as const }] }],
    };
    expect(resumeProgramme(quizSeul)).toBe("1 module · 1 quiz");
    render(<ProgrammeFiche fiche={quizSeul} variante="public" />);
    expect(screen.queryByText(/0 leçon/)).toBeNull();
    expect(screen.getAllByText("1 quiz").length).toBeGreaterThan(0);
  });
});

describe("Un quiz dans le programme", () => {
  it("la fiche : « 1 quiz » à côté des leçons, le meilleur score ; la progression l'ignore", () => {
    expect(resumeProgramme(FICHE)).toBe(`${FICHE.modules.length} modules · ${contenu.length} leçons · 1 quiz · ${resumeProgramme(EXCEL_OUVERTE).split(" · ").at(-1)}`);
    const lignes = contenu.map((l) => ({ leconId: l.id, formationId: FICHE.id, termineeLe: "2026-10-15T08:00:00Z", vueLe: "2026-10-15T08:00:00Z", positionSecondes: 0 }));
    render(<FicheConnectee fiche={FICHE} progression={etatFormation(FICHE, lignes)} scores={SCORES} />);
    expect(screen.getByText("Formation terminée")).toBeInTheDocument();
    expect(screen.getByText("100 %")).toBeInTheDocument();
    const programme = screen.getByRole("region", { name: "Programme" });
    expect(within(programme).getByRole("link", { name: /Quiz du module 1/ })).toHaveTextContent("Quiz · 75 %");
    expect(within(programme).getByText(`${module1.length} leçons · 1 quiz`, { exact: false })).toBeInTheDocument();
  });

  it("la fiche publique : « Quiz » à la place de la durée", () => {
    render(<ProgrammeFiche fiche={FICHE} variante="public" />);
    expect(screen.getByText("Quiz du module 1").parentElement).toHaveTextContent(/Quiz du module 1\s*Quiz$/);
  });

  it("la page leçon : le quiz et son meilleur score ; « % terminé » sans le quiz", () => {
    render(<ProgrammeLecon fiche={FICHE} leconId={contenu[0].id} connecte terminees={toutes} scores={SCORES} />);
    expect(screen.getByRole("link", { name: /Quiz du module 1/ })).toHaveTextContent("Quiz · 75 %");
    expect(screen.getByText("100 % terminé")).toBeInTheDocument();
  });

  it("le téléphone : « Quiz » et le meilleur score ; le compte du module sans le quiz", () => {
    render(<ProgrammeMobile fiche={FICHE} leconId={contenu[0].id} connecte terminees={toutes} scores={SCORES} />);
    expect(screen.getByRole("link", { name: /Quiz du module 1/ })).toHaveTextContent("Quiz · 75 %");
    expect(screen.getByText(`${module1.length}/${module1.length}`)).toBeInTheDocument();
  });
});
