import { after } from "next/server";
import { viderFile } from "./file";

// La file se vide après la réponse : la page ne l'attend pas. Hors d'une requête (tests, scripts), after() lève : la
// file attend alors le prochain passage (cloche, message, annonce…), rien n'est perdu.

export function viderFileApres(): void {
  try {
    after(() => viderFile());
  } catch {
    // Pas de requête en cours.
  }
}
