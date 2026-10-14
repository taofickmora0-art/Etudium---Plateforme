// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/layout/AppShell";

// Le menu ≡ du téléphone (demande du 14 octobre 2026) : comme la barre latérale de l'ordinateur, toutes les entrées de
// l'espace, sans passer par le profil.

let chemin = "/accueil";
let recherche = "";
vi.mock("next/navigation", () => ({ usePathname: () => chemin, useSearchParams: () => new URLSearchParams(recherche), useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/notifications/actions", () => ({ chargerCloche: async () => null, marquerLues: async () => ({ ok: true }) }));
const chargerEspaces = vi.fn();
vi.mock("@/lib/communaute/actions", () => ({ chargerEspaces: () => chargerEspaces() }));

const P = "22222222-2222-4222-8222-222222222222";
const B = "44444444-4444-4444-8444-444444444444";

afterEach(() => {
  delete document.documentElement.dataset.menu;
  chemin = "/accueil";
  recherche = "";
  chargerEspaces.mockReset();
});

describe("Le menu du téléphone", () => {
  it("le bouton ≡ de l'en-tête ouvre toutes les entrées de l'espace ; choisir une entrée ou « Fermer le menu » le referme", async () => {
    const user = userEvent.setup();
    render(<AppShell espace="etudiant">Contenu</AppShell>);
    const bouton = within(screen.getByRole("banner")).getByRole("button", { name: "Menu" });
    expect(bouton).toHaveAttribute("aria-expanded", "false");
    await user.click(bouton);
    const tiroir = screen.getByRole("dialog", { name: "Menu" });
    const liens = within(tiroir).getAllByRole("link").map((l) => l.textContent);
    expect(liens).toEqual(expect.arrayContaining(["Accueil", "Événements", "Communauté", "Messages", "Mes formations", "Toutes les formations", "Aide"]));
    expect(within(tiroir).getByRole("link", { name: "Accueil" })).toHaveAttribute("aria-current", "page");
    await user.click(within(tiroir).getByRole("link", { name: "Communauté" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await user.click(bouton);
    await user.click(within(screen.getByRole("dialog", { name: "Menu" })).getByRole("button", { name: "Fermer le menu" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("le choix « réduite » de l'ordinateur ne touche pas le tiroir", async () => {
    const user = userEvent.setup();
    document.documentElement.dataset.menu = "reduit";
    render(<AppShell espace="etudiant">Contenu</AppShell>);
    await user.click(within(screen.getByRole("banner")).getByRole("button", { name: "Menu" }));
    const tiroir = screen.getByRole("dialog", { name: "Menu" });
    expect(tiroir.querySelector(".menu-lateral, .menu-lateral-place")).toBeNull();
    expect(document.querySelectorAll("#menu-lateral")).toHaveLength(1);
  });

  it("sur la Communauté : le groupe « Espaces de la communauté » après le premier groupe, l'espace ouvert marqué, un cadenas sur les fermés", async () => {
    const user = userEvent.setup();
    chemin = "/communaute";
    recherche = "espace=general";
    chargerEspaces.mockResolvedValue({
      ok: true,
      espaces: [
        { id: null, nom: "Général", nomCourt: "Général", couleur: null, slug: null, ouvert: true },
        { id: P, nom: "Réussite académique", nomCourt: "Académique", couleur: "academique", slug: "reussite-academique", ouvert: true },
        { id: B, nom: "Réussite business", nomCourt: "Business", couleur: "business", slug: "reussite-business", ouvert: false },
      ],
    });
    render(<AppShell espace="etudiant">Contenu</AppShell>);
    await user.click(within(screen.getByRole("banner")).getByRole("button", { name: "Menu" }));
    const tiroir = screen.getByRole("dialog", { name: "Menu" });
    const groupe = await within(tiroir).findByRole("group", { name: "Espaces de la communauté" });
    const liens = within(groupe).getAllByRole("link");
    expect(liens.map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
      ["Actualités", "/communaute?espace=tous"],
      ["Général", "/communaute?espace=general"],
      ["Académique", `/communaute?espace=${P}`],
      ["Business, espace verrouillé", `/communaute?espace=${B}`],
    ]);
    expect(within(groupe).getByRole("link", { name: "Général" })).toHaveAttribute("aria-current", "page");
    expect(within(groupe).getByRole("link", { name: "Actualités" })).not.toHaveAttribute("aria-current");
    // Juste après le premier groupe (Accueil, Événements, Communauté, Messages).
    const groupes = within(tiroir).getAllByRole("group").map((g) => g.getAttribute("aria-labelledby") && document.getElementById(g.getAttribute("aria-labelledby")!)?.textContent);
    expect(groupes[0]).toBe("Espaces de la communauté");
  });

  it("ailleurs : pas de groupe des espaces, aucune lecture", async () => {
    const user = userEvent.setup();
    render(<AppShell espace="etudiant">Contenu</AppShell>);
    await user.click(within(screen.getByRole("banner")).getByRole("button", { name: "Menu" }));
    expect(within(screen.getByRole("dialog", { name: "Menu" })).queryByRole("group", { name: "Espaces de la communauté" })).toBeNull();
    expect(chargerEspaces).not.toHaveBeenCalled();
  });
});

