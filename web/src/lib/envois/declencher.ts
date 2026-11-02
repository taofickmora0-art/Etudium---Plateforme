import { after } from "next/server";
import { viderFile } from "./file";

// La file se vide après la réponse : la page ne l'attend pas. Hors d'une requête (tests, scripts), after() lève : la
// file attend alors le prochain passage (cloche, message, annonce…), rien n'est perdu.

let dernierPassage = 0;

/**
 * `espacementMs` : au plus un passage dans ce délai (la cloche se recharge à chaque page et chaque minute ; un message,
 * une annonce ou un paiement vident la file aussitôt). L'espacement vaut pour ce serveur, pas pour tous.
 */
export function viderFileApres(options?: { espacementMs?: number }): void {
  if (options?.espacementMs) {
    const maintenant = Date.now();
    if (maintenant - dernierPassage < options.espacementMs) return;
    dernierPassage = maintenant;
  }
  try {
    after(() => viderFile());
  } catch {
    // Pas de requête en cours.
  }
}
