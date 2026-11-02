// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// L'inscription par Google n'a pas de case à cocher : une phrase sous le bouton dit qu'on accepte les conditions et la
// politique de confidentialité (pages réelles du 2 novembre 2026, avant la mise en ligne).
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/inscription",
}));
vi.mock("@/lib/auth/actions", () => ({ signUp: vi.fn(), signInWithGoogle: vi.fn() }));

const { SignUpForm } = await import("@/components/auth/SignUpForm");

describe("Inscription par Google", () => {
  it("la phrase d'acceptation suit le bouton, avec les liens vers les deux pages", () => {
    render(<SignUpForm />);
    const phrase = screen.getByText(/En continuant avec Google, vous acceptez/);
    expect(phrase).toHaveTextContent("En continuant avec Google, vous acceptez les conditions d’utilisation et la politique de confidentialité.");
    expect(screen.getAllByRole("link", { name: "conditions d’utilisation" })[0]).toHaveAttribute("href", "/conditions");
    expect(screen.getAllByRole("link", { name: "politique de confidentialité" })[0]).toHaveAttribute("href", "/confidentialite");
  });
});
