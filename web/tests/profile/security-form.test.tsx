// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SecurityTab } from "@/components/profile/SecurityTab";
import { ToastProvider } from "@/components/ui/Toast";
import { DEMO_PROFILE } from "@/lib/demo-user";
import { changePassword } from "@/lib/profile/actions";

vi.mock("@/lib/profile/actions", () => ({ changePassword: vi.fn(), deleteAccount: vi.fn() }));
vi.mock("@/lib/full-page", () => ({ loadFullPage: vi.fn() }));

const afficher = (profil = DEMO_PROFILE) =>
  render(
    <ToastProvider>
      <SecurityTab profile={profil} />
    </ToastProvider>,
  );

describe("Onglet Sécurité", () => {
  it("la réussite est confirmée", async () => {
    vi.mocked(changePassword).mockResolvedValue({ status: "success" });
    const user = userEvent.setup();
    afficher();
    await user.type(screen.getByLabelText("Mot de passe actuel"), "motdepasse");
    await user.type(screen.getByLabelText("Nouveau mot de passe"), "nouveaumdp");
    await user.click(screen.getByRole("button", { name: "Mettre à jour" }));
    const fenetre = await screen.findByRole("dialog", { name: "Mot de passe mis à jour" });
    expect(fenetre).toHaveTextContent("Cet appareil reste connecté. Les autres appareils ont été déconnectés.");
    await user.click(screen.getByRole("button", { name: "Compris" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("un compte Google sans mot de passe n'a pas de formulaire", () => {
    afficher({ ...DEMO_PROFILE, hasPassword: false });
    expect(screen.queryByLabelText("Mot de passe actuel")).not.toBeInTheDocument();
    expect(screen.getByText("Vous vous connectez avec Google : votre compte n’a pas de mot de passe Étudium.")).toBeInTheDocument();
  });

  it("le compte Google associé est indiqué", () => {
    afficher();
    expect(screen.getByText("Connexion avec Google")).toBeInTheDocument();
    expect(screen.getByText("Associée à aicha.k@exemple.com")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });
});
