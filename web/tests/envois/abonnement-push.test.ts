// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { abonnerPush } from "@/lib/envois/abonnement-push";

// Point reporté du lot 5 B : si le service worker ne s'active jamais (navigateur bloqué, fichier introuvable),
// l'abonnement ne reste pas en attente : après 10 secondes, il échoue avec un message.

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  // @ts-expect-error retirée après le test
  delete window.navigator.serviceWorker;
});

describe("S'abonner au push", () => {
  it("un service worker qui ne s'active jamais : échec après 10 secondes, sans rester bloqué", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Notification", { permission: "default", requestPermission: vi.fn(async () => "granted") });
    Object.defineProperty(window.navigator, "serviceWorker", {
      configurable: true,
      value: { register: vi.fn(async () => ({ pushManager: { getSubscription: vi.fn(), subscribe: vi.fn() } })), ready: new Promise(() => {}) },
    });
    const resultat = abonnerPush("B" + "A".repeat(86));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await resultat).toEqual({ ok: false, message: "Le navigateur n’a pas pu préparer les notifications. Rechargez la page, puis réessayez." });
  });
});
