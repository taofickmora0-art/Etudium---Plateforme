// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { FormationAdmin } from "@/lib/admin/types";

vi.mock("@/lib/admin/actions", () => ({
  addModule: vi.fn(),
  renameModule: vi.fn(),
  deleteModule: vi.fn(),
  addLecon: vi.fn(),
  deleteLecon: vi.fn(),
  deplacer: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const { ProgrammeEditor } = await import("@/components/admin/ProgrammeEditor");

const FORMATION = {
  id: "f1",
  modules: [
    {
      id: "m1",
      titre: "Bases d’Excel",
      ordre: 1,
      lecons: [
        { id: "l1", titre: "Découvrir l’interface", dureeSecondes: 370, apercu: true, aVideo: false },
        { id: "l2", titre: "Les formules essentielles", dureeSecondes: 845, apercu: false, aVideo: true },
      ],
    },
    { id: "m2", titre: "Automatisation", ordre: 2, lecons: [] },
  ],
} as unknown as FormationAdmin;

const afficher = (formation: FormationAdmin) =>
  render(
    <ToastProvider>
      <ProgrammeEditor formation={formation} />
    </ToastProvider>,
  );

describe("Programme d'une formation au back-office", () => {
  it("le programme s'affiche dans l'ordre avec la durée, l'aperçu et la vidéo", () => {
    afficher(FORMATION);
    const modules = screen.getAllByRole("region");
    expect(within(modules[0]).getByRole("heading", { name: "Module 1" })).toBeInTheDocument();
    expect(within(modules[0]).getByText("06:10 · Aperçu · Sans vidéo")).toBeInTheDocument();
    expect(within(modules[0]).getByText("14:05 · Vidéo")).toBeInTheDocument();
    expect(within(modules[0]).getByRole("link", { name: "Découvrir l’interface" })).toHaveAttribute("href", "/admin/formations/f1/lecons/l1");
    expect(within(modules[1]).getByRole("heading", { name: "Module 2" })).toBeInTheDocument();
    expect(within(modules[1]).getByText("Aucune leçon dans ce module.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Monter « Bases d’Excel »" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Descendre « Automatisation »" })).toBeDisabled();
  });

  it("supprimer un module demande confirmation et annonce ses leçons", async () => {
    afficher(FORMATION);
    await userEvent.click(screen.getByRole("button", { name: "Supprimer le module « Bases d’Excel »" }));
    const fenetre = await screen.findByRole("dialog");
    expect(within(fenetre).getByText("Supprimer ce module ?")).toBeInTheDocument();
    expect(within(fenetre).getByText("Ses 2 leçons, leurs vidéos et leurs ressources seront supprimées.")).toBeInTheDocument();
  });

  it("sur un petit écran, les boutons d'une leçon passent sous son titre", () => {
    afficher(FORMATION);
    // La ligne peut passer à la ligne ; le titre garde une largeur minimale lisible (jsdom ne calcule pas la mise en page).
    const actions = screen.getByRole("group", { name: "Actions de « Découvrir l’interface »" });
    expect(actions.parentElement).toHaveClass("flex-wrap");
    expect(screen.getByRole("link", { name: "Découvrir l’interface" }).parentElement).toHaveClass("min-w-[150px]");
  });

  it("le titre d'un module ajouté se vide, celui d'un module renommé reste", async () => {
    const { addModule, renameModule } = await import("@/lib/admin/actions");
    vi.mocked(addModule).mockResolvedValue({ status: "success" });
    vi.mocked(renameModule).mockImplementation(async (_p, fd) => ({ status: "success", values: { titre: String(fd.get("titre")) } }));
    afficher(FORMATION);
    const nouveau = screen.getByLabelText("Nouveau module");
    await userEvent.type(nouveau, "Graphiques");
    await userEvent.click(screen.getByRole("button", { name: "Ajouter le module" }));
    await waitFor(() => expect(nouveau).toHaveValue(""));
    const [titre] = screen.getAllByLabelText("Titre du module");
    await userEvent.clear(titre);
    await userEvent.type(titre, "Bases");
    await userEvent.click(screen.getAllByRole("button", { name: "Renommer" })[0]);
    await waitFor(() => expect(vi.mocked(renameModule)).toHaveBeenCalled());
    expect(titre).toHaveValue("Bases");
  });

  it("sans module, l'état vide guide", () => {
    afficher({ id: "f1", modules: [] } as unknown as FormationAdmin);
    expect(screen.getByText("Aucun module pour le moment")).toBeInTheDocument();
    expect(screen.getByText("Commencez par ajouter un module, puis ses leçons.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ajouter le module" })).toBeInTheDocument();
  });
});
