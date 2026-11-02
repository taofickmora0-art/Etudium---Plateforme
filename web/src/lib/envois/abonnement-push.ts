// Le push côté navigateur (lot 5, étape B) : dire si c'est possible ici, abonner cet appareil, le désabonner.
// Le service worker (public/sw.js) est enregistré au premier abonnement ; le navigateur le garde ensuite.

import type { AppareilNavigateur } from "./actions";

export type EtatPush = "sans_cle" | "non_pris_en_charge" | "iphone_a_installer" | "refuse" | "possible";

export const MESSAGES_PUSH: Record<Exclude<EtatPush, "possible">, string> = {
  sans_cle: "Bientôt disponible",
  non_pris_en_charge: "Votre navigateur ne reçoit pas les notifications push.",
  iphone_a_installer: "Sur iPhone, ajoutez d’abord Étudium à l’écran d’accueil (Partager › Sur l’écran d’accueil).",
  refuse: "Autorisez les notifications pour Étudium dans les réglages du navigateur.",
};

const ECHEC = "L’abonnement aux notifications push a échoué. Réessayez.";
const PAS_PRET = "Le navigateur n’a pas pu préparer les notifications. Rechargez la page, puis réessayez.";
/** Le service worker a 10 secondes pour s'activer ; au-delà, on n'attend plus (l'interrupteur ne reste pas bloqué). */
const ATTENTE_SERVICE_WORKER_MS = 10_000;

function surIphone(): boolean {
  const n = window.navigator;
  return /iPhone|iPad|iPod/.test(n.userAgent) || (n.platform === "MacIntel" && n.maxTouchPoints > 1);
}

function installee(): boolean {
  return window.matchMedia?.("(display-mode: standalone)").matches === true || (window.navigator as { standalone?: boolean }).standalone === true;
}

/** Ce que permet ce navigateur. Sur iPhone, le push n'existe que pour l'appli ajoutée à l'écran d'accueil. */
export function etatDuPush(cle: string | undefined = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY): EtatPush {
  if (!cle?.trim()) return "sans_cle";
  const pris = "serviceWorker" in window.navigator && !!window.navigator.serviceWorker && "PushManager" in window && "Notification" in window;
  if (!pris) return surIphone() && !installee() ? "iphone_a_installer" : "non_pris_en_charge";
  if (Notification.permission === "denied") return "refuse";
  return "possible";
}

/** La clé publique VAPID (base64url) en octets, pour `applicationServerKey`. */
export function octetsDeCle(cle: string): Uint8Array {
  const base64 = (cle + "=".repeat((4 - (cle.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

const memesOctets = (a: ArrayBuffer | null | undefined, b: Uint8Array) => !!a && a.byteLength === b.length && new Uint8Array(a).every((x, i) => x === b[i]);

/** L'abonnement de cet appareil (adresse et clés), s'il en a un. */
export async function abonnementCourant(): Promise<AppareilNavigateur | null> {
  try {
    const enregistrement = await window.navigator.serviceWorker?.getRegistration("/");
    const abonnement = await enregistrement?.pushManager.getSubscription();
    const keys = abonnement?.toJSON().keys;
    return abonnement && keys?.p256dh && keys.auth ? { adresse: abonnement.endpoint, p256dh: keys.p256dh, auth: keys.auth } : null;
  } catch {
    return null;
  }
}

export async function abonnerPush(clePublique: string): Promise<{ ok: true; abonnement: AppareilNavigateur } | { ok: false; message: string }> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, message: MESSAGES_PUSH.refuse };
    const enregistrement = await window.navigator.serviceWorker.register("/sw.js", { scope: "/" });
    let minuterie: ReturnType<typeof setTimeout> | undefined;
    const pret = await Promise.race([
      window.navigator.serviceWorker.ready.then(() => true),
      new Promise<false>((resoudre) => {
        minuterie = setTimeout(() => resoudre(false), ATTENTE_SERVICE_WORKER_MS);
      }),
    ]);
    clearTimeout(minuterie);
    if (!pret) return { ok: false, message: PAS_PRET };
    const cle = octetsDeCle(clePublique);
    let abonnement = await enregistrement.pushManager.getSubscription();
    // Un abonnement fait avec une autre clé (clés changées) est refait.
    if (abonnement && abonnement.options?.applicationServerKey && !memesOctets(abonnement.options.applicationServerKey, cle)) {
      await abonnement.unsubscribe();
      abonnement = null;
    }
    abonnement ??= await enregistrement.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cle as BufferSource });
    const { keys } = abonnement.toJSON();
    if (!keys?.p256dh || !keys.auth) return { ok: false, message: ECHEC };
    return { ok: true, abonnement: { adresse: abonnement.endpoint, p256dh: keys.p256dh, auth: keys.auth } };
  } catch {
    return { ok: false, message: ECHEC };
  }
}

/** Désabonne cet appareil ; rend l'adresse qu'il avait (pour la retirer en base), ou null. */
export async function desabonnerPush(): Promise<string | null> {
  try {
    const enregistrement = await window.navigator.serviceWorker?.getRegistration("/");
    const abonnement = await enregistrement?.pushManager.getSubscription();
    if (!abonnement) return null;
    const adresse = abonnement.endpoint;
    await abonnement.unsubscribe();
    return adresse;
  } catch {
    return null;
  }
}
