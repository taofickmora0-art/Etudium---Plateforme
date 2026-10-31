// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/layout/AppShell";
import { CLE_MENU, SCRIPT_MENU } from "@/lib/menu-lateral";

// La barre latérale repliable (demande du 14 octobre 2026) : un bouton de l'en-tête la réduit à ses icônes ; le choix
// est mémorisé sur l'appareil. Réduite, elle ne se déplie plus au survol ni au clavier (demande du 31 octobre 2026) :
// on la rouvre avec son bouton.

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

  it("la barre reste en place quand la page défile (même coque pour les trois espaces) et défile seule si l'écran est trop bas", () => {
    // Demande du 15 octobre 2026 : « figer » la barre latérale, dans l'espace étudiant, formateur et back-office.
    const { container } = render(<AppShell espace="etudiant">Contenu</AppShell>);
    const barre = container.querySelector(".menu-lateral");
    // Sous l'en-tête, lui aussi figé (31 octobre) : à sa hauteur, mesurée dans le navigateur (--entete-app).
    expect(barre).toHaveClass("sticky", "top-[var(--entete-app)]", "max-h-[calc(100dvh-var(--entete-app))]", "overflow-y-auto");
    // Sur un écran bas (portable en 1366 × 768), une barre de défilement fine et discrète, pas celle, épaisse, de Windows.
    expect(barre?.className).toContain("[scrollbar-width:thin]");
  });

  it("la hauteur de l'en-tête est mesurée et posée sur la page (--entete-app), pour la barre figée dessous", async () => {
    const { MesureEntete } = await import("@/components/layout/MesureEntete");
    const observe = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private rappel: () => void) {}
        observe(el: Element) {
          observe(el);
          this.rappel();
        }
        disconnect() {}
      },
    );
    const entete = document.createElement("header");
    entete.setAttribute("data-entete-app", "");
    vi.spyOn(entete, "getBoundingClientRect").mockReturnValue({ height: 89 } as DOMRect);
    document.body.appendChild(entete);
    render(<MesureEntete />);
    await waitFor(() => expect(document.documentElement.style.getPropertyValue("--entete-app")).toBe("89px"));
    expect(observe).toHaveBeenCalledWith(entete);
    entete.remove();
    vi.unstubAllGlobals();
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

  it("la feuille de style : réduite, une colonne d'icônes qui ne se déplie ni au survol ni au clavier ; le libellé reste lu", () => {
    const css = lire("src/app/globals.css");
    expect(css).toContain('html[data-menu="reduit"] .menu-lateral-place');
    expect(css).not.toContain(".menu-lateral:hover");
    expect(css).not.toContain(".menu-lateral:has(:focus-visible)");
    // Les intertitres et étiquettes disparaissent ; le libellé est masqué à l'écran mais garde le nom du lien.
    expect(css).toMatch(/\.menu-lateral-intertitre, \.menu-lateral-etiquette\) \{\s*display: none/);
    expect(css).toMatch(/\.menu-lateral-libelle \{[^}]*clip-path: inset\(50%\)/);
    expect(css).not.toMatch(/\.menu-lateral-libelle[^{]*\{[^}]*display: none/);
    expect(css).toMatch(/\.menu-lateral-entree \{\s*width: 44px/);
    expect(css).toMatch(/prefers-reduced-motion[\s\S]*menu-lateral/);
  });
});
