// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HeaderAccount } from "@/components/layout/AppHeader";
import { AppShell } from "@/components/layout/AppShell";
import { MobileNav } from "@/components/layout/MobileNav";
import { DEMO_USER } from "@/lib/demo-user";

vi.mock("next/navigation", () => ({ usePathname: () => "/accueil", useRouter: () => ({ push: vi.fn() }) }));
// La cloche se charge par une action du serveur (migration 0016) : sans base ici, elle reste vide.
vi.mock("@/lib/notifications/actions", () => ({ chargerCloche: async () => null, marquerLues: async () => ({ ok: true }) }));

describe("Coque", () => {
  it("le lien d'évitement mène au contenu", () => {
    render(<AppShell>Contenu de la page</AppShell>);
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
    render(<AppShell account={<HeaderAccount user={DEMO_USER} />}>Contenu</AppShell>);
    const entete = screen.getByRole("banner");
    // Deux liens « Rechercher » : le bouton de l'ordinateur et la loupe du téléphone.
    for (const lien of within(entete).getAllByRole("link", { name: "Rechercher" })) expect(lien).toHaveAttribute("href", "/recherche");
    expect(within(entete).getByRole("link", { name: "Ajouter une formation" })).toHaveAttribute("href", "/formations");
    expect(within(entete).getByRole("link", { name: "Étudium, accueil" })).toHaveAttribute("href", "/accueil");
    expect(within(entete).getByRole("link", { name: /^Série d’apprentissage/ })).toHaveAttribute("href", "/tableau-de-bord");
  });

  it("la page s'affiche sans attendre le compte : l'en-tête n'a pas encore de compteurs", () => {
    render(<AppShell>Contenu de la page</AppShell>);
    expect(screen.getByRole("main")).toHaveTextContent("Contenu de la page");
    expect(screen.queryByRole("link", { name: /^Série d’apprentissage/ })).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Navigation" })).toBeInTheDocument();
  });

  it("le compte s'affiche dans l'en-tête : série, points et profil", () => {
    render(<AppShell account={<HeaderAccount user={DEMO_USER} />}>Contenu</AppShell>);
    const entete = screen.getByRole("banner");
    // Lot 6 B : des liens vers le tableau de bord, qui disent ce qu'ils comptent.
    expect(within(entete).getByRole("link", { name: "Série d’apprentissage : 8 jours" })).toHaveTextContent("8");
    expect(within(entete).getByRole("link", { name: "Points gagnés cette semaine : 165 points" })).toHaveTextContent("165");
    expect(within(entete).getByRole("button", { name: "Mon profil" })).toBeInTheDocument();
  });
});
