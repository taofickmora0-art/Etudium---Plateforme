// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/layout/AppShell";
import { MobileNav } from "@/components/layout/MobileNav";
import { DEMO_USER } from "@/lib/demo-user";

vi.mock("next/navigation", () => ({ usePathname: () => "/accueil", useRouter: () => ({ push: vi.fn() }) }));

describe("Coque", () => {
  it("le lien d'évitement mène au contenu", () => {
    render(<AppShell user={DEMO_USER}>Contenu de la page</AppShell>);
    expect(screen.getByRole("link", { name: "Aller au contenu" })).toHaveAttribute("href", "#contenu");
    expect(screen.getByRole("main")).toHaveAttribute("id", "contenu");
    expect(screen.getByRole("main")).toHaveTextContent("Contenu de la page");
  });

  it("la barre du bas marque l'accueil en bleu", () => {
    render(<MobileNav />);
    const accueil = within(screen.getByRole("navigation", { name: "Navigation" })).getByRole("link", { name: "Accueil" });
    expect(accueil).toHaveAttribute("aria-current", "page");
    expect(accueil).toHaveClass("text-bleu");
  });

  it("l'en-tête mène à la recherche et au catalogue", () => {
    render(<AppShell user={DEMO_USER}>Contenu</AppShell>);
    const entete = screen.getByRole("banner");
    // Deux liens « Rechercher » : le bouton de l'ordinateur et la loupe du téléphone.
    for (const lien of within(entete).getAllByRole("link", { name: "Rechercher" })) expect(lien).toHaveAttribute("href", "/recherche");
    expect(within(entete).getByRole("link", { name: "Ajouter une formation" })).toHaveAttribute("href", "/formations");
    expect(within(entete).getByRole("link", { name: "Étudium, accueil" })).toHaveAttribute("href", "/accueil");
  });
});
