// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LotNotifications } from "@/lib/notifications/types";

// Le son des notifications (choix de l'utilisateur du 3 novembre 2026 : « Deux notes »). Il joue quand une
// notification arrive, site ouvert ; ni au chargement de la page, ni quand on lit une notification. Un interrupteur du
// profil le coupe, sur cet appareil.

vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/accueil",
}));
vi.mock("@/lib/auth/actions", () => ({ signOut: vi.fn() }));
vi.mock("@/lib/full-page", () => ({ loadFullPage: vi.fn() }));
vi.mock("@/lib/envois/abonnement-push", () => ({ desabonnerPush: vi.fn() }));
vi.mock("@/lib/envois/actions", () => ({ retirerAppareil: vi.fn() }));
let lots: (LotNotifications | null)[] = [];
vi.mock("@/lib/notifications/actions", () => ({ chargerCloche: async () => lots.shift() ?? null, marquerLues: async () => ({ ok: true }) }));

// Un faux AudioContext : il note les notes jouées.
const notes: number[] = [];
class FauxContexte {
  state = "running";
  currentTime = 0;
  destination = {};
  resume = async () => {};
  createOscillator() {
    const o = { type: "", frequency: { value: 0 }, connect: (g: unknown) => g, start: () => notes.push(o.frequency.value), stop: () => {} };
    return o;
  }
  createGain() {
    const g = { gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: (d: unknown) => d };
    return g;
  }
}
vi.stubGlobal("AudioContext", FauxContexte);

const son = await import("@/lib/notifications/son");
const { HeaderActions } = await import("@/components/layout/HeaderActions");
const { signalerTempsReel } = await import("@/components/temps-reel/evenements");
const { InterrupteurSon } = await import("@/components/profile/InterrupteurSon");
const { DEMO_USER } = await import("@/lib/demo-user");

const ligne = (id: number, lue: boolean) => ({ id: String(id), titre: `Notification ${id}`, texte: "", lien: null, lue, categorie: "communaute", creeLe: "2026-11-03T10:00:00Z" });
const lot = (lignes: ReturnType<typeof ligne>[]) => ({ lignes, suite: false, nonLues: lignes.filter((l) => !l.lue).length }) as unknown as LotNotifications;

beforeEach(() => {
  notes.length = 0;
  localStorage.clear();
});

describe("Le son « Deux notes »", () => {
  it("deux notes qui montent ; rien quand le son est coupé, sauf pour l'écouter depuis le profil", () => {
    son.jouerSonNotification();
    expect(notes).toEqual([660, 990]);
    son.reglerSon(false);
    expect(son.sonActif()).toBe(false);
    son.jouerSonNotification();
    expect(notes).toEqual([660, 990]);
    son.jouerSonNotification({ forcer: true });
    expect(notes).toEqual([660, 990, 660, 990]);
  });
});

describe("La cloche joue le son à l'arrivée d'une notification", () => {
  it("pas au chargement ; oui pour une nouvelle ; pas quand elle est lue", async () => {
    lots = [lot([ligne(5, false)]), lot([ligne(6, false), ligne(5, false)]), lot([ligne(6, true), ligne(5, true)])];
    render(<HeaderActions user={DEMO_USER} />);
    await act(async () => {});
    expect(notes).toEqual([]);
    await act(async () => signalerTempsReel("notification"));
    expect(notes).toEqual([660, 990]);
    await act(async () => signalerTempsReel("notification"));
    expect(notes).toEqual([660, 990]);
  });
});

describe("L'interrupteur du profil", () => {
  it("actif par défaut ; le couper l'enregistre sur cet appareil ; le rallumer fait entendre le son", async () => {
    render(<InterrupteurSon />);
    const interrupteur = screen.getByRole("switch", { name: "Son des notifications" });
    expect(interrupteur).toBeChecked();
    await userEvent.click(interrupteur);
    expect(son.sonActif()).toBe(false);
    await userEvent.click(interrupteur);
    expect(son.sonActif()).toBe(true);
    expect(notes).toEqual([660, 990]);
  });
});
