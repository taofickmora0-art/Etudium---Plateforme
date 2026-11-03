// Le son des notifications (choix de l'utilisateur du 3 novembre 2026 : « Deux notes », deux notes qui montent).
// Joué par le navigateur (Web Audio), sans fichier : quand une notification arrive, site ouvert. Les notifications
// push du téléphone, site fermé, gardent le son du système. Le réglage vaut pour cet appareil (stockage local).

const CLE = "etudium-son-notifications";

/** Les deux notes, en hertz : mi puis si, une quinte plus haut. */
export const DEUX_NOTES = [660, 990] as const;

/** Le son est-il actif sur cet appareil ? Oui par défaut. */
export function sonActif(): boolean {
  try {
    return localStorage.getItem(CLE) !== "0";
  } catch {
    return true;
  }
}

export function reglerSon(actif: boolean): void {
  try {
    localStorage.setItem(CLE, actif ? "1" : "0");
  } catch {
    // Stockage refusé (navigation privée…) : le réglage ne survit pas, sans gêner.
  }
}

let contexte: AudioContext | null = null;

function note(c: AudioContext, debut: number, frequence: number, duree: number) {
  const oscillateur = c.createOscillator();
  const volume = c.createGain();
  oscillateur.type = "sine";
  oscillateur.frequency.value = frequence;
  volume.gain.setValueAtTime(0.0001, debut);
  volume.gain.exponentialRampToValueAtTime(0.3, debut + 0.012);
  volume.gain.exponentialRampToValueAtTime(0.0001, debut + duree);
  oscillateur.connect(volume).connect(c.destination);
  oscillateur.start(debut);
  oscillateur.stop(debut + duree + 0.05);
}

/**
 * Joue « Deux notes » si le son est actif (`forcer` : pour l'écouter depuis le profil). Le navigateur n'autorise le son
 * qu'après un geste sur la page : avant, il reste muet, sans erreur.
 */
export function jouerSonNotification({ forcer = false }: { forcer?: boolean } = {}): void {
  if (!forcer && !sonActif()) return;
  try {
    const Contexte = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Contexte) return;
    contexte ??= new Contexte();
    if (contexte.state === "suspended") void contexte.resume().catch(() => {});
    const debut = contexte.currentTime + 0.02;
    note(contexte, debut, DEUX_NOTES[0], 0.18);
    note(contexte, debut + 0.13, DEUX_NOTES[1], 0.32);
  } catch {
    // Son impossible sur cet appareil : la notification s'affiche quand même.
  }
}
