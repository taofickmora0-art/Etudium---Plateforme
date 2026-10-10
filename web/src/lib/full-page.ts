/**
 * Ouvre une page par un chargement complet, en remplaçant l'entrée courante de l'historique.
 * Sert à la déconnexion : la navigation de Next garde les pages déjà vues en mémoire (cachées, pas détruites),
 * un chargement complet efface tout ce qui concernait le compte (guide « Preserving UI state », déconnexion).
 */
export function loadFullPage(url: string): void {
  window.location.replace(url);
}
