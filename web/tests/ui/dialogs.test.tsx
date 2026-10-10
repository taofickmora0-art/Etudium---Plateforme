// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Logout03Icon } from "@hugeicons/core-free-icons";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { TypedConfirmDialog } from "@/components/ui/TypedConfirmDialog";

const DECONNEXION = {
  title: "Se déconnecter ?",
  description: "Votre progression est enregistrée. Vous devrez saisir à nouveau vos identifiants pour revenir.",
  confirmLabel: "Se déconnecter",
  icon: Logout03Icon,
};

describe("Fenêtres", () => {
  it("Échap ferme la fenêtre", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<ConfirmDialog open onOpenChange={onOpenChange} onConfirm={() => {}} {...DECONNEXION} />);
    expect(screen.getByRole("dialog", { name: "Se déconnecter ?" })).toHaveAccessibleDescription(/Votre progression est enregistrée/);
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("le focus reste dans la fenêtre", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog open onOpenChange={() => {}} onConfirm={() => {}} {...DECONNEXION} />);
    const dialog = screen.getByRole("dialog");
    const confirmer = screen.getByRole("button", { name: "Se déconnecter" });
    confirmer.focus();
    await user.tab();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(screen.getByRole("button", { name: "Fermer" })).toHaveFocus();
  });

  it("confirmer appelle onConfirm et montre le chargement", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn(() => new Promise<void>(() => {}));
    render(<ConfirmDialog open onOpenChange={() => {}} onConfirm={onConfirm} {...DECONNEXION} />);
    await user.click(screen.getByRole("button", { name: "Se déconnecter" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: /Se déconnecter/ })).toHaveAttribute("aria-busy", "true");
  });

  it("la fenêtre se ferme quand la confirmation aboutit", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<ConfirmDialog open onOpenChange={onOpenChange} onConfirm={async () => {}} {...DECONNEXION} />);
    await user.click(screen.getByRole("button", { name: "Se déconnecter" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("un échec de la confirmation est affiché dans la fenêtre", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const journal = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ConfirmDialog open onOpenChange={onOpenChange} onConfirm={() => Promise.reject(new Error("réseau"))} {...DECONNEXION} />);
    await user.click(screen.getByRole("button", { name: "Se déconnecter" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("L’action n’a pas abouti");
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Se déconnecter" })).toBeEnabled();
    expect(journal).toHaveBeenCalled();
    journal.mockRestore();
  });

  it("une fenêtre bloquante ne se ferme ni avec Échap ni par une croix", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Dialog open onOpenChange={onOpenChange} dismissible={false} title="Votre session a expiré" footer={<button type="button">Se reconnecter</button>} />);
    expect(screen.queryByRole("button", { name: "Fermer" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("la fenêtre a une forme téléphone", () => {
    render(<ConfirmDialog open onOpenChange={() => {}} onConfirm={() => {}} {...DECONNEXION} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("max-sm:bottom-0");
    const poignee = dialog.querySelector("[data-poignee]");
    expect(poignee).not.toBeNull();
    expect(poignee).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("button", { name: "Se déconnecter" }).parentElement).toHaveClass("max-sm:flex-col-reverse");
  });

  it("la suppression exige le mot exact", async () => {
    const user = userEvent.setup();
    render(
      <TypedConfirmDialog
        open
        onOpenChange={() => {}}
        onConfirm={() => {}}
        tone="danger"
        title="Supprimer votre compte ?"
        description="Vos formations et votre progression seront supprimées. Vos certificats déjà délivrés resteront vérifiables."
        confirmLabel="Supprimer mon compte"
        confirmWord="SUPPRIMER"
      />,
    );
    const bouton = screen.getByRole("button", { name: "Supprimer mon compte" });
    const champ = screen.getByLabelText("Pour confirmer, saisissez SUPPRIMER");
    expect(bouton).toBeDisabled();
    await user.type(champ, "supprimer");
    expect(bouton).toBeDisabled();
    await user.clear(champ);
    await user.type(champ, "SUPPRIMER");
    expect(bouton).toBeEnabled();
    // Les claviers de téléphone ajoutent souvent une espace après un mot proposé.
    await user.type(champ, " ");
    expect(bouton).toBeEnabled();
    expect(champ).toHaveAttribute("autocapitalize", "characters");
    expect(champ).toHaveAttribute("autocorrect", "off");
  });
});
