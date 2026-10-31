// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { QuizAPasser, ResultatQuiz } from "@/lib/quiz/types";

// Lot 3, étape A : l'étudiant passe un quiz (NdQuiz, NdQuizQuitter, NdQuizResultat), une question à la fois.
vi.mock("@/lib/quiz/actions", () => ({ envoyerQuiz: vi.fn() }));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }));
const { envoyerQuiz } = await import("@/lib/quiz/actions");
const { QuizLecon } = await import("@/components/quiz/QuizLecon");

const QUIZ: QuizAPasser = {
  scoreMinimal: 70,
  meilleur: null,
  tentatives: 0,
  questions: [
    { id: "q1", genre: "unique", enonce: "Quel outil gère les références ?", choix: ["Zotero", "Excel"] },
    { id: "q2", genre: "multiple", enonce: "Que place-t-on dans un TCD ?", choix: ["Des lignes", "Des colonnes", "Une vidéo"] },
    { id: "q3", genre: "vrai_faux", enonce: "Un TCD modifie les données d’origine.", choix: ["Vrai", "Faux"] },
    { id: "q4", genre: "courte", enonce: "Quelle fonction cherche une valeur ?", choix: [] },
  ],
};
const RESULTAT: ResultatQuiz = {
  score: 75,
  bonnes: 3,
  total: 4,
  reussi: true,
  meilleur: 75,
  numero: 1,
  scoreMinimal: 70,
  detail: [
    { questionId: "q1", enonce: "Quel outil gère les références ?", genre: "unique", votreReponse: "Zotero", correcte: true, bonneReponse: "Zotero", explication: "" },
    { questionId: "q2", enonce: "Que place-t-on dans un TCD ?", genre: "multiple", votreReponse: "Des lignes, Des colonnes", correcte: true, bonneReponse: "Des lignes, Des colonnes", explication: "" },
    { questionId: "q3", enonce: "Un TCD modifie les données d’origine.", genre: "vrai_faux", votreReponse: "", correcte: false, bonneReponse: "Faux", explication: "Le TCD résume les données sans les modifier." },
    { questionId: "q4", enonce: "Quelle fonction cherche une valeur ?", genre: "courte", votreReponse: "recherchex", correcte: true, bonneReponse: "RECHERCHEX", explication: "" },
  ],
};

function afficher(quiz: QuizAPasser = QUIZ) {
  return render(
    <ToastProvider>
      <QuizLecon leconId="l9" quiz={quiz} precedente="/formations/excel/lecons/l8" suivante="/formations/excel/lecons/l10" />
    </ToastProvider>,
  );
}
const reponse = (nom: string) => within(screen.getByRole("group", { name: "Réponses" })).getByRole("button", { name: nom });

beforeEach(() => {
  vi.mocked(envoyerQuiz).mockReset();
  refresh.mockReset();
});

describe("Un quiz en aperçu (formateur, équipe ; tâche 12 du 31 octobre 2026)", () => {
  it("il se parcourt question par question, mais rien n'est envoyé ni noté", async () => {
    const user = userEvent.setup();
    const un: QuizAPasser = { ...QUIZ, questions: [QUIZ.questions[0]] };
    render(
      <ToastProvider>
        <QuizLecon leconId="l9" quiz={un} apercu />
      </ToastProvider>,
    );
    expect(screen.getByText("Aperçu : parcourez les questions comme un étudiant ; vos réponses ne sont ni envoyées ni notées.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Commencer" }));
    await user.click(reponse("Zotero"));
    await user.click(screen.getByRole("button", { name: "Valider" }));
    expect(envoyerQuiz).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Commencer" })).toBeInTheDocument();
  });
});

describe("Passer un quiz", () => {
  it("l'accueil : nombre de questions, meilleur score, score minimal ; « Commencer », puis « Recommencer »", () => {
    const { unmount } = afficher();
    expect(screen.getByText("4 questions · meilleur score : — · score minimal : 70 %")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Commencer" })).toBeInTheDocument();
    unmount();
    afficher({ ...QUIZ, meilleur: 75, tentatives: 2 });
    expect(screen.getByText("4 questions · meilleur score : 75 % · score minimal : 70 %")).toBeInTheDocument();
    expect(screen.getByText("2 tentatives · tentatives illimitées")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recommencer" })).toBeInTheDocument();
  });

  it("un quiz sans question ne se commence pas", () => {
    afficher({ ...QUIZ, questions: [] });
    expect(screen.getByText("Ce quiz n’a pas encore de questions.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Commencer" })).toBeNull();
  });

  it("une question à la fois : avancement, type, réponse choisie, précédente ; « Valider » attend une réponse", async () => {
    const user = userEvent.setup();
    afficher();
    await user.click(screen.getByRole("button", { name: "Commencer" }));
    expect(screen.getByText("Question 1 sur 4")).toBeInTheDocument();
    expect(screen.getByText("Tentative n° 1 · tentatives illimitées")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Avancement du quiz" })).toHaveAttribute("aria-valuenow", "25");
    expect(screen.getByText("Choix unique")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Quel outil gère les références ?" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Question précédente" })).toBeNull();
    expect(screen.getByRole("button", { name: "Valider" })).toBeDisabled();
    await user.click(reponse("Excel"));
    await user.click(reponse("Zotero"));
    expect(reponse("Zotero")).toHaveAttribute("aria-pressed", "true");
    expect(reponse("Excel")).toHaveAttribute("aria-pressed", "false");
    await user.click(screen.getByRole("button", { name: "Valider" }));
    expect(screen.getByText("Question 2 sur 4")).toBeInTheDocument();
    // Le focus suit : la nouvelle question est lue au lecteur d'écran.
    expect(screen.getByRole("heading", { name: "Que place-t-on dans un TCD ?" })).toHaveFocus();
    expect(screen.getByText("Plusieurs réponses sont possibles.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Question précédente" }));
    expect(reponse("Zotero")).toHaveAttribute("aria-pressed", "true");
  });

  it("répondre aux quatre types, passer une question, envoyer ; le résultat et le détail ; « Recommencer »", async () => {
    const user = userEvent.setup();
    vi.mocked(envoyerQuiz).mockResolvedValue({ ok: true, resultat: RESULTAT });
    afficher();
    await user.click(screen.getByRole("button", { name: "Commencer" }));
    await user.click(reponse("Zotero"));
    await user.click(screen.getByRole("button", { name: "Valider" }));
    await user.click(reponse("Des colonnes"));
    await user.click(reponse("Des lignes"));
    await user.click(reponse("Une vidéo"));
    await user.click(reponse("Une vidéo"));
    await user.click(screen.getByRole("button", { name: "Valider" }));
    expect(screen.getByText("Vrai ou faux")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Passer cette question" }));
    await user.type(screen.getByRole("textbox", { name: "Votre réponse" }), "recherchex");
    await user.click(screen.getByRole("button", { name: "Valider" }));

    await waitFor(() => expect(envoyerQuiz).toHaveBeenCalledWith("l9", { q1: [0], q2: [0, 1], q4: "recherchex" }));
    expect(await screen.findByRole("heading", { name: "Quiz réussi" })).toHaveFocus();
    expect(screen.getByText("75 %")).toBeInTheDocument();
    expect(screen.getByText("3 bonnes réponses sur 4 · score minimal : 70 %")).toBeInTheDocument();
    expect(screen.getByText("Tentative n° 1")).toBeInTheDocument();
    const lignes = within(screen.getByRole("list", { name: "Détail des réponses" })).getAllByRole("listitem");
    expect(lignes).toHaveLength(4);
    expect(within(lignes[0]).getByText("Correct")).toBeInTheDocument();
    expect(within(lignes[2]).getByText("Incorrect")).toBeInTheDocument();
    expect(lignes[2]).toHaveTextContent("Votre réponse : sans réponse");
    expect(lignes[2]).toHaveTextContent("Bonne réponse : Faux. Le TCD résume les données sans les modifier.");
    expect(screen.getByRole("link", { name: "Revoir la leçon" })).toHaveAttribute("href", "/formations/excel/lecons/l8");
    expect(screen.getByRole("link", { name: "Continuer" })).toHaveAttribute("href", "/formations/excel/lecons/l10");
    expect(refresh).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Recommencer" }));
    expect(screen.getByText("Question 1 sur 4")).toBeInTheDocument();
    expect(screen.getByText("Tentative n° 2 · tentatives illimitées")).toBeInTheDocument();
    expect(reponse("Zotero")).toHaveAttribute("aria-pressed", "false");
  });

  it("pas encore réussi ; un envoi refusé laisse sur la dernière question avec le message", async () => {
    const user = userEvent.setup();
    vi.mocked(envoyerQuiz).mockResolvedValueOnce({ ok: false, message: "Trop de tentatives en peu de temps : réessayez dans quelques minutes." });
    vi.mocked(envoyerQuiz).mockResolvedValueOnce({ ok: true, resultat: { ...RESULTAT, score: 50, bonnes: 2, reussi: false, meilleur: 50 } });
    afficher({ ...QUIZ, questions: QUIZ.questions.slice(0, 1) });
    await user.click(screen.getByRole("button", { name: "Commencer" }));
    await user.click(reponse("Excel"));
    await user.click(screen.getByRole("button", { name: "Valider" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Trop de tentatives en peu de temps : réessayez dans quelques minutes.");
    expect(screen.getByText("Question 1 sur 1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Valider" }));
    expect(await screen.findByRole("heading", { name: "Pas encore réussi" })).toBeInTheDocument();
    expect(screen.getByText(/Il faut 70 % pour réussir ce quiz/)).toBeInTheDocument();
  });

  it("« Quitter » demande confirmation : les réponses ne sont pas enregistrées", async () => {
    const user = userEvent.setup();
    afficher();
    await user.click(screen.getByRole("button", { name: "Commencer" }));
    await user.click(reponse("Zotero"));
    await user.click(screen.getByRole("button", { name: "Quitter" }));
    const fenetre = screen.getByRole("dialog", { name: "Quitter le quiz ?" });
    expect(fenetre).toHaveTextContent("Vos réponses ne seront pas enregistrées. Vous pourrez recommencer le quiz plus tard.");
    await user.click(within(fenetre).getByRole("button", { name: "Continuer le quiz" }));
    expect(screen.getByText("Question 1 sur 4")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Quitter" }));
    await user.click(within(screen.getByRole("dialog", { name: "Quitter le quiz ?" })).getByRole("button", { name: "Quitter" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Commencer" })).toHaveFocus());
    expect(envoyerQuiz).not.toHaveBeenCalled();
  });

  it("le quiz modifié pendant une tentative : les questions du début restent affichées", async () => {
    const user = userEvent.setup();
    const { rerender } = afficher();
    await user.click(screen.getByRole("button", { name: "Commencer" }));
    await user.click(reponse("Zotero"));
    await user.click(screen.getByRole("button", { name: "Valider" }));
    rerender(
      <ToastProvider>
        <QuizLecon leconId="l9" quiz={{ ...QUIZ, questions: QUIZ.questions.slice(0, 1) }} />
      </ToastProvider>,
    );
    expect(screen.getByText("Question 2 sur 4")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Que place-t-on dans un TCD ?" })).toBeInTheDocument();
  });
});
