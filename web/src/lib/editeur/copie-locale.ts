// La copie de secours de l'éditeur (fin du lot 4, spec §2.1) : ce qu'on écrit est gardé sur l'appareil (stockage du
// navigateur) jusqu'à ce que le serveur confirme. Rien ne lève : un stockage plein, bloqué ou absent est ignoré.

const PREFIXE = "etudium-editeur:";

export type CopieLocale<T> = { valeur: T; revision: number; le: string };

export function ecrireCopie(cle: string, valeur: unknown, revision: number): void {
  try {
    localStorage.setItem(PREFIXE + cle, JSON.stringify({ valeur, revision, le: new Date().toISOString() }));
  } catch {
    // Stockage plein, bloqué (navigation privée) ou absent (serveur) : la sauvegarde en ligne suffit.
  }
}

export function lireCopie<T>(cle: string): CopieLocale<T> | null {
  try {
    const brut = localStorage.getItem(PREFIXE + cle);
    if (!brut) return null;
    const copie = JSON.parse(brut) as Partial<CopieLocale<T>> | null;
    if (!copie || typeof copie.revision !== "number" || !("valeur" in copie) || typeof copie.le !== "string") return null;
    return copie as CopieLocale<T>;
  } catch {
    return null;
  }
}

export function effacerCopie(cle: string): void {
  try {
    localStorage.removeItem(PREFIXE + cle);
  } catch {
    // Rien à faire.
  }
}
