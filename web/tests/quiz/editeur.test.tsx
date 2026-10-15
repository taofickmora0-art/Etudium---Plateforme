// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { FormationAdmin, LeconAdmin } from "@/lib/admin/types";
import type { QuestionQuiz } from "@/lib/quiz/types";

// Lot 3, étape A : le formateur écrit un quiz (quatre types de questions) et l'ajoute au programme.
vi.mock("@/lib/admin/actions", () => ({
  saveLecon: vi.fn(),
  changerStatutLecon: vi.fn(),
  addRessource: vi.fn(),
  updateRessource: vi.fn(),
  deleteRessource: vi.fn(),
  deplacer: vi.fn(),
  addModule: vi.fn(),
  renameModule: vi.fn(),
  deleteModule: vi.fn(),
  addLecon: vi.fn(),
  deleteLecon: vi.fn(),
  ranger: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ storage: { from: () => ({ upload: vi.fn(), remove: vi.fn() }) } }) }));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/components/communaute/EditeurTexte", () => import("../communaute/editeur-simule"));
const actions = await import("@/lib/admin/actions");
const { EditeurLecon } = await import("@/components/admin/EditeurLecon");
const { OngletLecons } = await import("@/components/admin/OngletLecons");

const QUIZ: LeconAdmin = {
  id: "q1",
  moduleId: "m1",
  formationId: "f1",
  formationTitre: "Maîtriser Excel",
  formationSlug: "excel",
  titre: "Quiz du module 1",
  titreCourt: null,
  dureeSecondes: 0,
  apercu: false,
  resume: "",
  pointsCles: [],
  video: null,
  texte: "",
  ressources: [],
  publiee: false,
  commentairesActifs: true,
  type: "quiz",
  position: { rang: 3, total: 3, module: { rang: 1, titre: "Les bases" } },
  voisines: { precedente: "l2", suivante: null },
};
const QUESTIONS: QuestionQuiz[] = [
  { id: "a", genre: "unique", enonce: "Quel outil gère les références ?", choix: [{ texte: "Zotero", correcte: true }, { texte: "Excel", correcte: false }], reponses: [], explication: "" },
  { id: "b", genre: "courte", enonce: "Quelle fonction cherche une valeur ?", choix: [], reponses: ["RECHERCHEX"], explication: "Elle remplace RECHERCHEV." },
];
const SANS_ID = QUESTIONS.map(({ genre, enonce, choix, reponses, explication }) => ({ genre, enonce, choix, reponses, explication }));

function afficher(quiz: { migrationAbsente: true } | { migrationAbsente: false; donnees: QuestionQuiz[] } = { migrationAbsente: false, donnees: QUESTIONS }) {
  return render(
    <ToastProvider>
      <EditeurLecon lecon={QUIZ} quiz={quiz} />
    </ToastProvider>,
  );
}
const envoye = () => vi.mocked(actions.saveLecon).mock.calls.at(-1)![1] as FormData;
const questionsEnvoyees = () => JSON.parse(envoye().get("questions") as string);
const question = (n: number) => screen.getByRole("group", { name: `Question ${n}` });

beforeEach(() => {
  for (const f of Object.values(actions)) vi.mocked(f as (...a: unknown[]) => unknown).mockReset();
  push.mockReset();
  vi.mocked(actions.saveLecon).mockResolvedValue({ status: "success" });
});

describe("L'éditeur d'un quiz", () => {
  it("les questions à la place de la vidéo et du texte ; enregistrées avec le quiz", async () => {
    const user = userEvent.setup();
    afficher();
    expect(screen.queryByRole("textbox", { name: "Lien de la vidéo" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Texte de la leçon" })).toBeNull();
    // Les documents ne s'affichent pas sur la page d'un quiz : ils ne s'y ajoutent pas.
    expect(screen.queryByText("Documents & fichiers")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Titre du quiz" })).toHaveValue("Quiz du module 1");
    expect(screen.getByRole("heading", { name: "Questions" })).toBeInTheDocument();
    expect(screen.getByText("2 questions")).toBeInTheDocument();
    expect(within(question(1)).getByRole("combobox", { name: "Type de question" })).toHaveValue("unique");
    expect(within(question(1)).getByRole("textbox", { name: "Énoncé" })).toHaveValue("Quel outil gère les références ?");
    expect(within(question(1)).getByRole("textbox", { name: "Réponse 1" })).toHaveValue("Zotero");
    expect(within(question(1)).getByRole("radio", { name: "Bonne réponse : réponse 1" })).toBeChecked();
    expect(within(question(1)).getByRole("radio", { name: "Bonne réponse : réponse 2" })).not.toBeChecked();
    expect(within(question(2)).getByRole("textbox", { name: "Réponse acceptée 1" })).toHaveValue("RECHERCHEX");
    expect(within(question(2)).getByText("Corrigée sans tenir compte des majuscules, des accents ni des espaces en trop.")).toBeInTheDocument();
    expect(within(question(2)).getByRole("textbox", { name: "Explication (facultative)" })).toHaveValue("Elle remplace RECHERCHEV.");

    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(actions.saveLecon).toHaveBeenCalled());
    expect(questionsEnvoyees()).toEqual(SANS_ID);
    expect(await screen.findByText("Le quiz a bien été mis à jour.")).toBeInTheDocument();
  });

  it("ajouter et modifier des questions des quatre types", async () => {
    const user = userEvent.setup();
    afficher();
    await user.click(screen.getByRole("button", { name: "Ajouter une question" }));
    expect(screen.getByText("3 questions")).toBeInTheDocument();
    // Une nouvelle question : choix unique, deux réponses, la première cochée.
    expect(within(question(3)).getByRole("combobox", { name: "Type de question" })).toHaveValue("unique");
    expect(within(question(3)).getAllByRole("textbox", { name: /^Réponse \d$/ })).toHaveLength(2);
    await user.type(within(question(3)).getByRole("textbox", { name: "Énoncé" }), "Un TCD modifie les données d’origine.");
    await user.selectOptions(within(question(3)).getByRole("combobox", { name: "Type de question" }), "vrai_faux");
    expect(within(question(3)).queryByRole("textbox", { name: "Réponse 1" })).toBeNull();
    await user.click(within(question(3)).getByRole("radio", { name: "Faux" }));
    await user.type(within(question(3)).getByRole("textbox", { name: "Explication (facultative)" }), "Il les résume.");

    await user.click(screen.getByRole("button", { name: "Ajouter une question" }));
    await user.type(within(question(4)).getByRole("textbox", { name: "Énoncé" }), "Que place-t-on dans un TCD ?");
    await user.selectOptions(within(question(4)).getByRole("combobox", { name: "Type de question" }), "multiple");
    await user.type(within(question(4)).getByRole("textbox", { name: "Réponse 1" }), "Des lignes");
    await user.type(within(question(4)).getByRole("textbox", { name: "Réponse 2" }), "Des colonnes");
    await user.click(within(question(4)).getByRole("button", { name: "Ajouter une réponse" }));
    await user.type(within(question(4)).getByRole("textbox", { name: "Réponse 3" }), "Une vidéo");
    await user.click(within(question(4)).getByRole("checkbox", { name: "Bonne réponse : réponse 2" }));

    await user.click(within(question(2)).getByRole("button", { name: "Ajouter une réponse acceptée" }));
    await user.type(within(question(2)).getByRole("textbox", { name: "Réponse acceptée 2" }), "XLOOKUP");

    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(actions.saveLecon).toHaveBeenCalled());
    expect(questionsEnvoyees()).toEqual([
      SANS_ID[0],
      { ...SANS_ID[1], reponses: ["RECHERCHEX", "XLOOKUP"] },
      { genre: "vrai_faux", enonce: "Un TCD modifie les données d’origine.", choix: [{ texte: "Vrai", correcte: false }, { texte: "Faux", correcte: true }], reponses: [], explication: "Il les résume." },
      {
        genre: "multiple",
        enonce: "Que place-t-on dans un TCD ?",
        choix: [
          { texte: "Des lignes", correcte: true },
          { texte: "Des colonnes", correcte: true },
          { texte: "Une vidéo", correcte: false },
        ],
        reponses: [],
        explication: "",
      },
    ]);
  });

  it("ranger, supprimer ; une seule bonne réponse au choix unique ; de deux à six réponses", async () => {
    const user = userEvent.setup();
    afficher();
    await user.click(within(question(1)).getByRole("radio", { name: "Bonne réponse : réponse 2" }));
    expect(within(question(1)).getByRole("radio", { name: "Bonne réponse : réponse 1" })).not.toBeChecked();
    // Deux réponses : aucune ne se retire.
    expect(within(question(1)).queryByRole("button", { name: "Retirer la réponse 1" })).toBeNull();
    for (let i = 0; i < 4; i++) await user.click(within(question(1)).getByRole("button", { name: "Ajouter une réponse" }));
    expect(within(question(1)).getAllByRole("textbox", { name: /^Réponse \d$/ })).toHaveLength(6);
    expect(within(question(1)).getByRole("button", { name: "Ajouter une réponse" })).toBeDisabled();
    // La bonne réponse retirée : la première devient la bonne.
    await user.click(within(question(1)).getByRole("button", { name: "Retirer la réponse 2" }));
    expect(within(question(1)).getByRole("radio", { name: "Bonne réponse : réponse 1" })).toBeChecked();

    expect(screen.queryByRole("button", { name: "Monter la question 1" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Descendre la question 1" }));
    expect(within(question(1)).getByRole("textbox", { name: "Énoncé" })).toHaveValue("Quelle fonction cherche une valeur ?");
    await user.click(screen.getByRole("button", { name: "Monter la question 2" }));
    expect(within(question(1)).getByRole("textbox", { name: "Énoncé" })).toHaveValue("Quel outil gère les références ?");
    await user.click(screen.getByRole("button", { name: "Supprimer la question 1" }));
    expect(screen.getByText("1 question")).toBeInTheDocument();
    expect(within(question(1)).getByRole("textbox", { name: "Énoncé" })).toHaveValue("Quelle fonction cherche une valeur ?");
  });

  it("le refus de la base s'affiche sur les questions ; un quiz vide ; avant la 0031", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.saveLecon).mockResolvedValue({ status: "error", fieldErrors: { questions: "La question 1 doit avoir une seule bonne réponse." } });
    const { unmount } = afficher();
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("La question 1 doit avoir une seule bonne réponse.");
    unmount();

    const vide = afficher({ migrationAbsente: false, donnees: [] });
    expect(screen.getByText("Aucune question pour le moment.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ajouter une question" })).toBeInTheDocument();
    vide.unmount();

    vi.mocked(actions.saveLecon).mockResolvedValue({ status: "success" });
    afficher({ migrationAbsente: true });
    expect(screen.getByText("Appliquez la migration 0031 (guide « Ce qui te revient », section 37).")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ajouter une question" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(actions.saveLecon).toHaveBeenCalled());
    expect(envoye().has("questions")).toBe(false);
  });
});

describe("Les quiz dans l'onglet Leçons", () => {
  const FORMATION = {
    id: "f1",
    slug: "excel",
    modules: [
      {
        id: "m1",
        titre: "Les bases",
        ordre: 1,
        lecons: [
          { id: "l1", titre: "Les formules", dureeSecondes: 370, apercu: false, aVideo: true, publiee: true, type: "lecon" },
          { id: "q1", titre: "Quiz du module 1", dureeSecondes: 0, apercu: false, aVideo: false, publiee: true, type: "quiz", nbQuestions: 4 },
        ],
      },
    ],
  } as unknown as FormationAdmin;

  it("le compte à part, la ligne « Quiz · 4 questions » ; « Ajouter » propose une leçon ou un quiz", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.addLecon).mockResolvedValue({ status: "success", redirection: "/admin/formations/f1/lecons/q2" });
    render(
      <ToastProvider>
        <OngletLecons formation={FORMATION} />
      </ToastProvider>,
    );
    expect(screen.getByRole("heading", { name: "1 section · 1 leçon · 1 quiz" })).toBeInTheDocument();
    expect(within(screen.getByRole("listitem", { name: "Quiz du module 1" })).getByText("Quiz · 4 questions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1 leçon · 1 quiz" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ajouter une leçon à « Les bases »" }));
    const fenetre = screen.getByRole("dialog", { name: "Nouvelle leçon" });
    expect(within(fenetre).getByRole("radio", { name: "Leçon" })).toBeChecked();
    await user.click(within(fenetre).getByRole("radio", { name: "Quiz" }));
    await user.type(within(fenetre).getByRole("textbox", { name: "Titre du quiz" }), "Quiz final");
    await user.click(within(fenetre).getByRole("button", { name: "Ajouter" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/formations/f1/lecons/q2"));
    const envoyee = vi.mocked(actions.addLecon).mock.calls[0][1] as FormData;
    expect([envoyee.get("module_id"), envoyee.get("titre"), envoyee.get("type")]).toEqual(["m1", "Quiz final", "quiz"]);
    expect(await screen.findByText("Quiz créé")).toBeInTheDocument();
  });

  it("supprimer un quiz : ses questions et les résultats partent avec lui", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <OngletLecons formation={FORMATION} />
      </ToastProvider>,
    );
    await user.click(within(screen.getByRole("listitem", { name: "Quiz du module 1" })).getByRole("button", { name: "Actions sur « Quiz du module 1 »" }));
    await user.click(screen.getByRole("menuitem", { name: "Supprimer" }));
    const fenetre = screen.getByRole("dialog", { name: "Supprimer ce quiz ?" });
    expect(fenetre).toHaveTextContent("« Quiz du module 1 » : ses questions et les résultats des étudiants seront supprimés.");
  });
});
