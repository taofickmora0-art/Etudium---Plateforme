// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/layout/AppShell";
import { CLE_MENU, SCRIPT_MENU } from "@/lib/menu-lateral";

// La barre latérale repliable (demande du 14 octobre 2026) : un bouton de l'en-tête la réduit à ses icônes ; au survol
// ou au clavier, elle se déplie par-dessus la page ; le choix est mémorisé sur l'appareil.

vi.mock("next/navigation", () => ({ usePathname: () => "/accueil", useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/notifications/actions", () => ({ chargerCloche: async () => null, marquerLues: async () => ({ ok: true }) }));

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");

afterEach(() => {
  delete document.documentElement.dataset.menu;
  localStorage.clear();
});

describe("La barre latérale repliable", () => {
  it("le bouton de l'en-tête réduit puis rouvre la barre : attribut de la page, choix mémorisé, libellé et aria-expanded", async () => {
    const user = userEvent.setup();
    render(<AppShell>Contenu</AppShell>);
    const bouton = within(screen.getByRole("banner")).getByRole("button", { name: "Réduire le menu" });
    expect(bouton).toHaveAttribute("aria-expanded", "true");
    expect(bouton).toHaveAttribute("aria-controls", "menu-lateral");
    await user.click(bouton);
    expect(document.documentElement.dataset.menu).toBe("reduit");
    expect(localStorage.getItem(CLE_MENU)).toBe("reduit");
    expect(bouton).toHaveAccessibleName("Ouvrir le menu");
    expect(bouton).toHaveAttribute("aria-expanded", "false");
    await user.click(bouton);
    expect(document.documentElement.dataset.menu).toBeUndefined();
    expect(localStorage.getItem(CLE_MENU)).toBe("ouvert");
    expect(bouton).toHaveAccessibleName("Réduire le menu");
  });

  it("la barre : l'identifiant visé par le bouton ; toutes ses entrées restent dans la page, réduite ou non", async () => {
    const user = userEvent.setup();
    const { container } = render(<AppShell espace="etudiant">Contenu</AppShell>);
    const nav = container.querySelector("#menu-lateral");
    expect(nav).not.toBeNull();
    expect(nav?.closest(".menu-lateral")?.parentElement).toHaveClass("menu-lateral-place");
    const avant = within(nav as HTMLElement).getAllByRole("link").length;
    await user.click(screen.getByRole("button", { name: "Réduire le menu" }));
    expect(within(nav as HTMLElement).getAllByRole("link")).toHaveLength(avant);
    const accueil = within(nav as HTMLElement).getByRole("link", { name: "Accueil" });
    // Réduite, chaque entrée devient un carré d'icône : le libellé et l'étiquette s'effacent (feuille de style).
    expect(accueil).toHaveClass("menu-lateral-entree");
    expect(within(accueil).getByText("Accueil")).toHaveClass("menu-lateral-libelle");
  });

  it("au chargement, le choix mémorisé s'applique avant l'affichage ; sans stockage lisible, rien ne casse", () => {
    localStorage.setItem(CLE_MENU, "reduit");
    new Function(SCRIPT_MENU)();
    expect(document.documentElement.dataset.menu).toBe("reduit");
    delete document.documentElement.dataset.menu;
    localStorage.setItem(CLE_MENU, "ouvert");
    new Function(SCRIPT_MENU)();
    expect(document.documentElement.dataset.menu).toBeUndefined();
    const lecture = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("stockage bloqué");
    });
    expect(() => new Function(SCRIPT_MENU)()).not.toThrow();
    lecture.mockRestore();
    // La page racine l'exécute dans <head>, avant le premier affichage.
    expect(lire("src/app/layout.tsx")).toContain("SCRIPT_MENU");
  });

  it("la feuille de style : la place réduite, le dépliement au survol et au clavier, sans animation si on la refuse", () => {
    const css = lire("src/app/globals.css");
    expect(css).toContain('html[data-menu="reduit"] .menu-lateral-place');
    expect(css).toContain('html[data-menu="reduit"] .menu-lateral:hover');
    expect(css).toContain('html[data-menu="reduit"] .menu-lateral:has(:focus-visible)');
    expect(css).toMatch(/\.menu-lateral-libelle[\s\S]*display: none/);
    expect(css).toMatch(/\.menu-lateral-entree \{\s*width: 44px/);
    expect(css).toMatch(/prefers-reduced-motion[\s\S]*menu-lateral/);
  });
});
