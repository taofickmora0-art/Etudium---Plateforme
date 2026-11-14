// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SecurityTab } from "@/components/profile/SecurityTab";
import { ToastProvider } from "@/components/ui/Toast";
import { DEMO_PROFILE } from "@/lib/demo-user";
import { changePassword, envoyerLienMotDePasse } from "@/lib/profile/actions";

vi.mock("@/lib/profile/actions", () => ({ changePassword: vi.fn(), deleteAccount: vi.fn(), envoyerLienMotDePasse: vi.fn() }));
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

  it("une coupure réseau est annoncée", async () => {
    vi.mocked(changePassword).mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    afficher();
    await user.type(screen.getByLabelText("Mot de passe actuel"), "motdepasse");
    await user.type(screen.getByLabelText("Nouveau mot de passe"), "nouveaumdp");
    await user.click(screen.getByRole("button", { name: "Mettre à jour" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Une erreur est survenue. Vérifiez votre connexion, puis réessayez.");
  });

  it("un compte Google crée son mot de passe par un lien reçu à son adresse (14 novembre 2026)", async () => {
    vi.mocked(envoyerLienMotDePasse).mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    afficher({ ...DEMO_PROFILE, hasPassword: false });
    expect(screen.queryByLabelText("Mot de passe actuel")).not.toBeInTheDocument();
    expect(screen.getByText("Vous vous connectez avec Google. Créez un mot de passe pour vous connecter aussi avec votre adresse e-mail.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Créer un mot de passe" }));
    expect(envoyerLienMotDePasse).toHaveBeenCalled();
    expect(await screen.findByText("Lien envoyé à aicha.k@exemple.com : ouvrez-le pour choisir votre mot de passe.")).toBeInTheDocument();
  });

  it("l'envoi du lien refusé ou impossible : le message, et on peut réessayer", async () => {
    vi.mocked(envoyerLienMotDePasse).mockResolvedValueOnce({ ok: false, message: "Trop de demandes. Réessayez dans quelques minutes." }).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    afficher({ ...DEMO_PROFILE, hasPassword: false });
    await user.click(screen.getByRole("button", { name: "Créer un mot de passe" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Trop de demandes. Réessayez dans quelques minutes.");
    await user.click(screen.getByRole("button", { name: "Créer un mot de passe" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Une erreur est survenue. Vérifiez votre connexion, puis réessayez.");
  });

  it("le compte Google associé est indiqué", () => {
    afficher();
    expect(screen.getByText("Connexion avec Google")).toBeInTheDocument();
    expect(screen.getByText("Associée à aicha.k@exemple.com")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });
});
