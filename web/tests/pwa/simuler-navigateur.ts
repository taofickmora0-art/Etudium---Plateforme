import { vi } from "vitest";

// Ce que l'installation lit du navigateur : l'appareil (userAgent, écran tactile), le mode d'affichage (appli installée)
// et la demande d'installation de Chrome (« beforeinstallprompt »). jsdom n'a ni matchMedia ni maxTouchPoints.

export const NAVIGATEURS = {
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  chromeOrdinateur: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  safariIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  chromeIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1",
  // Un iPad se présente comme un Mac : seul l'écran tactile le distingue.
  safariIpadOuMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  firefox: "Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0",
} as const;

const definies = new Set<string>();

function definir(nom: string, valeur: unknown) {
  Object.defineProperty(window.navigator, nom, { configurable: true, get: () => valeur });
  definies.add(nom);
}

type Options = {
  ua?: string;
  /** Points de contact de l'écran tactile (0 : pas d'écran tactile). */
  toucher?: number;
  /** Ouverte comme une appli installée : (display-mode: standalone). */
  autonome?: boolean;
  /** `navigator.standalone` de Safari sur iPhone (appli ajoutée à l'écran d'accueil). */
  standalone?: boolean;
};

export function simulerNavigateur({ ua = NAVIGATEURS.chromeAndroid, toucher = 0, autonome = false, standalone }: Options = {}) {
  definir("userAgent", ua);
  definir("maxTouchPoints", toucher);
  if (standalone !== undefined) definir("standalone", standalone);
  window.matchMedia = ((requete: string) => ({
    matches: autonome && requete === "(display-mode: standalone)",
    media: requete,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

export function retablirNavigateur() {
  for (const nom of definies) delete (window.navigator as unknown as Record<string, unknown>)[nom];
  definies.clear();
  // @ts-expect-error jsdom n'a pas matchMedia : on retire celui du test.
  delete window.matchMedia;
}

/** La demande d'installation de Chrome : `prompt()` ouvre sa fenêtre, `userChoice` donne la réponse de la personne. */
export function demandeInstallation(reponse: "accepted" | "dismissed" = "accepted") {
  return Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt: vi.fn(async () => ({ outcome: reponse, platform: "web" })),
    userChoice: Promise.resolve({ outcome: reponse, platform: "web" }),
  });
}
