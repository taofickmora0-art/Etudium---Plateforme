// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PAGES_A_VENIR } from "@/lib/pages-a-venir";

vi.mock("@/components/layout/SessionGuard", () => ({ SessionGuard: () => null }));

const { default: Page } = await import("@/app/(app)/(etudiant)/aide/page");

describe("Page Aide (lot 1)", () => {
  it("reprend les 7 questions fréquentes de la landing, la première dépliée", () => {
    render(<Page />);
    expect(screen.getByRole("heading", { level: 1, name: "Aide" })).toBeInTheDocument();
    const questions = screen.getAllByRole("button", { expanded: false }).concat(screen.getAllByRole("button", { expanded: true }));
    expect(questions).toHaveLength(7);
    expect(screen.getByRole("button", { name: "Le compte gratuit est-il vraiment gratuit ?" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByText("Bientôt disponible")).toBeNull();
  });

  it("une autre question : la communauté (l'Accueil) et la vérification d'un certificat", () => {
    render(<Page />);
    expect(screen.getByRole("heading", { level: 2, name: "Une autre question ?" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Aller à la communauté" })).toHaveAttribute("href", "/accueil");
    expect(screen.getByRole("link", { name: "Vérifier un certificat" })).toHaveAttribute("href", "/verifier");
  });

  it("n'est plus une page à venir", () => {
    expect(PAGES_A_VENIR).not.toHaveProperty("aide");
  });
});
