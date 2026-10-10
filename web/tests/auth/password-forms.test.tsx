// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NewPasswordForm } from "@/components/auth/NewPasswordForm";
import { ResetRequestForm } from "@/components/auth/ResetRequestForm";
import { requestReset, updatePassword } from "@/lib/auth/actions";

vi.mock("@/lib/auth/actions", () => ({ requestReset: vi.fn(), updatePassword: vi.fn() }));

describe("Écran « Mot de passe oublié »", () => {
  beforeEach(() => {
    vi.mocked(requestReset).mockReset();
  });

  it("après l'envoi, l'adresse est rappelée et le lien peut être renvoyé", async () => {
    vi.mocked(requestReset).mockResolvedValue({ status: "success", values: { email: "aicha.k@exemple.com" } });
    render(<ResetRequestForm />);
    fireEvent.click(screen.getByRole("button", { name: "Envoyer le lien" }));
    expect(await screen.findByRole("heading", { name: "Vérifiez votre boîte de réception" })).toBeInTheDocument();
    expect(screen.getByText(/Si un compte existe pour aicha\.k@exemple\.com/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Retour à la connexion" })).toHaveAttribute("href", "/connexion");
    expect(screen.getByRole("button", { name: "Renvoyer le lien" })).toBeInTheDocument();
  });

  it("un lien expiré est annoncé", () => {
    render(<ResetRequestForm linkExpired />);
    expect(screen.getByRole("status")).toHaveTextContent("Ce lien a expiré. Demandez-en un nouveau.");
  });
});

describe("Écran « Nouveau mot de passe »", () => {
  it("un lien expiré propose d'en demander un nouveau", async () => {
    vi.mocked(updatePassword).mockResolvedValue({ status: "error", message: "Ce lien a expiré. Demandez-en un nouveau." });
    render(<NewPasswordForm />);
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le mot de passe" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ce lien a expiré.");
    expect(screen.getByRole("link", { name: "Nouveau lien" })).toHaveAttribute("href", "/mot-de-passe-oublie");
  });
});
