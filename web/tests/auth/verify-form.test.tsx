// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
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

describe("Envoi automatique du code", () => {
  // Mise en ligne du 3 novembre 2026 : sur téléphone, le code complet (saisi ou inséré par le clavier) partait avec
  // 5 chiffres, et « Saisissez les 6 chiffres du code. » s'affichait en rouge alors que le code était juste.
  it("le code complet, inséré d'un coup dans la première case, part avec ses 6 chiffres", async () => {
    const { verifyCode } = await import("@/lib/auth/actions");
    const recus: string[] = [];
    vi.mocked(verifyCode).mockImplementation(async (_etat, donnees: FormData) => {
      recus.push(String(donnees.get("code")));
      return { status: "idle" } as never;
    });
    render(<VerifyCodeForm email="aicha.k@exemple.com" />);
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Chiffre 1"), { target: { value: "919047" } });
    });
    expect(recus).toEqual(["919047"]);
  });

  it("le sixième chiffre tapé envoie le code complet", async () => {
    const { verifyCode } = await import("@/lib/auth/actions");
    const recus: string[] = [];
    vi.mocked(verifyCode).mockImplementation(async (_etat, donnees: FormData) => {
      recus.push(String(donnees.get("code")));
      return { status: "idle" } as never;
    });
    render(<VerifyCodeForm email="aicha.k@exemple.com" />);
    for (const [i, chiffre] of [..."919047"].entries()) {
      await act(async () => {
        fireEvent.change(screen.getByLabelText(`Chiffre ${i + 1}`), { target: { value: chiffre } });
      });
    }
    expect(recus).toEqual(["919047"]);
  });
});
