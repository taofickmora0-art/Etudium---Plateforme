// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// La barre du bas de l'étudiant (demande du 4 novembre 2026, maquette validée) : « Événements » laisse sa place à un
// bouton rond « Discussions » au milieu, avec la pastille des non-lus (messages + groupes). Un appui ouvre l'éventail :
// « Messages » et « Groupes » sortent du bouton, chacun avec ses non-lus. Le même bouton reste devant l'écran sombre :
// son icône devient une croix, et le retoucher referme (retour du 4 novembre 2026 : pas de seconde croix posée dessus).
// L'écran sombre ou Échap referment aussi. « Événements » reste dans le menu ≡.

let chemin = "/accueil";
vi.mock("next/navigation", () => ({ usePathname: () => chemin, useRouter: () => ({ push: vi.fn() }) }));
let messages = 0;
let groupes = 0;
vi.mock("@/components/messages/useMessagesNonLus", () => ({ useMessagesNonLus: () => messages }));
vi.mock("@/components/groupes/useGroupesNonLus", () => ({ useGroupesNonLus: () => groupes }));

const { BottomNavLinks } = await import("@/components/layout/MobileNav");
const { NAV_PRINCIPALE } = await import("@/lib/navigation");

beforeEach(() => {
  chemin = "/accueil";
  messages = 0;
  groupes = 0;
});

describe("La barre du bas de l'étudiant", () => {
  it("Accueil, Formations, le bouton Discussions au milieu, Certificats, Profil ; plus d'« Événements » (il reste dans le menu ≡)", () => {
    render(<BottomNavLinks pathname="/accueil" />);
    const barre = screen.getByRole("navigation", { name: "Navigation" });
    const elements = within(barre).getAllByRole("link").map((l) => l.textContent);
    expect(elements).toEqual(["Accueil", "Formations", "Certificats", "Profil"]);
    const bouton = within(barre).getByRole("button", { name: "Discussions" });
    expect(bouton).toHaveAttribute("aria-expanded", "false");
    // Au milieu : après Formations, avant Certificats.
    const ordre = [...barre.querySelectorAll("a, button")].map((e) => e.textContent);
    expect(ordre.indexOf("Discussions")).toBe(2);
    expect(NAV_PRINCIPALE.map((e) => e.href)).toContain("/evenements");
  });

  it("la pastille additionne les messages et les groupes non lus ; rien sans non-lus", () => {
    messages = 2;
    groupes = 5;
    const { unmount } = render(<BottomNavLinks pathname="/accueil" />);
    expect(screen.getByRole("button", { name: "Discussions, 7 non lus" })).toHaveTextContent("7");
    unmount();
    messages = 0;
    groupes = 0;
    render(<BottomNavLinks pathname="/accueil" />);
    expect(screen.getByRole("button", { name: "Discussions" })).not.toHaveTextContent(/\d/);
  });

  it("un appui ouvre l'éventail : Messages et Groupes, avec leurs non-lus ; le même bouton devient la croix et referme", async () => {
    const user = userEvent.setup();
    messages = 1;
    groupes = 2;
    render(<BottomNavLinks pathname="/accueil" />);
    const bouton = screen.getByRole("button", { name: "Discussions, 3 non lus" });
    await user.click(bouton);
    const eventail = screen.getByRole("dialog", { name: "Discussions" });
    expect(within(eventail).getByRole("link", { name: "Messages, 1 non lu" })).toHaveAttribute("href", "/messages");
    expect(within(eventail).getByRole("link", { name: "Groupes, 2 non lus" })).toHaveAttribute("href", "/groupes");
    // Une seule croix : le bouton Discussions lui-même, ouvert.
    expect(screen.getAllByRole("button", { name: /Fermer/ })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Fermer les discussions" })).toBe(bouton);
    expect(bouton).toHaveAttribute("aria-expanded", "true");
    await user.click(bouton);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Discussions" })).toBeNull());
    expect(bouton).toHaveAttribute("aria-expanded", "false");
  });

  it("Échap ou l'écran sombre referment ; choisir un lien referme aussi", async () => {
    const user = userEvent.setup();
    render(<BottomNavLinks pathname="/accueil" />);
    await user.click(screen.getByRole("button", { name: "Discussions" }));
    expect(screen.getByRole("dialog", { name: "Discussions" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await user.click(screen.getByRole("button", { name: "Discussions" }));
    await user.click(screen.getByTestId("voile-discussions"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await user.click(screen.getByRole("button", { name: "Discussions" }));
    await user.click(screen.getByRole("link", { name: "Groupes" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await act(async () => undefined);
  });

  it("sur Messages ou un groupe, le bouton est marqué comme la page en cours", () => {
    const { unmount } = render(<BottomNavLinks pathname="/messages" />);
    expect(screen.getByRole("button", { name: "Discussions" })).toHaveAttribute("data-actif", "true");
    unmount();
    render(<BottomNavLinks pathname="/groupes/general" />);
    expect(screen.getByRole("button", { name: "Discussions" })).toHaveAttribute("data-actif", "true");
  });

  it("le formateur et le back-office gardent leur barre", () => {
    const { unmount } = render(<BottomNavLinks pathname="/formateur" />);
    expect(screen.queryByRole("button", { name: /Discussions/ })).toBeNull();
    unmount();
    render(<BottomNavLinks pathname="/admin/avis" />);
    expect(screen.queryByRole("button", { name: /Discussions/ })).toBeNull();
  });
});
