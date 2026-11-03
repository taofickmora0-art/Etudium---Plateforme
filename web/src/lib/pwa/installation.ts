// « Installer l'application » (demande du 3 novembre 2026). Chrome (Android, ordinateur), Edge et Samsung Internet
// annoncent qu'Étudium peut s'installer par l'événement « beforeinstallprompt » : on le garde ici, sans sa bannière,
// pour que le menu du profil propose l'installation. Safari sur iPhone n'a pas cet événement : on y explique la marche
// à suivre (Partager › Sur l'écran d'accueil).

import { useSyncExternalStore } from "react";

/**
 * - `installable` : Chrome a envoyé sa demande d'installation, gardée ici ;
 * - `ios` : iPhone ou iPad, pas encore ajouté à l'écran d'accueil ;
 * - `installee` : ouverte comme une appli, ou installée depuis cette page ;
 * - `indisponible` : rien à proposer (autres navigateurs, demande pas encore reçue ou déjà utilisée).
 */
export type EtatInstallation = "installable" | "ios" | "installee" | "indisponible";

/** L'événement « beforeinstallprompt » (pas encore dans les types du DOM). */
type DemandeInstallation = Event & {
  prompt: () => Promise<unknown>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform?: string }>;
};

let demande: DemandeInstallation | null = null;
let installeeIci = false;
const abonnes = new Set<() => void>();

function prevenir() {
  abonnes.forEach((rappel) => rappel());
}

/** iPhone, iPod ou iPad ; un iPad se présente comme un Mac, mais il a un écran tactile. */
function surIos(): boolean {
  const n = window.navigator;
  return /iPhone|iPad|iPod/.test(n.userAgent) || (/Macintosh/.test(n.userAgent) && n.maxTouchPoints > 1);
}

/** Un iPad (sinon : iPhone ou iPod). */
export function surIpad(): boolean {
  const n = window.navigator;
  return /iPad/.test(n.userAgent) || (/Macintosh/.test(n.userAgent) && n.maxTouchPoints > 1);
}

function ouverteCommeAppli(): boolean {
  return window.matchMedia?.("(display-mode: standalone)").matches === true || (window.navigator as { standalone?: boolean }).standalone === true;
}

function lireEtat(): EtatInstallation {
  if (installeeIci || ouverteCommeAppli()) return "installee";
  if (demande) return "installable";
  return surIos() ? "ios" : "indisponible";
}

function sAbonner(rappel: () => void) {
  abonnes.add(rappel);
  return () => {
    abonnes.delete(rappel);
  };
}

/** Rendu du serveur : rien à proposer ; le navigateur relit l'état juste après, sans écart à l'hydratation. */
const etatServeur = (): EtatInstallation => "indisponible";

/** L'état de l'installation, relu dès qu'il change. */
export function useInstallation(): EtatInstallation {
  return useSyncExternalStore(sAbonner, lireEtat, etatServeur);
}

/**
 * Écoute la demande d'installation de Chrome et l'installation elle-même. La demande est gardée jusqu'à son usage, même
 * si l'en-tête qui écoute change (Chrome ne la renvoie pas avant le prochain chargement de la page).
 */
export function capterInstallation(): () => void {
  const garder = (evenement: Event) => {
    // Pas de bannière de Chrome : l'installation passe par le menu du profil.
    evenement.preventDefault();
    demande = evenement as DemandeInstallation;
    prevenir();
  };
  const installee = () => {
    installeeIci = true;
    demande = null;
    prevenir();
  };
  window.addEventListener("beforeinstallprompt", garder);
  window.addEventListener("appinstalled", installee);
  return () => {
    window.removeEventListener("beforeinstallprompt", garder);
    window.removeEventListener("appinstalled", installee);
  };
}

/**
 * Ouvre la fenêtre d'installation de Chrome (au clic : il le faut pour Chrome). Une demande ne sert qu'une fois : refusée,
 * il n'y a plus rien à proposer avant le prochain chargement de la page.
 */
export async function installer(): Promise<"acceptee" | "refusee" | "indisponible"> {
  const enCours = demande;
  if (!enCours) return "indisponible";
  demande = null;
  try {
    await enCours.prompt();
    const { outcome } = await enCours.userChoice;
    if (outcome === "accepted") installeeIci = true;
    return outcome === "accepted" ? "acceptee" : "refusee";
  } catch {
    return "indisponible";
  } finally {
    prevenir();
  }
}

/**
 * Le service worker (public/sw.js), enregistré dès l'espace connecté : Chrome le demande pour proposer l'installation.
 * Même adresse et même portée que pour le push : le navigateur garde un seul service worker.
 */
export function enregistrerServiceWorker() {
  try {
    void window.navigator.serviceWorker?.register("/sw.js", { scope: "/" }).catch(() => null);
  } catch {
    // Navigateur sans service worker utilisable (navigation privée de certains navigateurs) : rien à faire.
  }
}
