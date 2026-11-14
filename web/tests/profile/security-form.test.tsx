// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SecurityTab } from "@/components/profile/SecurityTab";
import { ToastProvider } from "@/components/ui/Toast";
import { DEMO_PROFILE } from "@/lib/demo-user";
import { changePassword, creerMotDePasse, envoyerCodeMotDePasse } from "@/lib/profile/actions";

vi.mock("@/lib/profile/actions", () => ({ changePassword: vi.fn(), deleteAccount: vi.fn(), envoyerCodeMotDePasse: vi.fn(), creerMotDePasse: vi.fn() }));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
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

  // Un compte Google crée son mot de passe (demande du 14 novembre 2026) : le formulaire, puis un code à 6 chiffres reçu
  // à l'adresse du compte, qui prouve que c'est bien lui.
  const google = { ...DEMO_PROFILE, hasPassword: false };
  const remplir = async (user: ReturnType<typeof userEvent.setup>, confirmation = "nouveaumdp") => {
    await user.click(screen.getByRole("button", { name: "Créer un mot de passe" }));
    await user.type(screen.getByLabelText("Nouveau mot de passe"), "nouveaumdp");
    await user.type(screen.getByLabelText("Confirmer le mot de passe"), confirmation);
    await user.click(screen.getByRole("button", { name: "Recevoir le code" }));
  };

  it("un compte Google : le formulaire, le code reçu par e-mail, puis le mot de passe est créé", async () => {
    vi.mocked(envoyerCodeMotDePasse).mockResolvedValue({ ok: true });
    vi.mocked(creerMotDePasse).mockResolvedValue({ status: "success" });
    const user = userEvent.setup();
    afficher(google);
    expect(screen.queryByLabelText("Mot de passe actuel")).not.toBeInTheDocument();
    expect(screen.getByText("Vous vous connectez avec Google. Créez un mot de passe pour vous connecter aussi avec votre adresse e-mail.")).toBeInTheDocument();
    await remplir(user);
    expect(envoyerCodeMotDePasse).toHaveBeenCalled();
    expect(await screen.findByText("Un code à 6 chiffres a été envoyé à aicha.k@exemple.com.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Chiffre 1"), { target: { value: "123456" } });
    await user.click(screen.getByRole("button", { name: "Confirmer" }));
    const envoye = vi.mocked(creerMotDePasse).mock.calls[0][1] as FormData;
    expect([envoye.get("password"), envoye.get("confirmation"), envoye.get("code")]).toEqual(["nouveaumdp", "nouveaumdp", "123456"]);
    const fenetre = await screen.findByRole("dialog", { name: "Mot de passe créé" });
    expect(fenetre).toHaveTextContent("Vous pouvez maintenant vous connecter avec votre adresse e-mail et ce mot de passe, ou avec Google.");
    await user.click(screen.getByRole("button", { name: "Compris" }));
    expect(refresh).toHaveBeenCalled();
  });

  it("deux mots de passe différents : le message, et aucun code n'est envoyé", async () => {
    vi.mocked(envoyerCodeMotDePasse).mockClear();
    const user = userEvent.setup();
    afficher(google);
    await remplir(user, "autremdp1");
    expect(screen.getByText("Les deux mots de passe ne correspondent pas.")).toBeInTheDocument();
    expect(envoyerCodeMotDePasse).not.toHaveBeenCalled();
  });

  it("un code faux : le message sous le code ; « Renvoyer le code » en demande un autre", async () => {
    vi.mocked(envoyerCodeMotDePasse).mockReset().mockResolvedValue({ ok: true });
    vi.mocked(creerMotDePasse).mockResolvedValue({ status: "error", fieldErrors: { code: "Ce code est incorrect ou a expiré. Demandez-en un nouveau." } });
    const user = userEvent.setup();
    afficher(google);
    await remplir(user);
    fireEvent.change(await screen.findByLabelText("Chiffre 1"), { target: { value: "000000" } });
    await user.click(screen.getByRole("button", { name: "Confirmer" }));
    expect(await screen.findByText("Ce code est incorrect ou a expiré. Demandez-en un nouveau.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Renvoyer le code" }));
    expect(envoyerCodeMotDePasse).toHaveBeenCalledTimes(2);
  });

  it("l'envoi du code refusé ou impossible : le message", async () => {
    vi.mocked(envoyerCodeMotDePasse)
      .mockReset()
      .mockResolvedValueOnce({ ok: false, message: "Trop de demandes. Réessayez dans quelques minutes." })
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    afficher(google);
    await remplir(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Trop de demandes. Réessayez dans quelques minutes.");
    await user.click(screen.getByRole("button", { name: "Recevoir le code" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Une erreur est survenue. Vérifiez votre connexion, puis réessayez.");
  });

  it("le compte Google associé est indiqué", () => {
    afficher();
    expect(screen.getByText("Connexion avec Google")).toBeInTheDocument();
    expect(screen.getByText("Associée à aicha.k@exemple.com")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });
});
