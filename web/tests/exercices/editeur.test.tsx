// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { FormationAdmin, LeconAdmin } from "@/lib/admin/types";

// Lot 3, étape B : le formateur écrit un exercice (consigne, fichiers fournis, genre) et l'ajoute au programme.
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
vi.mock("@/components/editeur/EditeurRiche", () => import("../editeur/editeur-riche-simule"));
const actions = await import("@/lib/admin/actions");
const { EditeurLecon } = await import("@/components/admin/EditeurLecon");
const { OngletLecons } = await import("@/components/admin/OngletLecons");

const EXERCICE: LeconAdmin = {
  id: "e1",
  moduleId: "m1",
  formationId: "f1",
  formationTitre: "Maîtriser Excel",
  formationSlug: "excel",
  titre: "Tableau des ventes",
  titreCourt: null,
  dureeSecondes: 0,
  apercu: false,
  resume: "",
  pointsCles: [],
  video: null,
  texte: "Créez un **tableau croisé dynamique**.",
  ressources: [],
  publiee: false,
  commentairesActifs: true,
  type: "exercice",
  genreExercice: "rendu",
  position: { rang: 2, total: 2, module: { rang: 1, titre: "Les bases" } },
  voisines: { precedente: "l1", suivante: null },
};
const envoye = () => vi.mocked(actions.saveLecon).mock.calls.at(-1)![1] as FormData;

beforeEach(() => {
  for (const f of Object.values(actions)) vi.mocked(f as (...a: unknown[]) => unknown).mockReset();
  push.mockReset();
  vi.mocked(actions.saveLecon).mockResolvedValue({ status: "success" });
});

describe("L'éditeur d'un exercice", () => {
  it("la consigne à la place du texte, le genre, les fichiers fournis ; ni vidéo ni durée ; enregistré avec son genre", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <EditeurLecon lecon={EXERCICE} />
      </ToastProvider>,
    );
    expect(screen.getByRole("textbox", { name: "Titre de l’exercice" })).toHaveValue("Tableau des ventes");
    expect(screen.queryByRole("textbox", { name: "Lien de la vidéo" })).toBeNull();
    expect(screen.queryByRole("spinbutton", { name: "Minutes" })).toBeNull();
    // Le texte ancien s'ouvre converti en contenu riche (fin du lot 4).
    expect(await screen.findByRole("textbox", { name: "Consigne" })).toHaveValue("Créez un tableau croisé dynamique.");
    expect(screen.getByText("Documents & fichiers")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Avec rendu/ })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: /Simple/ }));
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(actions.saveLecon).toHaveBeenCalled());
    expect(envoye().get("genre_exercice")).toBe("simple");
    expect(JSON.parse(String(envoye().get("document"))).content[0].content).toEqual([
      { type: "text", text: "Créez un " },
      { type: "text", text: "tableau croisé dynamique", marks: [{ type: "bold" }] },
      { type: "text", text: "." },
    ]);
    expect(envoye().has("questions")).toBe(false);
    expect(await screen.findByText("L’exercice a bien été mis à jour.")).toBeInTheDocument();
  });
});

describe("Finitions du lot 3", () => {
  it("pas de case « Leçon d’aperçu gratuite » pour un exercice (l'aperçu concerne les leçons)", () => {
    render(
      <ToastProvider>
        <EditeurLecon lecon={EXERCICE} />
      </ToastProvider>,
    );
    expect(screen.queryByRole("checkbox", { name: "Leçon d’aperçu gratuite" })).toBeNull();
  });
});

describe("Les exercices dans l'onglet Leçons", () => {
  const FORMATION = {
    id: "f1",
    slug: "excel",
    modules: [
      {
        id: "m1",
        titre: "Les bases",
        ordre: 1,
        lecons: [
          { id: "l1", titre: "Les formules", dureeSecondes: 370, apercu: false, aVideo: true, publiee: true, type: "lecon", genreExercice: null },
          { id: "e1", titre: "Tableau des ventes", dureeSecondes: 0, apercu: false, aVideo: false, publiee: true, type: "exercice", genreExercice: "rendu" },
          { id: "e2", titre: "Nettoyer une enquête", dureeSecondes: 0, apercu: false, aVideo: false, publiee: true, type: "exercice", genreExercice: "simple" },
        ],
      },
    ],
  } as unknown as FormationAdmin;

  it("le compte à part, « Exercice avec rendu » et « Exercice simple » ; « Ajouter » propose un exercice ; supprimer le dit", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.addLecon).mockResolvedValue({ status: "success", redirection: "/admin/formations/f1/lecons/e3" });
    render(
      <ToastProvider>
        <OngletLecons formation={FORMATION} />
      </ToastProvider>,
    );
    expect(screen.getByRole("heading", { name: "1 section · 1 leçon · 2 exercices" })).toBeInTheDocument();
    expect(within(screen.getByRole("listitem", { name: "Tableau des ventes" })).getByText("Exercice avec rendu")).toBeInTheDocument();
    expect(within(screen.getByRole("listitem", { name: "Nettoyer une enquête" })).getByText("Exercice simple")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ajouter une leçon à « Les bases »" }));
    const fenetre = screen.getByRole("dialog", { name: "Nouvelle leçon" });
    await user.click(within(fenetre).getByRole("radio", { name: "Exercice" }));
    await user.type(within(fenetre).getByRole("textbox", { name: "Titre de l’exercice" }), "Graphique");
    await user.click(within(fenetre).getByRole("button", { name: "Ajouter" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/formations/f1/lecons/e3"));
    expect((vi.mocked(actions.addLecon).mock.calls[0][1] as FormData).get("type")).toBe("exercice");
    expect(await screen.findByText("Exercice créé")).toBeInTheDocument();
    // La fenêtre se ferme après l'enregistrement : la liste redevient lisible.
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await user.click(within(screen.getByRole("listitem", { name: "Tableau des ventes" })).getByRole("button", { name: "Actions sur « Tableau des ventes »" }));
    await user.click(screen.getByRole("menuitem", { name: "Supprimer" }));
    expect(screen.getByRole("dialog", { name: "Supprimer cet exercice ?" })).toHaveTextContent(
      "« Tableau des ventes » : sa consigne, ses documents et les travaux rendus par les étudiants seront supprimés.",
    );
  });
});
