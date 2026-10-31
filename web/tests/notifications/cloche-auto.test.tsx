// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HeaderActions, INTERVALLE_CLOCHE_MS } from "@/components/layout/HeaderActions";
import { ToastProvider } from "@/components/ui/Toast";
import { DEMO_USER } from "@/lib/demo-user";
import { chargerCloche, marquerLues } from "@/lib/notifications/actions";
import type { LotNotifications, NotificationLue } from "@/lib/notifications/types";

// La cloche se met à jour seule (spec Formations et Événements, §3.2) : toutes les minutes tant que l'onglet est
// visible, au retour sur l'onglet ; une nouvelle notification de session live s'annonce en bas de l'écran.

const push = vi.fn();
vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  useRouter: () => ({ push }),
  usePathname: () => "/accueil",
}));
vi.mock("@/lib/auth/actions", () => ({ signOut: vi.fn() }));
vi.mock("@/lib/full-page", () => ({ loadFullPage: vi.fn() }));
vi.mock("@/lib/notifications/actions", () => ({ chargerCloche: vi.fn(), marquerLues: vi.fn() }));

const notif = (o: Partial<NotificationLue> = {}): NotificationLue => ({
  id: "7",
  categorie: "nouveaux_contenus",
  titre: "Nouvelle formation : Excel",
  texte: "Dans le parcours Académique.",
  lien: "/formations/excel",
  creeLe: new Date().toISOString(),
  lue: false,
  ...o,
});
const lot = (lignes: NotificationLue[]): LotNotifications => ({ lignes, suite: false, nonLues: lignes.filter((n) => !n.lue).length });
const LIVE = notif({
  id: "8",
  categorie: "sessions_live",
  titre: "C’est l’heure du live : Excel avancé",
  texte: "La session vient de commencer avec Mireille Akpo. Rejoignez-la depuis la page Événements.",
  lien: "/evenements",
});

let visibilite: DocumentVisibilityState = "visible";
const afficher = () =>
  render(
    <ToastProvider>
      <HeaderActions user={DEMO_USER} />
    </ToastProvider>,
  );
const minute = () => act(() => vi.advanceTimersByTime(INTERVALLE_CLOCHE_MS));

describe("La cloche se met à jour seule", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    visibilite = "visible";
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibilite });
    push.mockReset();
    vi.mocked(chargerCloche).mockReset().mockResolvedValue(lot([notif()]));
    vi.mocked(marquerLues).mockReset().mockResolvedValue({ ok: true });
  });
  afterEach(() => vi.useRealTimers());

  it("toutes les minutes tant que l'onglet est visible, et au retour sur l'onglet", async () => {
    afficher();
    await waitFor(() => expect(chargerCloche).toHaveBeenCalledTimes(1));
    minute();
    await waitFor(() => expect(chargerCloche).toHaveBeenCalledTimes(2));
    visibilite = "hidden";
    minute();
    expect(chargerCloche).toHaveBeenCalledTimes(2);
    visibilite = "visible";
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(chargerCloche).toHaveBeenCalledTimes(3));
  });

  it("le temps réel (0044) : une notification arrive, la cloche se relit aussitôt", async () => {
    afficher();
    await waitFor(() => expect(chargerCloche).toHaveBeenCalledTimes(1));
    act(() => {
      window.dispatchEvent(new Event("etudium:temps-reel:notification"));
    });
    await waitFor(() => expect(chargerCloche).toHaveBeenCalledTimes(2));
  });

  it("une nouvelle notification de session live : un message en bas de l'écran, « Voir » mène à la page Événements", async () => {
    afficher();
    await waitFor(() => expect(chargerCloche).toHaveBeenCalledTimes(1));
    // Au premier chargement, rien n'est annoncé : seules les notifications arrivées ensuite le sont.
    expect(screen.queryByRole("button", { name: "Voir" })).toBeNull();
    vi.mocked(chargerCloche).mockResolvedValue(lot([LIVE, notif()]));
    minute();
    expect(await screen.findByText(LIVE.titre)).toBeInTheDocument();
    expect(screen.getByText(LIVE.texte)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Voir" }));
    expect(push).toHaveBeenCalledWith("/evenements");
  });

  it("un rechargement parti avant « Tout marquer comme lu » ne réaffiche pas les non lues (revue du plan)", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    afficher();
    await screen.findByRole("button", { name: "Notifications, 1 non lue" });
    let rendre: (l: LotNotifications) => void = () => {};
    vi.mocked(chargerCloche).mockReturnValueOnce(new Promise((r) => (rendre = r)));
    minute();
    await user.click(screen.getByRole("button", { name: "Notifications, 1 non lue" }));
    await user.click(await screen.findByRole("button", { name: "Tout marquer comme lu" }));
    await act(async () => rendre(lot([notif()])));
    expect(screen.queryByRole("button", { name: "Notifications, 1 non lue" })).toBeNull();
  });

  it("la base injoignable pendant un rechargement : la cloche garde ce qu'elle avait, sans erreur", async () => {
    afficher();
    await screen.findByRole("button", { name: "Notifications, 1 non lue" });
    vi.mocked(chargerCloche).mockRejectedValueOnce(new Error("réseau"));
    minute();
    await waitFor(() => expect(chargerCloche).toHaveBeenCalledTimes(2));
    await act(async () => {});
    expect(screen.getByRole("button", { name: "Notifications, 1 non lue" })).toBeInTheDocument();
  });

  it("une autre catégorie, ou une notification déjà vue : pas de message", async () => {
    vi.mocked(chargerCloche).mockResolvedValue(lot([LIVE]));
    afficher();
    await waitFor(() => expect(chargerCloche).toHaveBeenCalledTimes(1));
    vi.mocked(chargerCloche).mockResolvedValue(lot([notif({ id: "9" }), LIVE]));
    minute();
    await waitFor(() => expect(chargerCloche).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("button", { name: "Voir" })).toBeNull();
  });
});
