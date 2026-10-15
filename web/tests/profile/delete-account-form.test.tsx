// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DeleteAccountCard } from "@/components/profile/DeleteAccountCard";
import { deleteAccount } from "@/lib/profile/actions";
import { loadFullPage } from "@/lib/full-page";

vi.mock("@/lib/profile/actions", () => ({ deleteAccount: vi.fn() }));
vi.mock("@/lib/full-page", () => ({ loadFullPage: vi.fn() }));

describe("Carte « Supprimer mon compte »", () => {
  it("la suppression demande de saisir SUPPRIMER", async () => {
    vi.mocked(deleteAccount).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<DeleteAccountCard />);
    expect(screen.getByText("Cette action est définitive. Vos formations et votre progression seront supprimées ; vos certificats restent vérifiables.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Supprimer mon compte" }));
    const fenetre = screen.getByRole("dialog", { name: "Supprimer votre compte ?" });
    const confirmer = [...fenetre.querySelectorAll("button")].find((b) => b.textContent === "Supprimer mon compte")!;
    await user.type(screen.getByLabelText("Pour confirmer, saisissez SUPPRIMER"), "supprimer");
    expect(confirmer).toBeDisabled();
    await user.clear(screen.getByLabelText("Pour confirmer, saisissez SUPPRIMER"));
    await user.type(screen.getByLabelText("Pour confirmer, saisissez SUPPRIMER"), "SUPPRIMER");
    expect(confirmer).toBeEnabled();
    await user.click(confirmer);
    expect(deleteAccount).toHaveBeenCalledOnce();
    expect(loadFullPage).toHaveBeenCalledWith("/connexion?compte=supprime");
  });
});
