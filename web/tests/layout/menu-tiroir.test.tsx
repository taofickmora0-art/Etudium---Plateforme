// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/layout/AppShell";

// Le menu ≡ du téléphone (demande du 14 octobre 2026) : comme la barre latérale de l'ordinateur, toutes les entrées de
// l'espace, sans passer par le profil.

vi.mock("next/navigation", () => ({ usePathname: () => "/accueil", useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/notifications/actions", () => ({ chargerCloche: async () => null, marquerLues: async () => ({ ok: true }) }));

afterEach(() => {
  delete document.documentElement.dataset.menu;
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
});
