// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VerifyCodeForm } from "@/components/auth/VerifyCodeForm";
import { CodeInput } from "@/components/ui/CodeInput";

vi.mock("@/lib/auth/actions", () => ({ verifyCode: vi.fn(), resendCode: vi.fn() }));

describe("Écran du code", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("le renvoi attend 45 secondes", () => {
    render(<VerifyCodeForm email="aicha.k@exemple.com" />);
    const renvoyer = screen.getByRole("button", { name: /Renvoyer le code/ });
    expect(renvoyer).toBeDisabled();
    expect(screen.getByText(/0:45/)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(30_000));
    expect(screen.getByText(/0:15/)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(15_000));
    expect(screen.getByRole("button", { name: "Renvoyer le code" })).toBeEnabled();
  });

  it("l'écran du code propose de se connecter", () => {
    render(<VerifyCodeForm email="aicha.k@exemple.com" />);
    expect(screen.getByRole("link", { name: "Se connecter" })).toHaveAttribute("href", "/connexion");
  });

  it("l'adresse est rappelée", () => {
    render(<VerifyCodeForm email="aicha.k@exemple.com" />);
    expect(screen.getByText("aicha.k@exemple.com")).toBeInTheDocument();
  });
});

describe("Erreur du code", () => {
  it("l'erreur du code est reliée aux cases", () => {
    render(<CodeInput label="Code reçu par e-mail" value="111111" onChange={() => {}} error="Code incorrect." />);
    expect(screen.getByRole("group", { name: "Code reçu par e-mail" })).toHaveAccessibleDescription(/Code incorrect\./);
    expect(screen.getByLabelText("Chiffre 1")).toHaveAttribute("aria-invalid", "true");
  });
});
