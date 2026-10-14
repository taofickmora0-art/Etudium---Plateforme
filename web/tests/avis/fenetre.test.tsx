// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { resumeDepuis } from "@/lib/avis/regles";
import type { AvisPublic } from "@/lib/avis/types";
import { id } from "../lecon/donnees";

const enregistrerAvis = vi.fn();
const supprimerAvis = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/formations/x" }));
vi.mock("@/lib/avis/actions", () => ({
  enregistrerAvis: (...a: unknown[]) => enregistrerAvis(...a),
  supprimerAvis: (...a: unknown[]) => supprimerAvis(...a),
  masquerAvis: vi.fn(),
}));

const { SectionAvis } = await import("@/components/avis/SectionAvis");

const MIEN: AvisPublic = {
  id: id(1),
  note: 3,
  commentaire: "Bien.",
  auteur: "Aïcha K.",
  initiales: "AK",
  creeLe: "2026-10-12T10:00:00Z",
  modifieLe: "2026-10-12T10:00:00Z",
  estMoi: true,
};
const monter = (avis: AvisPublic[] = []) =>
  render(
    <ToastProvider>
      <SectionAvis
        variante="connecte"
        formation={{ id: id(9), titre: "Maîtriser Microsoft Excel" }}
        donnees={{ avis, resume: resumeDepuis({ 5: 0, 4: 0, 3: avis.length, 2: 0, 1: 0 }) }}
        peutNoter
      />
    </ToastProvider>,
  );

describe("Laisser ou modifier son avis", () => {
  beforeEach(() => {
    enregistrerAvis.mockReset();
    supprimerAvis.mockReset();
  });

  it("une note est obligatoire ; le commentaire est facultatif, avec son compteur ; publier puis le toast", async () => {
    enregistrerAvis.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    monter();
    await user.click(screen.getByRole("button", { name: "Laisser un avis" }));
    const fenetre = screen.getByRole("dialog", { name: "Votre avis sur Maîtriser Microsoft Excel" });
    const publier = within(fenetre).getByRole("button", { name: "Publier mon avis" });
    expect(publier).toBeDisabled();
    expect(within(fenetre).getByRole("group", { name: "Votre note" })).toBeInTheDocument();
    await user.click(within(fenetre).getByRole("radio", { name: "3 étoiles" }));
    await user.keyboard("{ArrowRight}");
    expect(within(fenetre).getByRole("radio", { name: "4 étoiles" })).toBeChecked();
    expect(publier).toBeEnabled();
    expect(within(fenetre).getByText("0 / 1 000")).toBeInTheDocument();
    await user.type(within(fenetre).getByLabelText("Commentaire (facultatif)"), "Très clair.");
    expect(within(fenetre).getByText("11 / 1 000")).toBeInTheDocument();
    await user.click(publier);
    expect(enregistrerAvis).toHaveBeenCalledWith(id(9), 4, "Très clair.");
    expect(await screen.findByText("Votre avis est publié.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /Votre avis sur/ })).toBeNull();
    // Le clavier reprend là où il était : sur le bouton de l'avis.
    expect(screen.getByRole("button", { name: "Laisser un avis" })).toHaveFocus();
  });

  it("un refus de la base s'affiche dans la fenêtre, qui reste ouverte", async () => {
    enregistrerAvis.mockResolvedValue({ ok: false, erreur: "Vous pourrez laisser un avis à partir de 50 % de progression." });
    const user = userEvent.setup();
    monter();
    await user.click(screen.getByRole("button", { name: "Laisser un avis" }));
    const fenetre = screen.getByRole("dialog");
    await user.click(within(fenetre).getByRole("radio", { name: "5 étoiles" }));
    await user.click(within(fenetre).getByRole("button", { name: "Publier mon avis" }));
    expect(await within(fenetre).findByText("Vous pourrez laisser un avis à partir de 50 % de progression.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("modifier : la fenêtre reprend son avis ; « Supprimer mon avis » demande confirmation", async () => {
    supprimerAvis.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    monter([MIEN]);
    await user.click(screen.getByRole("button", { name: "Modifier mon avis" }));
    const fenetre = screen.getByRole("dialog");
    expect(within(fenetre).getByRole("radio", { name: "3 étoiles" })).toBeChecked();
    expect(within(fenetre).getByLabelText("Commentaire (facultatif)")).toHaveValue("Bien.");
    expect(within(fenetre).getByRole("button", { name: "Enregistrer" })).toBeEnabled();
    await user.click(within(fenetre).getByRole("button", { name: "Supprimer mon avis" }));
    const confirmation = screen.getByRole("dialog", { name: "Supprimer votre avis ?" });
    await user.click(within(confirmation).getByRole("button", { name: "Supprimer" }));
    expect(supprimerAvis).toHaveBeenCalledWith(id(9));
    expect(await screen.findByText("Votre avis est supprimé.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Modifier mon avis" })).toHaveFocus();
  });
});
