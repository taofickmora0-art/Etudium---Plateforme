import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

// Pour proposer l'installation (fenêtre de Chrome, « beforeinstallprompt »), Chrome cherche encore un service worker
// qui déclare un gestionnaire « fetch ». Celui d'Étudium est vide : Chrome le reconnaît et ne le réveille pas, les
// requêtes vont au réseau comme avant. Rien n'est mis en cache.

const CODE = readFileSync(path.join(process.cwd(), "public", "sw.js"), "utf8");

function charger() {
  const ecouteurs: Record<string, (evenement: Record<string, unknown>) => unknown> = {};
  const self = {
    location: { origin: "https://etudium.online" },
    addEventListener: (type: string, f: (evenement: Record<string, unknown>) => unknown) => (ecouteurs[type] = f),
    skipWaiting: vi.fn(async () => {}),
    registration: { showNotification: vi.fn(async () => {}) },
    clients: { matchAll: vi.fn(async () => []), openWindow: vi.fn(async () => null), claim: vi.fn(async () => {}) },
  };
  new Function("self", CODE)(self);
  return ecouteurs;
}

describe("Le service worker et l'installation", () => {
  it("il déclare un gestionnaire « fetch », qui laisse passer chaque requête", () => {
    const ecouteurs = charger();
    expect(ecouteurs.fetch).toBeTypeOf("function");
    const respondWith = vi.fn();
    const waitUntil = vi.fn();
    expect(ecouteurs.fetch({ request: { url: "https://etudium.online/accueil", mode: "navigate" }, respondWith, waitUntil })).toBeUndefined();
    expect(respondWith).not.toHaveBeenCalled();
    expect(waitUntil).not.toHaveBeenCalled();
  });

  it("le gestionnaire est vide (Chrome ne réveille pas le service worker pour lui) et rien n'est mis en cache", () => {
    expect(CODE).toMatch(/self\.addEventListener\("fetch", \(\) => \{\}\);/);
    expect(CODE).not.toMatch(/\bcaches\b|respondWith/);
  });
});
