// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SignInForm } from "@/components/auth/SignInForm";

let terminer: (state: unknown) => void = () => {};
const signIn = vi.fn(() => new Promise((resolve) => (terminer = resolve)));
vi.mock("@/lib/auth/actions", () => ({ signIn: () => signIn(), signInWithGoogle: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));

describe("Formulaire de connexion", () => {
  it("le formulaire ne s'envoie qu'une fois", async () => {
    render(<SignInForm />);
    fireEvent.change(screen.getByLabelText("Adresse e-mail"), { target: { value: "aicha.k@exemple.com" } });
    fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: "motdepasse" } });
    // Deux clics rapides : le second tombe sur un bouton déjà en chargement.
    const bouton = screen.getByRole("button", { name: "Se connecter" });
    fireEvent.click(bouton);
    fireEvent.click(bouton);
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /Se connecter/ })).toHaveAttribute("aria-busy", "true");
    await act(async () => terminer({ status: "idle" }));
  });
});
