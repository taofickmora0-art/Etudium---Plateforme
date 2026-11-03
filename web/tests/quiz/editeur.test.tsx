// @vitest-environment jsdom
import { createEvent, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { FormationAdmin, LeconAdmin } from "@/lib/admin/types";
import type { QuestionQuiz } from "@/lib/quiz/types";
import { choisirDansListe } from "../utilitaires/listes";

// Lot 3, étape A : le formateur écrit un quiz (quatre types de questions) et l'ajoute au programme.
vi.mock("@/lib/editeur/actions", () => ({
  enregistrerLecon: vi.fn(async () => ({ ok: true, revision: 1, brouillon: false, enregistreLe: "2026-11-01T14:32:00" })),
  reglerLecon: vi.fn(async () => ({ ok: true })),
  enregistrerQuestions: vi.fn(),
  abandonnerModifications: vi.fn(),
  publierModifications: vi.fn(),
  lireModificationsEnAttente: vi.fn(async () => ({ migrationAbsente: false, donnees: [] })),
}));
vi.mock("@/lib/admin/actions", () => ({
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
vi.mock("@/components/editeur/EditeurRiche", () => import("../editeur/editeur-riche-simule"));
const actions = await import("@/lib/admin/actions");
const editeur = await import("@/lib/editeur/actions");
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
  genreExercice: null,
  position: { rang: 3, total: 3, module: { rang: 1, titre: "Les bases" } },
  voisines: { precedente: "l2", suivante: null },
};
const QUESTIONS: QuestionQuiz[] = [
  { id: "a", genre: "unique", enonce: "Quel outil gère les références ?", choix: [{ texte: "Zotero", correcte: true }, { texte: "Excel", correcte: false }], reponses: [], explication: "" },
  { id: "b", genre: "courte", enonce: "Quelle fonction cherche une valeur ?", choix: [], reponses: ["RECHERCHEX"], explication: "Elle remplace RECHERCHEV." },
];
// Envoyées avec leur identifiant : la base les met à jour sans en changer (une tentative en cours reste valable).
const ENVOYEES = QUESTIONS.map(({ id, genre, enonce, choix, reponses, explication }) => ({ id, genre, enonce, choix, reponses, explication }));

function afficher(quiz: { migrationAbsente: true } | { migrationAbsente: false; donnees: QuestionQuiz[] } = { migrationAbsente: false, donnees: QUESTIONS }) {
  return render(
    <ToastProvider>
      <EditeurLecon lecon={QUIZ} quiz={quiz} />
    </ToastProvider>,
  );
}
// Les questions partent par « Enregistrer les questions » (fin du lot 4), à part du reste qui s'enregistre seul.
const questionsEnvoyees = () => vi.mocked(editeur.enregistrerQuestions).mock.calls.at(-1)![1];
const question = (n: number) => screen.getByRole("group", { name: `Question ${n}` });

beforeEach(() => {
  for (const f of Object.values(actions)) vi.mocked(f as (...a: unknown[]) => unknown).mockReset();
  push.mockReset();
  vi.mocked(editeur.enregistrerQuestions).mockReset();
  vi.mocked(editeur.enregistrerQuestions).mockResolvedValue({ ok: true });
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
    expect(within(question(1)).getByRole("combobox", { name: "Type de question" })).toHaveTextContent("Choix unique");
    expect(within(question(1)).getByRole("textbox", { name: "Énoncé" })).toHaveValue("Quel outil gère les références ?");
    expect(within(question(1)).getByRole("textbox", { name: "Réponse 1" })).toHaveValue("Zotero");
    expect(within(question(1)).getByRole("radio", { name: "Bonne réponse : réponse 1" })).toBeChecked();
    expect(within(question(1)).getByRole("radio", { name: "Bonne réponse : réponse 2" })).not.toBeChecked();
    expect(within(question(2)).getByRole("textbox", { name: "Réponse acceptée 1" })).toHaveValue("RECHERCHEX");
    expect(within(question(2)).getByText("Corrigée sans tenir compte des majuscules, des accents ni des espaces en trop.")).toBeInTheDocument();
    expect(within(question(2)).getByRole("textbox", { name: "Explication (facultative)" })).toHaveValue("Elle remplace RECHERCHEV.");

    await user.click(screen.getByRole("button", { name: "Enregistrer les questions" }));
    await waitFor(() => expect(editeur.enregistrerQuestions).toHaveBeenCalled());
    expect(vi.mocked(editeur.enregistrerQuestions).mock.calls[0][0]).toBe("q1");
    expect(questionsEnvoyees()).toEqual(ENVOYEES);
    expect(await screen.findByText("Les questions ont bien été enregistrées.")).toBeInTheDocument();
  });

  it("pas de case « Leçon d’aperçu gratuite » pour un quiz (l'aperçu concerne les leçons)", () => {
    afficher();
    expect(screen.queryByRole("checkbox", { name: "Leçon d’aperçu gratuite" })).toBeNull();
  });

  it("la touche Entrée dans une réponse n'enregistre pas le quiz", () => {
    // Le bouton « Enregistrer » est hors du formulaire (attribut form) : un navigateur l'actionne quand même sur Entrée
    // dans un champ ; jsdom ne simule pas ce cas, d'où le contrôle de l'action par défaut de la touche.
    afficher();
    for (const champ of [
      within(question(1)).getByRole("textbox", { name: "Réponse 1" }),
      within(question(1)).getByRole("textbox", { name: "Énoncé" }),
      within(question(2)).getByRole("textbox", { name: "Réponse acceptée 1" }),
    ]) {
      const entree = createEvent.keyDown(champ, { key: "Enter" });
      fireEvent(champ, entree);
      expect(entree.defaultPrevented, champ.getAttribute("aria-label") ?? champ.id).toBe(champ.tagName === "INPUT");
    }
  });

  it("ajouter et modifier des questions des quatre types", async () => {
    const user = userEvent.setup();
    // Collé d'un coup : sous la charge de la suite complète, la frappe lettre à lettre dépassait le délai.
    const saisir = async (champ: HTMLElement, texte: string) => {
      await user.click(champ);
      await user.paste(texte);
    };
    afficher();
    await user.click(screen.getByRole("button", { name: "Ajouter une question" }));
    expect(screen.getByText("3 questions")).toBeInTheDocument();
    // Une nouvelle question : choix unique, deux réponses, la première cochée.
    expect(within(question(3)).getByRole("combobox", { name: "Type de question" })).toHaveTextContent("Choix unique");
    expect(within(question(3)).getAllByRole("textbox", { name: /^Réponse \d$/ })).toHaveLength(2);
    await saisir(within(question(3)).getByRole("textbox", { name: "Énoncé" }), "Un TCD modifie les données d’origine.");
    await choisirDansListe("Type de question", "Vrai ou faux", { dans: question(3), user });
    expect(within(question(3)).queryByRole("textbox", { name: "Réponse 1" })).toBeNull();
    await user.click(within(question(3)).getByRole("radio", { name: "Faux" }));
    await saisir(within(question(3)).getByRole("textbox", { name: "Explication (facultative)" }), "Il les résume.");

    await user.click(screen.getByRole("button", { name: "Ajouter une question" }));
    await saisir(within(question(4)).getByRole("textbox", { name: "Énoncé" }), "Que place-t-on dans un TCD ?");
    await choisirDansListe("Type de question", "Réponses multiples", { dans: question(4), user });
    await saisir(within(question(4)).getByRole("textbox", { name: "Réponse 1" }), "Des lignes");
    await saisir(within(question(4)).getByRole("textbox", { name: "Réponse 2" }), "Des colonnes");
    await user.click(within(question(4)).getByRole("button", { name: "Ajouter une réponse" }));
    await saisir(within(question(4)).getByRole("textbox", { name: "Réponse 3" }), "Une vidéo");
    await user.click(within(question(4)).getByRole("checkbox", { name: "Bonne réponse : réponse 2" }));

    await user.click(within(question(2)).getByRole("button", { name: "Ajouter une réponse acceptée" }));
    await saisir(within(question(2)).getByRole("textbox", { name: "Réponse acceptée 2" }), "XLOOKUP");

    expect(screen.getByText("Questions modifiées, pas encore enregistrées")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Enregistrer les questions" }));
    await waitFor(() => expect(editeur.enregistrerQuestions).toHaveBeenCalled());
    expect(questionsEnvoyees()).toEqual([
      ENVOYEES[0],
      { ...ENVOYEES[1], reponses: ["RECHERCHEX", "XLOOKUP"] },
      // Une nouvelle question reçoit son identifiant dans l'éditeur.
      { id: expect.stringMatching(/^[0-9a-f-]{36}$/), genre: "vrai_faux", enonce: "Un TCD modifie les données d’origine.", choix: [{ texte: "Vrai", correcte: false }, { texte: "Faux", correcte: true }], reponses: [], explication: "Il les résume." },
      {
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
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
    vi.mocked(editeur.enregistrerQuestions).mockResolvedValue({ ok: false, message: "La question 1 doit avoir une seule bonne réponse." });
    const { unmount } = afficher();
    await user.click(screen.getByRole("button", { name: "Enregistrer les questions" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("La question 1 doit avoir une seule bonne réponse.");
    unmount();

    const vide = afficher({ migrationAbsente: false, donnees: [] });
    expect(screen.getByText("Aucune question pour le moment.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ajouter une question" })).toBeInTheDocument();
    vide.unmount();

    afficher({ migrationAbsente: true });
    expect(screen.getByText("Appliquez la migration 0031 (guide « Ce qui te revient », section 37).")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ajouter une question" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Enregistrer les questions" })).toBeNull();
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

  it("un quiz encore coché « aperçu » (avant la 0034) ne porte pas l'étiquette « Aperçu »", () => {
    const ancien = {
      ...FORMATION,
      modules: FORMATION.modules.map((m) => ({ ...m, lecons: m.lecons.map((l) => (l.type === "quiz" ? { ...l, apercu: true } : l)) })),
    } as unknown as FormationAdmin;
    render(
      <ToastProvider>
        <OngletLecons formation={ancien} />
      </ToastProvider>,
    );
    expect(within(screen.getByRole("listitem", { name: "Quiz du module 1" })).getByText("Quiz · 4 questions")).toBeInTheDocument();
  });

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
