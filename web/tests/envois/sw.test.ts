import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

// Le service worker (public/sw.js, lot 5 étape B) chargé dans un faux `self` : il affiche les notifications push et,
// au clic, met au premier plan un onglet d'Étudium sur la page de la notification, sinon ouvre une fenêtre.

const CODE = readFileSync(path.join(process.cwd(), "public", "sw.js"), "utf8");
const ORIGINE = "https://etudium.app";

type Ecouteur = (evenement: Record<string, unknown>) => void;

function charger(onglets: { url: string; focus: ReturnType<typeof vi.fn>; navigate?: ReturnType<typeof vi.fn> }[] = []) {
  const ecouteurs: Record<string, Ecouteur> = {};
  const self = {
    location: { origin: ORIGINE },
    addEventListener: (type: string, f: Ecouteur) => (ecouteurs[type] = f),
    skipWaiting: vi.fn(async () => {}),
    registration: { showNotification: vi.fn<(titre: string, options: Record<string, unknown>) => Promise<void>>(async () => {}) },
    clients: { matchAll: vi.fn(async () => onglets), openWindow: vi.fn(async () => null), claim: vi.fn(async () => {}) },
  };
  new Function("self", CODE)(self);
  const declencher = async (type: string, donnees: Record<string, unknown>) => {
    let attente: Promise<unknown> = Promise.resolve();
    ecouteurs[type]({ ...donnees, waitUntil: (p: Promise<unknown>) => (attente = p) });
    await attente;
  };
  return { self, declencher };
}
const pousser = (contenu: unknown) => ({ data: { json: () => contenu, text: () => JSON.stringify(contenu) } });

describe("Le service worker", () => {
  it("affiche le titre et le texte, avec l'icône d'Étudium et le lien", async () => {
    const { self, declencher } = charger();
    await declencher("push", pousser({ titre: "Nouveau message", texte: "Aïcha vous a écrit", lien: "/messages" }));
    expect(self.registration.showNotification).toHaveBeenCalledWith("Nouveau message", {
      body: "Aïcha vous a écrit",
      icon: "/icons/icone-192.png",
      lang: "fr",
      // Une notification par page : un nouveau message remplace le précédent au lieu de s'empiler, et sonne encore.
      tag: "/messages",
      renotify: true,
      data: { lien: "/messages" },
    });
  });

  it("un contenu illisible ou un lien hors du site : « Étudium », vers l'accueil", async () => {
    const { self, declencher } = charger();
    await declencher("push", { data: { json: () => JSON.parse("{"), text: () => "{" } });
    await declencher("push", pousser({ titre: "T", texte: "X", lien: "https://ailleurs.exemple" }));
    // Un lien avec une tabulation, une espace ou une barre oblique inversée ne sort pas du site (new URL les retire).
    await declencher("push", pousser({ titre: "U", texte: "X", lien: "/	/ailleurs.exemple/x" }));
    await declencher("push", pousser({ titre: "V", texte: "X", lien: "/ /ailleurs.exemple" }));
    expect(self.registration.showNotification.mock.calls.map((c) => [c[0], c[1].data])).toEqual([
      ["Étudium", { lien: "/accueil" }],
      ["T", { lien: "/accueil" }],
      ["U", { lien: "/accueil" }],
      ["V", { lien: "/accueil" }],
    ]);
  });

  it("au clic : un onglet d'Étudium ouvert passe au premier plan et va sur la page", async () => {
    const onglet = { url: `${ORIGINE}/accueil`, focus: vi.fn(async () => {}), navigate: vi.fn(async () => {}) };
    const { self, declencher } = charger([{ url: "https://ailleurs.exemple/", focus: vi.fn() }, onglet]);
    const close = vi.fn();
    await declencher("notificationclick", { notification: { close, data: { lien: "/messages" } } });
    expect(close).toHaveBeenCalled();
    expect(onglet.focus).toHaveBeenCalled();
    expect(onglet.navigate).toHaveBeenCalledWith(`${ORIGINE}/messages`);
    expect(self.clients.openWindow).not.toHaveBeenCalled();
  });

  it("au clic, sans onglet ouvert (ou un onglet qui ne peut pas changer de page) : une nouvelle fenêtre", async () => {
    const { self, declencher } = charger();
    await declencher("notificationclick", { notification: { close: vi.fn(), data: { lien: "/abonnement" } } });
    expect(self.clients.openWindow).toHaveBeenCalledWith(`${ORIGINE}/abonnement`);
    const bloque = { url: `${ORIGINE}/`, focus: vi.fn(async () => {}), navigate: vi.fn(async () => Promise.reject(new TypeError("non contrôlé"))) };
    const second = charger([bloque]);
    await second.declencher("notificationclick", { notification: { close: vi.fn(), data: { lien: "/aide" } } });
    expect(second.self.clients.openWindow).toHaveBeenCalledWith(`${ORIGINE}/aide`);
  });
});
