// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HeaderActions } from "@/components/layout/HeaderActions";
import { DEMO_USER } from "@/lib/demo-user";
import { chargerCloche, marquerLues } from "@/lib/notifications/actions";
import { EVENEMENT_NOTIFICATIONS } from "@/lib/notifications/regles";
import type { LotNotifications, NotificationLue } from "@/lib/notifications/types";

// La cloche de l'en-tête (spec des notifications, §3) : nombre de non lues, 8 dernières, clic, tout marquer.

let chemin = "/accueil";
vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => chemin,
}));
vi.mock("@/lib/auth/actions", () => ({ signOut: vi.fn() }));
vi.mock("@/lib/full-page", () => ({ loadFullPage: vi.fn() }));
vi.mock("@/lib/notifications/actions", () => ({ chargerCloche: vi.fn(), marquerLues: vi.fn() }));

const ilYa = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const notif = (o: Partial<NotificationLue> = {}): NotificationLue => ({
  id: "7",
  categorie: "nouveaux_contenus",
  titre: "Nouvelle formation : Maîtriser Microsoft Excel",
  texte: "Dans le parcours Académique.",
  lien: "/formations/maitriser-microsoft-excel",
  creeLe: ilYa(5),
  lue: false,
  ...o,
});
const lot = (lignes: NotificationLue[], nonLues: number): LotNotifications => ({ lignes, suite: false, nonLues });

async function ouvrir(nom: string | RegExp) {
  const user = userEvent.setup();
  render(<HeaderActions user={DEMO_USER} />);
  await user.click(await screen.findByRole("button", { name: nom }));
  return user;
}

describe("La cloche", () => {
  beforeEach(() => {
    chemin = "/accueil";
    vi.mocked(chargerCloche).mockReset();
    vi.mocked(marquerLues).mockReset().mockResolvedValue({ ok: true });
  });

  it("12 non lues, 8 listées : le bouton dit « Notifications, 12 non lues »", async () => {
    const huit = Array.from({ length: 8 }, (_, i) => notif({ id: String(20 - i), titre: `Notification ${i + 1}` }));
    vi.mocked(chargerCloche).mockResolvedValue(lot(huit, 12));
    await ouvrir("Notifications, 12 non lues");
    expect(within(screen.getByRole("dialog", { name: "Notifications" })).getAllByRole("listitem")).toHaveLength(8);
  });

  it("plus haut que l'écran (téléphone, textes longs), le panneau défile : « Voir toutes les notifications » reste accessible", async () => {
    vi.mocked(chargerCloche).mockResolvedValue(lot([notif()], 1));
    await ouvrir("Notifications, 1 non lue");
    const panneau = screen.getByRole("dialog", { name: "Notifications" });
    expect(panneau).toHaveClass("overflow-y-auto");
    expect(panneau.className).toContain("max-h-(--radix-popover-content-available-height)");
  });

  it("ouvrir la cloche : titres, textes, « Il y a 5 min », point Non lue ; « Voir toutes les notifications » mène à /notifications", async () => {
    vi.mocked(chargerCloche).mockResolvedValue(lot([notif(), notif({ id: "6", categorie: "service", titre: "Vous êtes formateur", texte: "", lien: "/formateur", lue: true, creeLe: ilYa(60 * 26) })], 1));
    await ouvrir("Notifications, 1 non lue");
    const panneau = screen.getByRole("dialog", { name: "Notifications" });
    const lien = within(panneau).getByRole("link", { name: /Nouvelle formation : Maîtriser Microsoft Excel/ });
    expect(lien).toHaveAttribute("href", "/formations/maitriser-microsoft-excel");
    expect(within(lien).getByText("Dans le parcours Académique.")).toBeInTheDocument();
    expect(within(lien).getByText("Il y a 5 min")).toBeInTheDocument();
    expect(within(lien).getByText("Non lue")).toBeInTheDocument();
    const lue = within(panneau).getByRole("link", { name: /Vous êtes formateur/ });
    expect(within(lue).queryByText("Non lue")).toBeNull();
    expect(within(panneau).getByRole("link", { name: "Voir toutes les notifications" })).toHaveAttribute("href", "/notifications");
  });

  it("clic sur une notification : marquerLues([id]), le compteur baisse et le panneau se ferme", async () => {
    vi.mocked(chargerCloche).mockResolvedValue(lot([notif()], 3));
    const user = await ouvrir("Notifications, 3 non lues");
    await user.click(screen.getByRole("link", { name: /Nouvelle formation/ }));
    expect(marquerLues).toHaveBeenCalledWith(["7"]);
    expect(screen.queryByRole("dialog", { name: "Notifications" })).toBeNull();
    expect(screen.getByRole("button", { name: "Notifications, 2 non lues" })).toBeInTheDocument();
  });

  it("Tout marquer comme lu : marquerLues(null) ; le bouton disparaît", async () => {
    vi.mocked(chargerCloche).mockResolvedValue(lot([notif()], 3));
    const user = await ouvrir("Notifications, 3 non lues");
    await user.click(screen.getByRole("button", { name: "Tout marquer comme lu" }));
    expect(marquerLues).toHaveBeenCalledWith(null);
    expect(screen.queryByRole("button", { name: "Tout marquer comme lu" })).toBeNull();
    expect(screen.queryByText("Non lue")).toBeNull();
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
  });

  it("changement de page ou événement etudium:notifications : la cloche se recharge", async () => {
    vi.mocked(chargerCloche).mockResolvedValue(lot([], 0));
    const { rerender } = render(<HeaderActions user={DEMO_USER} />);
    await waitFor(() => expect(chargerCloche).toHaveBeenCalledTimes(1));
    chemin = "/mes-formations";
    rerender(<HeaderActions user={DEMO_USER} />);
    await waitFor(() => expect(chargerCloche).toHaveBeenCalledTimes(2));
    await act(async () => {
      window.dispatchEvent(new Event(EVENEMENT_NOTIFICATIONS));
    });
    await waitFor(() => expect(chargerCloche).toHaveBeenCalledTimes(3));
  });

  it("une annonce porte le ton violet ; une pastille signale les non lues ; chargerCloche null : Vous êtes à jour", async () => {
    vi.mocked(chargerCloche).mockResolvedValue(lot([notif({ categorie: "annonces", titre: "Nouveautés d’octobre" })], 1));
    const { unmount } = render(<HeaderActions user={DEMO_USER} />);
    const bouton = await screen.findByRole("button", { name: "Notifications, 1 non lue" });
    expect(bouton.querySelector("[data-pastille]")).not.toBeNull();
    await userEvent.setup().click(bouton);
    const lien = screen.getByRole("link", { name: /Nouveautés d’octobre/ });
    expect(lien.querySelector(".bg-premium-fond")).not.toBeNull();
    unmount();

    vi.mocked(chargerCloche).mockResolvedValue(null);
    await ouvrir("Notifications");
    expect(screen.getByText("Vous êtes à jour")).toBeVisible();
    expect(screen.getByRole("button", { name: "Notifications" }).querySelector("[data-pastille]")).toBeNull();
  });
});
